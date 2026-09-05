import { db, pendingQueue, updateJob, logEvent } from "./db.js";
import { logger } from "./logger.js";
import { watchInputFolder } from "./watcher.js";
import { runPipeline } from "./pipeline/run.js";
import { config } from "./config.js";

let processing = false;

async function processNextJob(opts) {
  if (processing) return; // um job de cada vez — simples e previsível
  const queue = pendingQueue().filter((j) => j.status !== "READY" && j.status !== "SCHEDULED");
  const job = queue[0];
  if (!job) return;

  processing = true;
  try {
    const movie = db.prepare("SELECT * FROM movies WHERE id = ?").get(job.movie_id);
    logger.info(`job#${job.id}`, `a processar "${movie.slug}" (tentativa ${job.attempts + 1}/${job.max_attempts})`);
    await runPipeline(job, movie, {
      mode: job.mode,
      autoPublish: opts.autoPublish,
      generateShort: config.generate_short,
    });
    logger.ok(`job#${job.id}`, `pipeline concluído para "${movie.slug}"`);
  } catch (err) {
    const attempts = job.attempts + 1;
    const message = err.message || String(err);
    logEvent(job.id, "ERROR", job.step, message);
    logger.error(`job#${job.id}`, `falhou: ${message}`);
    if (attempts >= job.max_attempts) {
      updateJob(job.id, { status: "FAILED", attempts, last_error: message });
      logger.error(`job#${job.id}`, `FAILED definitivo após ${attempts} tentativas`);
    } else {
      updateJob(job.id, { status: "PENDING", attempts, last_error: message });
      logger.warn(`job#${job.id}`, `voltará a ser tentado (${attempts}/${job.max_attempts})`);
    }
  } finally {
    processing = false;
  }
}

/**
 * Loop autónomo: monitoriza a pasta de entrada, processa a fila em ordem,
 * e (se autoPublish) publica agendado no YouTube. Corre indefinidamente —
 * pensado para um `pm2 start` / `systemd` / container que fique sempre ligado.
 */
export function startWorker({ autoPublish = false, pollIntervalMs = 20000, watchIntervalMs = 15000 } = {}) {
  logger.info("worker", `modo autónomo iniciado (autoPublish=${autoPublish})`);
  const stopWatching = watchInputFolder({ intervalMs: watchIntervalMs });

  const timer = setInterval(() => {
    processNextJob({ autoPublish }).catch((err) => logger.error("worker", err.stack || err.message));
  }, pollIntervalMs);

  processNextJob({ autoPublish }).catch((err) => logger.error("worker", err.stack || err.message));

  return () => {
    stopWatching();
    clearInterval(timer);
  };
}

export async function retryFailedJobs() {
  const failed = db.prepare("SELECT * FROM jobs WHERE status = 'FAILED'").all();
  for (const job of failed) {
    updateJob(job.id, { status: "PENDING", attempts: 0, last_error: null });
    logger.info(`job#${job.id}`, "reposto em PENDING para nova tentativa");
  }
  return failed.length;
}
