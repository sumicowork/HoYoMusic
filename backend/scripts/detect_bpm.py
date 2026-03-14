#!/usr/bin/env python3
import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
from typing import Optional


CANONICAL_BPM_MIN = 70.0
CANONICAL_BPM_MAX = 190.0
MIN_SEGMENT_SECONDS = 12
MAX_SEGMENT_SECONDS = 35
MAX_SEGMENTS = 5


def _emit(payload: dict, code: int = 0) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=True))
    sys.stdout.flush()
    raise SystemExit(code)


def _ffmpeg_to_wav(input_source: str, duration: int, wav_path: str, start: float = 0.0) -> None:
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        f"{max(0.0, start):.3f}",
        "-i",
        input_source,
        "-t",
        str(duration),
        "-ac",
        "1",
        "-ar",
        "22050",
        wav_path,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    if proc.returncode != 0:
        stderr = (proc.stderr or "").strip()
        raise RuntimeError(f"ffmpeg decode failed: {stderr[:300]}")


def _ffprobe_duration(input_source: str) -> Optional[float]:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        input_source,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
        if proc.returncode != 0:
            return None
        raw = (proc.stdout or "").strip()
        if not raw:
            return None
        value = float(raw)
        if math.isnan(value) or value <= 0:
            return None
        return value
    except Exception:  # noqa: BLE001
        return None


def _to_canonical_bpm(value: float) -> float:
    bpm = float(value)
    while bpm < CANONICAL_BPM_MIN:
        bpm *= 2.0
    while bpm > CANONICAL_BPM_MAX:
        bpm /= 2.0
    return bpm


def _choose_segment_starts(
    total_duration: Optional[float],
    max_seconds: int,
    segment_seconds: int,
    segment_count: int,
) -> list[float]:
    if segment_count <= 1:
        return [0.0]

    if total_duration is None:
        starts = [0.0, max(0.0, max_seconds * 0.35), max(0.0, max_seconds * 0.7)]
        return sorted(list({round(s, 3) for s in starts}))[:segment_count]

    effective_duration = min(total_duration, float(max_seconds)) if max_seconds > 0 else total_duration
    if effective_duration <= segment_seconds:
        return [0.0]

    max_start = max(0.0, effective_duration - segment_seconds)
    if segment_count == 2:
        points = [0.0, max_start]
    elif segment_count == 3:
        points = [0.0, max_start * 0.5, max_start]
    else:
        step = max_start / max(1, segment_count - 1)
        points = [i * step for i in range(segment_count)]

    deduped = sorted(list({round(max(0.0, p), 3) for p in points}))
    return deduped[:segment_count]


def _cluster_candidates(candidates: list[dict]) -> dict:
    tolerance = 3.0
    clusters: list[dict] = []

    for candidate in candidates:
        placed = False
        for cluster in clusters:
            if abs(cluster["mean"] - candidate["canonical_bpm"]) <= tolerance:
                cluster["items"].append(candidate)
                weights = [item["weight"] for item in cluster["items"]]
                values = [item["canonical_bpm"] for item in cluster["items"]]
                total_w = sum(weights)
                cluster["weight"] = total_w
                cluster["mean"] = sum(v * w for v, w in zip(values, weights)) / max(1e-6, total_w)
                placed = True
                break
        if not placed:
            clusters.append({"mean": candidate["canonical_bpm"], "weight": candidate["weight"], "items": [candidate]})

    if not clusters:
        return {}

    clusters.sort(key=lambda x: x["weight"], reverse=True)
    best = clusters[0]

    vals = [item["canonical_bpm"] for item in best["items"]]
    weights = [item["weight"] for item in best["items"]]
    mean = best["mean"]
    variance = sum(w * ((v - mean) ** 2) for v, w in zip(vals, weights)) / max(1e-6, sum(weights))
    std = math.sqrt(max(0.0, variance))

    method_weights = {"essentia": 0.0, "librosa": 0.0}
    for item in best["items"]:
        method_weights[item["method"]] += item["weight"]

    method = "essentia" if method_weights["essentia"] >= method_weights["librosa"] else "librosa"
    total_weight = sum(c["weight"] for c in candidates)
    support = best["weight"] / max(1e-6, total_weight)
    stability = max(0.05, min(0.99, 1.0 - (std / 12.0)))
    confidence = max(0.05, min(0.99, support * 0.7 + stability * 0.3))

    return {
        "bpm": round(mean, 3),
        "confidence": confidence,
        "method": method,
        "support": support,
        "stability": stability,
        "candidate_count": len(candidates),
        "cluster_count": len(clusters),
    }


