#!/usr/bin/env python3
"""
Uso: python3 metadata.py <video_de_entrada> <ficheiro_json_de_saida>

Extrai metadados técnicos com ffprobe e valida que o ficheiro pode ser
processado (existe, abre, tem stream de vídeo, etc.). Nunca assume sucesso —
sai com código != 0 e escreve o motivo em stderr se algo falhar.
"""
import sys
from pathlib import Path

from common import ffprobe_json, write_json, fail, require_binary


def main():
    if len(sys.argv) != 3:
        fail("metadata", "uso: metadata.py <input> <output.json>")
    src = Path(sys.argv[1])
    out = Path(sys.argv[2])

    if not src.exists():
        fail("metadata", f"ficheiro não encontrado: {src}")
    if src.stat().st_size == 0:
        fail("metadata", f"ficheiro vazio: {src}")

    require_binary("ffprobe")
    probe = ffprobe_json(src)

    video_streams = [s for s in probe.get("streams", []) if s.get("codec_type") == "video"]
    audio_streams = [s for s in probe.get("streams", []) if s.get("codec_type") == "audio"]

    if not video_streams:
        fail("metadata", f"nenhum stream de vídeo encontrado em {src} — ficheiro pode estar corrompido")

    v = video_streams[0]
    fmt = probe.get("format", {})

    def to_float(x, default=0.0):
        try:
            return float(x)
        except (TypeError, ValueError):
            return default

    fps = 0.0
    if "/" in str(v.get("r_frame_rate", "")):
        num, den = v["r_frame_rate"].split("/")
        fps = to_float(num) / to_float(den, 1.0) if to_float(den, 1.0) else 0.0

    info = {
        "filename": src.name,
        "path": str(src.resolve()),
        "duration": to_float(fmt.get("duration")),
        "width": int(v.get("width", 0)),
        "height": int(v.get("height", 0)),
        "fps": round(fps, 3),
        "video_codec": v.get("codec_name"),
        "audio_codec": audio_streams[0].get("codec_name") if audio_streams else None,
        "bitrate": int(fmt.get("bit_rate", 0)) if fmt.get("bit_rate") else None,
        "has_audio": bool(audio_streams),
        "sample_rate": int(audio_streams[0].get("sample_rate", 0)) if audio_streams else None,
        "channels": audio_streams[0].get("channels") if audio_streams else None,
        "size_bytes": src.stat().st_size,
    }

    if info["duration"] <= 0:
        fail("metadata", "duração inválida/zero — ficheiro pode estar corrompido")
    if not info["has_audio"]:
        fail("metadata", "vídeo sem faixa de áudio — necessária para transcrição")

    write_json(out, info)
    print(f"OK metadata -> {out}")


if __name__ == "__main__":
    main()
