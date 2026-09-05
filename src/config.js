import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

dotenv.config({ path: path.join(ROOT, ".env") });

function readJson(relPath) {
  const full = path.join(ROOT, relPath);
  return JSON.parse(fs.readFileSync(full, "utf-8"));
}

export const config = readJson("config/config.json");
export const schedule = readJson("config/schedule.json");

// Africa/Luanda (WAT) is UTC+1 all year round — no daylight saving. If a
// different timezone is ever configured, fall back to a fixed-offset
// approximation and log a warning rather than silently using WAT.
const KNOWN_OFFSETS = { "Africa/Luanda": 1 };
export function utcOffsetHours() {
  if (schedule.utc_offset_hours !== undefined) return schedule.utc_offset_hours;
  if (schedule.timezone in KNOWN_OFFSETS) return KNOWN_OFFSETS[schedule.timezone];
  console.warn(
    `[config] fuso horário "${schedule.timezone}" não é um deslocamento fixo conhecido; ` +
      `assumindo UTC+0. Define "utc_offset_hours" em config/schedule.json para corrigir.`
  );
  return 0;
}

export const paths = {
  inputMovies: path.join(ROOT, "input", "movies"),
  inputAudio: path.join(ROOT, "input", "audio"),
  output: path.join(ROOT, "output"),
  outputVideos: path.join(ROOT, "output", "videos"),
  outputShorts: path.join(ROOT, "output", "shorts"),
  outputThumbnails: path.join(ROOT, "output", "thumbnails"),
  outputSubtitles: path.join(ROOT, "output", "subtitles"),
  outputScripts: path.join(ROOT, "output", "scripts"),
  outputAudio: path.join(ROOT, "output", "audio"),
  outputMetadata: path.join(ROOT, "output", "metadata"),
  analysis: path.join(ROOT, "analysis"),
  scenes: path.join(ROOT, "scenes"),
  temp: path.join(ROOT, "temp"),
  logs: path.join(ROOT, "logs"),
  data: path.join(ROOT, "data"),
  scripts: path.join(ROOT, "scripts"),
};

export function ensureDirs() {
  for (const p of Object.values(paths)) fs.mkdirSync(p, { recursive: true });
}