def _analyze_with_librosa(wav_path: str) -> tuple[Optional[float], Optional[float]]:
    import numpy as np  # type: ignore
    import librosa  # type: ignore

    y, sr = librosa.load(wav_path, sr=22050, mono=True)
    if y is None or len(y) == 0:
        return None, None

    # Separate harmonic/percussive parts; tempo estimation works better on percussive energy.
    _, y_percussive = librosa.effects.hpss(y)
    onset_env = librosa.onset.onset_strength(y=y_percussive, sr=sr)
    if onset_env is None or len(onset_env) == 0:
        return None, None

    tempo, beat_frames = librosa.beat.beat_track(y=y_percussive, sr=sr)
    value = float(tempo) if tempo is not None else None
    if not value or value <= 0:
        return None, None

    confidence: Optional[float]
    if beat_frames is None or len(beat_frames) < 4:
        confidence = 0.35
    else:
        intervals = np.diff(beat_frames)
        mean_interval = float(np.mean(intervals)) if len(intervals) > 0 else 0.0
        if mean_interval <= 0:
            confidence = 0.2
        else:
            cv = float(np.std(intervals) / mean_interval)
            confidence = max(0.05, min(0.95, 1.0 - cv))

    return value, confidence


def _analyze_with_essentia(wav_path: str) -> tuple[Optional[float], Optional[float]]:
    from essentia.standard import MonoLoader, RhythmExtractor2013  # type: ignore

    audio = MonoLoader(filename=wav_path, sampleRate=22050)()
    if audio is None or len(audio) == 0:
        return None, None

    extractor = RhythmExtractor2013(method="multifeature")
    bpm, _, confidence, _, _ = extractor(audio)
    value = float(bpm)
    if value <= 0:
        return None, None

    conf = None
    try:
        conf = float(confidence)
    except Exception:  # noqa: BLE001
        conf = None

    if conf is not None:
        conf = max(0.0, min(1.0, conf))

    return value, conf


def detect_bpm(input_source: str, method: str, duration: int) -> dict:
    if not input_source:
        return {"ok": False, "error": "empty input"}

    if not (input_source.startswith("http://") or input_source.startswith("https://")):
        if not os.path.exists(input_source):
            return {"ok": False, "error": "input file does not exist"}

    max_seconds = max(20, duration)
    segment_count = min(MAX_SEGMENTS, max(2, max_seconds // 40))
    segment_seconds = min(MAX_SEGMENT_SECONDS, max(MIN_SEGMENT_SECONDS, max_seconds // max(1, segment_count)))
    total_duration = _ffprobe_duration(input_source)
    starts = _choose_segment_starts(total_duration, max_seconds, segment_seconds, segment_count)

    methods = [method] if method in ("librosa", "essentia") else ["essentia", "librosa"]
    method_weight = {"essentia": 1.0, "librosa": 0.9}

    candidates: list[dict] = []
    errors = []

    for start in starts:
        fd, wav_path = tempfile.mkstemp(prefix="hoyomusic_bpm_", suffix=".wav")
        os.close(fd)
        try:
            _ffmpeg_to_wav(input_source, segment_seconds, wav_path, start=start)

            for current in methods:
                try:
                    if current == "essentia":
                        bpm, confidence = _analyze_with_essentia(wav_path)
                    else:
                        bpm, confidence = _analyze_with_librosa(wav_path)

                    if not bpm:
                        continue

                    canonical = _to_canonical_bpm(float(bpm))
                    conf = 0.45 if confidence is None else float(max(0.01, min(0.99, confidence)))
                    candidates.append(
                        {
                            "method": current,
                            "start": start,
                            "raw_bpm": float(bpm),
                            "canonical_bpm": canonical,
                            "confidence": conf,
                            "weight": conf * method_weight.get(current, 1.0),
                        }
                    )
                except Exception as exc:  # noqa: BLE001
                    errors.append(f"{current}@{start:.1f}s: {exc}")
        except Exception as exc:  # noqa: BLE001
            errors.append(f"decode@{start:.1f}s: {exc}")
        finally:
            try:
                os.remove(wav_path)
            except OSError:
                pass

    if not candidates:
        return {
            "ok": False,
            "error": "no bpm detected",
            "details": errors,
            "segments": starts,
        }

    consensus = _cluster_candidates(candidates)
    if not consensus:
        return {
            "ok": False,
            "error": "consensus failed",
            "details": errors,
            "segments": starts,
        }

    return {
        "ok": True,
        "bpm": consensus["bpm"],
        "method": consensus["method"],
        "confidence": consensus["confidence"],
        "support": consensus["support"],
        "stability": consensus["stability"],
        "segment_count": len(starts),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="HoYoMusic BPM detector")
    parser.add_argument("--input", required=True, help="Audio file path or URL")
    parser.add_argument("--method", default="auto", choices=["auto", "librosa", "essentia"])
    parser.add_argument("--duration", type=int, default=120, help="Max seconds budget for analysis")
    args = parser.parse_args()

    result = detect_bpm(args.input, args.method, args.duration)
    _emit(result, 0 if result.get("ok") else 1)


if __name__ == "__main__":
    main()

