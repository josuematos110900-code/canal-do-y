import fs from "node:fs";
import path from "node:path";
import { paths, ensureDirs } from "./config.js";

function line(level, scope, message) {
  ensureDirs();
  const ts = new Date().toISOString();
  const text = `[${ts}] [${level}] [${scope}] ${message}`;
  const stream = level === "ERROR" ? console.error : console.log;
  stream(text);
  fs.appendFileSync(path.join(paths.logs, "pipeline.log"), text + "\n");
  return text;
}

export const logger = {
  info: (scope, message) => line("INFO", scope, message),
  warn: (scope, message) => line("WARN", scope, message),
  error: (scope, message) => line("ERROR", scope, message),
  ok: (scope, message) => line("OK", scope, message),
};
