#!/usr/bin/env python3
"""Uso: python3 assemble_video.py <plan.json> <narration.wav|none> <srt|none> <output.mp4> <variant>

plan.json (gerado pela análise/roteirização): {
  "source": "input/movies/filme.mp4",
  "scenes": [{"start": 12.0, "end": 18.5}, ...]   // cenas de apoio, por ordem
}

variant: "16:9" (1920x1080) ou "9:16" (1080x1920, crop central/enquadrado).

Passos:
  1. Corta e concatena as cenas de apoio do vídeo original (sem áudio).
  2. Substitui o áudio pela narração (se fornecida), ou mantém o áudio
     original das cenas, normalizado.
  3. Escala/faz crop para o formato pedido.
  4. Queima as legendas (se um .srt for fornecido).
Nunca mexe no ficheiro de vídeo original — todo o trabalho corre em temp/.
"""
import subprocess
import sys
from pathlib import Path

from common import fail, require_binary, read_json, ROOT


def sh(cmd, step):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        fail(step, f"{' '.join(cmd)}\n{result.stderr[-3000:]}")
    return result.stdout


def main():
    if len(sys.argv) != 6:
        fail("assemble", "uso: assemble_video.py <plan.json> <narration|none> <srt|none> <output.mp4> <variant>")
    plan_path, narration, srt_path, out_path, variant = sys.argv[1:6]

    require_binary("ffmpeg")
    plan = read_json(plan_path)
    if not plan:
        fail("assemble", f"plano não encontrado: {plan_path}")

    src = Path(plan["source"])
    if not src.exists():
        fail("assemble", f"vídeo de origem não encontrado: {src}")

    scenes = plan["scenes"]
    if not scenes:
        fail("assemble", "o plano não tem cenas seleccionadas")

    temp_dir = ROOT / "temp" / Path(out_path).stem
    temp_dir.mkdir(parents=True, exist_ok=True)

    # 1. Corta cada cena de apoio para um clip individual (vídeo, sem áudio).
    clip_paths = []
    for i, scene in enumerate(scenes):
        clip = temp_dir / f"clip_{i:04d}.mp4"
        sh([
            "ffmpeg", "-y", "-ss", str(scene["start"]), "-to", str(scene["end"]),
            "-i", str(src), "-an", "-c:v", "libx264", "-preset", "veryfast",
            "-pix_fmt", "yuv420p", str(clip),
        ], "assemble-cut")
        clip_paths.append(clip)

    # 2. Concatena os clips.
    concat_list = temp_dir / "concat.txt"
    concat_list.write_text("\n".join(f"file '{c.resolve()}'" for c in clip_paths), encoding="utf-8")
    concat_video = temp_dir / "concat.mp4"
    sh([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list),
        "-c", "copy", str(concat_video),
    ], "assemble-concat")

    # 3. Formato de saída (dimensões + crop inteligente simples: centro).
    if variant == "9:16":
        vf_scale_crop = "scale=-1:1920,crop=1080:1920"
    else:
        vf_scale_crop = "scale=1920:-2,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black"

    with_audio = temp_dir / "with_audio.mp4"
    if narration and narration != "none" and Path(narration).exists():
        sh([
            "ffmpeg", "-y", "-i", str(concat_video), "-i", str(narration),
            "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
            "-c:a", "aac", "-shortest", str(with_audio),
        ], "assemble-narration")
    else:
        with_audio = concat_video

    # 4. Escala/crop + normalização de áudio + legendas queimadas (opcional).
    vf_chain = vf_scale_crop
    if srt_path and srt_path != "none" and Path(srt_path).exists():
        escaped = str(Path(srt_path).resolve()).replace(":", r"\:").replace("'", r"\'")
        vf_chain += f",subtitles='{escaped}'"

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    sh([
        "ffmpeg", "-y", "-i", str(with_audio),
        "-vf", vf_chain,
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        str(out_path),
    ], "assemble-final")

    if not Path(out_path).exists() or Path(out_path).stat().st_size == 0:
        fail("assemble", "ffmpeg não produziu o ficheiro final")

    print(f"OK video -> {out_path}")


if __name__ == "__main__":
    main()
