import fs from "node:fs";
import path from "node:path";
import { paths } from "./config.js";
import { logger } from "./logger.js";
import { upsertMovie, createJob, getJobBySlug } from "./db.js";

const VIDEO_EXTENSIONS = new Set([".mp4", ".mkv", ".mov", ".avi", ".webm"]);

/**
 * Polling seguro da pasta input/movies/: em vez de reagir ao primeiro evento
 * do filesystem (que dispara a meio de uma cópia longa), só considera um
 * ficheiro "novo e pronto" quando o seu tamanho fica estável entre duas
 * verificações consecutivas. Mais robusto do que fs.watch para uploads
 * grandes e funciona da mesma forma em qualquer SO.
 */
export function watchInputFolder({ intervalMs = 15000, onNewMovie } = {}) {
  fs.mkdirSync(paths.inputMovies, { recursive: true });
  const lastSizes = new Map();

  async function tick() {
    let entries;
    try {
      entries = fs.readdirSync(paths.inputMovies);
    } catch (err) {
      logger.error("watcher", `não consegui ler ${paths.inputMovies}: ${err.message}`);
      return;
    }

    for (const name of entries) {
      const ext = path.extname(name).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(ext)) continue;
      const fullPath = path.join(paths.inputMovies, name);
      let size;
      try {
        size = fs.statSync(fullPath).size;
      } catch {
        continue;
      }

      const slug = path.basename(name, ext);
      const alreadyQueued = getJobBySlug(slug);
      if (alreadyQueued) continue;

      const prevSize = lastSizes.get(name);
      lastSizes.set(name, size);

      if (prevSize !== undefined && prevSize === size && size > 0) {
        logger.info("watcher", `novo vídeo estável detectado: ${name}`);
        const movie = upsertMovie({ slug, sourcePath: fullPath });
        const job = createJob(movie.id);
        lastSizes.delete(name);
        if (onNewMovie) await onNewMovie({ movie, job });
      }
    }
  }

  const timer = setInterval(() => {
    tick().catch((err) => logger.error("watcher", err.stack || err.message));
  }, intervalMs);

  logger.info("watcher", `a monitorizar ${paths.inputMovies} a cada ${intervalMs / 1000}s`);
  tick().catch((err) => logger.error("watcher", err.stack || err.message));

  return () => clearInterval(timer);
}
