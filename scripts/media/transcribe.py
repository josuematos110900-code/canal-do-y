#!/usr/bin/env python3
"""Uso: python3 transcribe.py <audio.wav> <transcript.json> <transcript.srt>

Estratégia (por ordem de preferência):
  1. faster-whisper local, se instalado (pip install faster-whisper) — sem
     custo por chamada, corre offline.
  2. OpenAI Whisper API (whisper-1), se OPENAI_API_KEY estiver definido.

Se nenhum dos dois estiver disponível, falha com uma mensagem clara —
nunca inventa uma transcrição.
"""
import json
import os
import sys
from pathlib import Path

from common import fail, write_json, ROOT, read_json


def seconds_to_srt(t):
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = int(t % 60)
    ms = int(round((t - int(t)) * 1000))
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(segments, out_path):
    lines = []
    for i, seg in enumerate(segments, start=1):
        lines.append(str(i))
        lines.append(f"{seconds_to_srt(seg['start'])} --> {seconds_to_srt(seg['end'])}")
        lines.append(seg["text"].strip())
        lines.append("")
    Path(out_path).write_text("\n".join(lines), encoding="utf-8")


def try_faster_whisper(audio_path, language, model_size):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return None

    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments_iter, info = model.transcribe(str(audio_path), language=language or None)
    segments = [
        {"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text}
        for s in segments_iter
    ]
    return segments


def try_openai_api(audio_path, language):
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        import urllib.request
        import uuid
    except ImportError:
        return None

    boundary = uuid.uuid4().hex
    with open(audio_path, "rb") as f:
        audio_bytes = f.read()

    body = bytearray()

    def add_field(name, value):
        body.extend(f"--{boundary}\r\n".encode())
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        body.extend(f"{value}\r\n".encode())

    add_field("model", "whisper-1")
    add_field("response_format", "verbose_json")
    if language:
        add_field("language", language.split("-")[0])

    body.extend(f"--{boundary}\r\n".encode())
    body.extend(
        f'Content-Disposition: form-data; name="file"; filename="{Path(audio_path).name}"\r\n'
        f"Content-Type: audio/wav\r\n\r\n".encode()
    )
    body.extend(audio_bytes)
    body.extend(f"\r\n--{boundary}--\r\n".encode())

    req = urllib.request.Request(
        "https://api.openai.com/v1/audio/transcriptions",
        data=bytes(body),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            payload = json.loads(resp.read().decode())
    except Exception as exc:  # noqa: BLE001 — reportado ao chamador como falha clara
        fail("transcribe", f"chamada à OpenAI Whisper API falhou: {exc}")

    segments = [
        {"start": round(s["start"], 3), "end": round(s["end"], 3), "text": s["text"]}
        for s in payload.get("segments", [])
    ]
    if not segments and payload.get("text"):
        segments = [{"start": 0.0, "end": 0.0, "text": payload["text"]}]
    return segments


def main():
    if len(sys.argv) != 4:
        fail("transcribe", "uso: transcribe.py <audio.wav> <transcript.json> <transcript.srt>")
    audio_path, out_json, out_srt = sys.argv[1], sys.argv[2], sys.argv[3]
    if not Path(audio_path).exists():
        fail("transcribe", f"áudio não encontrado: {audio_path}")

    cfg = read_json(ROOT / "config" / "config.json") or {}
    language = cfg.get("language", "pt")
    model_size = cfg.get("whisper_model", "small")

    segments = try_faster_whisper(audio_path, language, model_size)
    engine = "faster-whisper (local)"
    if segments is None:
        segments = try_openai_api(audio_path, language)
        engine = "openai-whisper-api"

    if segments is None:
        fail(
            "transcribe",
            "nenhum motor de transcrição disponível. Instala 'faster-whisper' "
            "(pip install faster-whisper) ou define OPENAI_API_KEY no .env.",
        )

    write_json(out_json, {"engine": engine, "language": language, "segments": segments})
    write_srt(segments, out_srt)
    print(f"OK transcript ({engine}) -> {out_json}, {out_srt}")


if __name__ == "__main__":
    main()
