#!/usr/bin/env python3
"""Uso: python3 thumbnail.py <video> <events.json> <output.jpg>

Escolhe um frame forte: usa o timestamp do evento de maior "importance" em
events.json (revelação, confronto, clímax, etc.) e extrai esse frame em alta
qualidade. Sem events.json, usa o frame a 40% da duração (heurística simples:
evita a abertura/créditos iniciais e finais).
"""
import sys
from pathlib import Path

from common import run, fail, require_binary, read_json, ffprobe_json


def main():
    if len(sys.argv) != 4:
        fail("thumbnail", "uso: thumbnail.py <video> <events.json|none> <output.jpg>")
    video, events_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
    require_binary("ffmpeg")

    if not Path(video).exists():
        fail("thumbnail", f"vídeo não encontrado: {video}")

    timestamp = None
    events = read_json(events_path) if events_path != "none" else None
    if events and events.get("events"):
        best = max(events["events"], key=lambda e: e.get("importance", 0))
        timestamp = float(best["time_seconds"])
    else:
        duration = float(ffprobe_json(video).get("format", {}).get("duration", 0))
        timestamp = duration * 0.4

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    run([
        "ffmpeg", "-y", "-ss", str(timestamp), "-i", str(video),
        "-frames:v", "1", "-q:v", "2", str(out_path),
    ], "thumbnail")

    if not Path(out_path).exists():
        fail("thumbnail", "ffmpeg não gerou o thumbnail")
    print(f"OK thumbnail -> {out_path} (t={timestamp:.1f}s)")


if __name__ == "__main__":
    main()
