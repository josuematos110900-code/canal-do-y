#!/usr/bin/env python3
"""Uso: python3 extract_audio.py <video_de_entrada> <audio_de_saida.wav>

Extrai áudio mono 16kHz (formato ideal para transcrição) sem tocar no
ficheiro original.
"""
import sys
from pathlib import Path

from common import run, fail, require_binary


def main():
    if len(sys.argv) != 3:
        fail("extract-audio", "uso: extract_audio.py <input> <output.wav>")
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    if not src.exists():
        fail("extract-audio", f"ficheiro não encontrado: {src}")

    require_binary("ffmpeg")
    out.parent.mkdir(parents=True, exist_ok=True)
    run([
        "ffmpeg", "-y", "-i", str(src),
        "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
        str(out),
    ], step="extract-audio")

    if not out.exists() or out.stat().st_size == 0:
        fail("extract-audio", "ffmpeg não produziu o ficheiro de áudio esperado")
    print(f"OK audio -> {out}")


if __name__ == "__main__":
    main()
