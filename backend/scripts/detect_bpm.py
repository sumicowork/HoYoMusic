#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
import sys
import tempfile
from typing import Optional


def _emit(payload: dict, code: int = 0) -> None:
    sys.stdout.write(json.dumps(payload, ensure_ascii=True))
    sys.stdout.flush()
    raise SystemExit(code)


def _ffmpeg_to_wav(input_source: str, duration: int, wav_path: str) -> None:
    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
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


def _analyze_with_librosa(wav_path: str) -> tuple[Optional[float], Optional[float]]:
    import numpy as np  # type: ignore
    import librosa  # type: ignore

    y, sr = librosa.load(wav_path, sr=22050, mono=True)
    if y is None or len(y) == 0:
        return None, None
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    if onset_env is None or len(onset_env) == 0:
        return None, None

    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
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

    fd, wav_path = tempfile.mkstemp(prefix="hoyomusic_bpm_", suffix=".wav")
    os.close(fd)

    try:
        _ffmpeg_to_wav(input_source, duration, wav_path)

        errors = []
        methods = [method] if method in ("librosa", "essentia") else ["essentia", "librosa"]
        for current in methods:
            try:
                if current == "essentia":
                    bpm, confidence = _analyze_with_essentia(wav_path)
                else:
                    bpm, confidence = _analyze_with_librosa(wav_path)
                if bpm:
                    return {
                        "ok": True,
                        "bpm": bpm,
                        "method": current,
                        "confidence": confidence,
                    }
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{current}: {exc}")

        return {"ok": False, "error": "no bpm detected", "details": errors}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}
    finally:
        try:
            os.remove(wav_path)
        except OSError:
            pass


def main() -> None:
    parser = argparse.ArgumentParser(description="HoYoMusic BPM detector")
    parser.add_argument("--input", required=True, help="Audio file path or URL")
    parser.add_argument("--method", default="auto", choices=["auto", "librosa", "essentia"])
    parser.add_argument("--duration", type=int, default=120, help="Seconds to analyze from start")
    args = parser.parse_args()

    result = detect_bpm(args.input, args.method, args.duration)
    _emit(result, 0 if result.get("ok") else 1)


if __name__ == "__main__":
    main()

