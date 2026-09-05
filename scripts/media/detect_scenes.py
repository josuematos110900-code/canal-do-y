#!/usr/bin/env python3
"""Uso: python3 detect_scenes.py <video_de_entrada> <scenes.json> [threshold]

Deteta mudanças de cena usando o filtro `select=gt(scene,threshold)` do
FFmpeg (deteção por diferença visual entre frames) e converte os
pontos de corte numa lista de cenas [{start, end}] em segundos.

threshold: 0.0-1.0, por omissão vem de config/scene_detect_threshold
(mais alto = menos cortes detectados, só mudanças bruscas).
"""
import json
import re
import sys
from pathlib import Path

from common import run, fail, require_binary, write_json, read_json, ROOT


def get_duration(video_path):
    from common import ffprobe_json
    probe = ffprobe_json(video_path)
    return float(probe.get("format", {}).get("duration", 0.0))


def main():
    if len(sys.argv) < 3:
        fail("scene-detect", "uso: detect_scenes.py <input> <output.json> [threshold]")
    src = Path(sys.argv[1])
    out = Path(sys.argv[2])
    if not src.exists():
        fail("scene-detect", f"ficheiro não encontrado: {src}")

    cfg = read_json(ROOT / "config" / "config.json") or {}
    threshold = float(sys.argv[3]) if len(sys.argv) > 3 else cfg.get("scene_detect_threshold", 0.35)

    require_binary("ffmpeg")

    # showinfo escreve os timestamps em stderr, não stdout.
    import subprocess
    result = subprocess.run(
        ["ffmpeg", "-i", str(src), "-filter:v",
         f"select='gt(scene,{threshold})',showinfo", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    lines = result.stderr.splitlines()

    timestamps = [0.0]
    pattern = re.compile(r"pts_time:([\d.]+)")
    for line in lines:
        if "Parsed_showinfo" in line or "showinfo" in line:
            m = pattern.search(line)
            if m:
                timestamps.append(float(m.group(1)))

    duration = get_duration(src)
    timestamps.append(duration)
    timestamps = sorted(set(round(t, 3) for t in timestamps if 0 <= t <= duration))

    scenes = []
    for i in range(len(timestamps) - 1):
        start, end = timestamps[i], timestamps[i + 1]
        if end - start < 0.5:
            continue  # ignora micro-cortes de ruído
        scenes.append({
            "index": len(scenes),
            "start": start,
            "end": end,
            "duration": round(end - start, 3),
        })

    if not scenes:
        # Nenhum corte detectado (ex: vídeo muito estático) — trata o vídeo
        # inteiro como uma única cena em vez de falhar o pipeline.
        scenes = [{"index": 0, "start": 0.0, "end": duration, "duration": duration}]

    write_json(out, {"source": str(src), "threshold": threshold,
                      "duration": duration, "scenes": scenes})
    print(f"OK scenes -> {out} ({len(scenes)} cenas detectadas)")


if __name__ == "__main__":
    main()
