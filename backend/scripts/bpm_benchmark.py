#!/usr/bin/env python3
import argparse
import json
import math
import os
import subprocess
import sys
from statistics import mean
from typing import Any


def _run_detector(script_path: str, audio_path: str, method: str, duration: int) -> dict[str, Any]:
    proc = subprocess.run(
        [
            sys.executable,
            script_path,
            "--input",
            audio_path,
            "--method",
            method,
            "--duration",
            str(duration),
        ],
        capture_output=True,
        text=True,
        timeout=300,
    )
    out = (proc.stdout or "").strip()
    if not out:
        return {"ok": False, "error": "empty detector output"}
    try:
        return json.loads(out)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"invalid detector json: {exc}", "raw": out[:300]}


def _half_double_error(pred: float, gt: float) -> float:
    cands = [pred, pred * 2.0, pred / 2.0]
    return min(abs(c - gt) for c in cands)


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate BPM detector accuracy on a labeled manifest")
    parser.add_argument("--manifest", required=True, help="JSON file with [{file, gt_bpm}] entries")
    parser.add_argument("--method", default="auto", choices=["auto", "librosa", "essentia"])
    parser.add_argument("--duration", type=int, default=120)
    parser.add_argument("--output", default="reports/bpm_eval_latest.json")
    args = parser.parse_args()

    root = os.path.dirname(os.path.abspath(args.manifest))
    detector_script = os.path.join(os.path.dirname(root), "scripts", "detect_bpm.py")

    with open(args.manifest, "r", encoding="utf-8") as fh:
        samples = json.load(fh)

    rows = []
    abs_errors = []
    hd_errors = []
    hit1 = 0
    hit2 = 0
    hit3 = 0
    hit5 = 0

    for sample in samples:
        rel = sample["file"]
        gt = float(sample["gt_bpm"])
        audio_path = rel if os.path.isabs(rel) else os.path.normpath(os.path.join(root, rel))

        result = _run_detector(detector_script, audio_path, args.method, args.duration)
        pred = float(result["bpm"]) if result.get("ok") and result.get("bpm") is not None else None

        if pred is None:
            rows.append({
                "file": rel,
                "gt_bpm": gt,
                "pred_bpm": None,
                "ok": False,
                "error": result.get("error", "detect failed"),
            })
            continue

        err = abs(pred - gt)
        err_hd = _half_double_error(pred, gt)
        abs_errors.append(err)
        hd_errors.append(err_hd)

        if err_hd <= 1:
            hit1 += 1
        if err_hd <= 2:
            hit2 += 1
        if err_hd <= 3:
            hit3 += 1
        if err_hd <= 5:
            hit5 += 1

        rows.append({
            "file": rel,
            "gt_bpm": gt,
            "pred_bpm": pred,
            "method": result.get("method"),
            "confidence": result.get("confidence"),
            "abs_error": err,
            "half_double_error": err_hd,
            "ok": True,
        })

    total = len(samples)
    detected = len(abs_errors)
    metrics = {
        "total": total,
        "detected": detected,
        "failed": total - detected,
        "mae": mean(abs_errors) if abs_errors else None,
        "mae_half_double": mean(hd_errors) if hd_errors else None,
        "hit_at_1": (hit1 / total) if total else 0.0,
        "hit_at_2": (hit2 / total) if total else 0.0,
        "hit_at_3": (hit3 / total) if total else 0.0,
        "hit_at_5": (hit5 / total) if total else 0.0,
    }

    report = {
        "method": args.method,
        "duration": args.duration,
        "metrics": metrics,
        "rows": rows,
    }

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)

    print(json.dumps(metrics, ensure_ascii=False))


if __name__ == "__main__":
    main()

