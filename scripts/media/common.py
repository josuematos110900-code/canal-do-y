import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def fail(step, message):
    sys.stderr.write(f"[{step}] ERROR: {message}\n")
    sys.exit(1)


def require_binary(name):
    if shutil.which(name) is None:
        fail("dependency-check", f"'{name}' não encontrado no PATH.")


def run(cmd, step="ffmpeg"):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        fail(step, f"comando falhou: {' '.join(cmd)}\n{result.stderr[-3000:]}")
    return result.stdout


def ffprobe_json(path):
    require_binary("ffprobe")
    out = run([
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_format", "-show_streams", str(path),
    ], step="ffprobe")
    return json.loads(out)


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def read_json(path):
    path = Path(path)
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)
