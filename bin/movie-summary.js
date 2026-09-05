#!/usr/bin/env node
import { Command } from "commander";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ensureDirs, ROOT, paths, schedule } from "../src/config.js";
import { logger } from "../src/logger.js";
import {
  upsertMovie, createJob, listJobs, readyQueue, db, updateJob,
} from "../src/db.js";
import { runPipeline } from "../src/pipeline/run.js";
import { startWorker, retryFailedJobs } from "../src/worker.js";
import { nextAvailableSlots } from "../src/scheduler.js";
import { uploadAndSchedule } from "../src/youtube/upload.js";
import { schedulePublication } from "../src/db.js";

ensureDirs();

const program = new Command();
program.name("movie-summary").description("Automação de resumos de filmes para YouTube");

function checkEnv() {
  const results = [];
  const checkBinary = (name) => {
    try {
      execFileSync(name, ["-version"], { stdio: "ignore" });
      results.push([name, true]);
    } catch {
      results.push([name, false]);
    }
  };
  checkBinary("ffmpeg");
  checkBinary("ffprobe");
  results.push(["python3", (() => {
    try { execFileSync("python3", ["--version"], { stdio: "ignore" }); return true; } catch { return false; }
  })()]);
  results.push(["ANTHROPIC_API_KEY (análise/roteiro/SEO)", Boolean(process.env.ANTHROPIC_API_KEY)]);
  results.push(["OPENAI_API_KEY ou faster-whisper (transcrição)", Boolean(process.env.OPENAI_API_KEY)]);
  results.push(["TTS: ELEVENLABS_API_KEY/OPENAI_API_KEY", Boolean(process.env.ELEVENLABS_API_KEY || process.env.OPENAI_API_KEY)]);
  results.push(["YouTube: YOUTUBE_REFRESH_TOKEN", Boolean(process.env.YOUTUBE_REFRESH_TOKEN)]);

  console.log("\nVerificação do ambiente:\n");
  for (const [name, ok] of results) {
    console.log(`  [${ok ? "OK" : "EM FALTA"}] ${name}`);
  }
  console.log("");
  return results;
}

function movieFromArg(inputPath) {
  if (!inputPath) throw new Error("indica o caminho do vídeo, ex: input/movies/filme.mp4");
  const full = path.resolve(inputPath);
  if (!fs.existsSync(full)) throw new Error(`ficheiro não encontrado: ${full}`);
  const slug = path.basename(full, path.extname(full));
  const movie = upsertMovie({ slug, sourcePath: full });
  return movie;
}

program
  .argument("[input]", "vídeo de entrada (ex: input/movies/filme.mp4)")
  .option("--short", "resumo curto (~30-60s)")
  .option("--medium", "resumo intermédio (~2-5min)")
  .option("--full", "resumo completo (~5-15min)")
  .option("--auto", "escolhe a duração automaticamente (padrão)")
  .option("--analyze", "só metadata + transcrição + cenas + eventos")
  .option("--script", "só gera o roteiro (requer análise prévia)")
  .option("--voice", "só gera a narração (requer roteiro)")
  .option("--captions", "só gera legendas")
  .option("--edit", "só monta o vídeo final")
  .option("--seo", "só gera título/descrição/keywords/hashtags")
  .option("--thumbnail", "só gera o thumbnail")
  .option("--batch <dir>", "processa todos os vídeos de uma pasta")
  .option("--report", "gera output/report.md com o estado de todos os jobs")
  .option("--watch", "modo automático: monitoriza input/movies/ continuamente")
  .option("--autonomous", "watcher + fila + worker + publicação automática no YouTube")
  .option("--queue", "mostra a fila")
  .option("--status", "mostra o estado dos jobs")
  .option("--publish", "publica (agenda no YouTube) todos os jobs READY")
  .option("--schedule", "mostra/calcula os próximos slots de publicação")
  .option("--retry", "repõe jobs FAILED em PENDING")
  .option("--check-env", "verifica dependências e chaves configuradas")
  .action(async (input, opts) => {
    try {
      if (opts.checkEnv) return void checkEnv();
      if (opts.queue) return void printQueue();
      if (opts.status) return void printStatus();
      if (opts.retry) return void console.log(`${await retryFailedJobs()} job(s) repostos em PENDING.`);
      if (opts.schedule) return void printSchedule();
      if (opts.report) return void generateReport();
      if (opts.publish) return void (await publishReadyJobs());
      if (opts.watch) return void startWorker({ autoPublish: false });
      if (opts.autonomous) return void startWorker({ autoPublish: true });
      if (opts.batch) return void (await runBatch(opts.batch, opts));

      if (!input) {
        program.help();
        return;
      }

      const mode = opts.short ? "short" : opts.medium ? "medium" : opts.full ? "full" : "auto";
      const movie = movieFromArg(input);
      const job = createJob(movie.id, mode);
      logger.info(`job#${job.id}`, `pipeline completo para "${movie.slug}" (modo=${mode})`);
      const result = await runPipeline(job, movie, { mode, autoPublish: false });
      console.log("\nConcluído:");
      console.log(`  vídeo:     ${result.finalVideo}`);
      if (result.shortVideo) console.log(`  short:     ${result.shortVideo}`);
      console.log(`  thumbnail: ${result.thumbPath}`);
      console.log(`  título:    ${result.seo.title}`);
    } catch (err) {
      logger.error("cli", err.stack || err.message);
      process.exitCode = 1;
    }
  });

function printQueue() {
  const jobs = listJobs();
  if (jobs.length === 0) return console.log("Fila vazia.");
  console.log("\nFila:\n");
  for (const j of jobs) {
    console.log(`  ${String(j.id).padStart(3, "0")} → ${j.slug} → ${j.status}${j.last_error ? ` (${j.last_error.slice(0, 80)})` : ""}`);
  }
}

function printStatus() {
  const jobs = listJobs();
  const byStatus = {};
  for (const j of jobs) byStatus[j.status] = (byStatus[j.status] || 0) + 1;
  console.log("\nEstado dos jobs:\n");
  for (const [status, count] of Object.entries(byStatus)) console.log(`  ${status}: ${count}`);
}

function printSchedule() {
  const slots = nextAvailableSlots(readyQueue().length || Number(schedule.posts_per_week) || 2);
  console.log("\nPróximos slots de publicação disponíveis:\n");
  for (const iso of slots) console.log(`  ${iso}`);
}

async function publishReadyJobs() {
  const { buildSeo } = await import("../src/pipeline/seo.js");
  const ready = readyQueue();
  if (ready.length === 0) return console.log("Nenhum job em READY.");
  const slots = nextAvailableSlots(ready.length);

  for (let i = 0; i < ready.length; i++) {
    const job = ready[i];
    const movie = db.prepare("SELECT * FROM movies WHERE id = ?").get(job.movie_id);
    const metaPath = path.join(paths.outputMetadata, `${movie.slug}.json`);
    const finalVideo = path.join(paths.outputVideos, `${movie.slug}-resumo.mp4`);
    const thumbPath = path.join(paths.outputThumbnails, `${movie.slug}.jpg`);
    if (!fs.existsSync(metaPath) || !fs.existsSync(finalVideo)) {
      console.log(`  [SKIP] ${movie.slug}: ficheiros de saída em falta`);
      continue;
    }
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    updateJob(job.id, { status: "UPLOADING", step: "manual_publish" });
    try {
      const result = await uploadAndSchedule({
        videoPath: finalVideo,
        thumbnailPath: thumbPath,
        title: meta.title,
        description: meta.description,
        tags: meta.keywords,
        publishAtIso: slots[i],
      });
      schedulePublication(job.id, { title: meta.title, publishAt: result.publishAt, privacyStatus: "private" });
      updateJob(job.id, { status: "SCHEDULED", step: `youtube_video_id=${result.videoId}` });
      console.log(`  [OK] ${movie.slug} → agendado para ${result.publishAt} (videoId=${result.videoId})`);
    } catch (err) {
      updateJob(job.id, { status: "READY", last_error: err.message });
      console.log(`  [FALHOU] ${movie.slug}: ${err.message}`);
    }
  }
}

async function runBatch(dir, opts) {
  const full = path.resolve(dir);
  const files = fs.readdirSync(full).filter((f) => /\.(mp4|mkv|mov|avi|webm)$/i.test(f));
  console.log(`Batch: ${files.length} ficheiro(s) em ${full}`);
  const mode = opts.short ? "short" : opts.medium ? "medium" : opts.full ? "full" : "auto";
  for (const f of files) {
    try {
      const movie = movieFromArg(path.join(full, f));
      const job = createJob(movie.id, mode);
      await runPipeline(job, movie, { mode, autoPublish: false });
      console.log(`  [OK] ${f}`);
    } catch (err) {
      console.log(`  [FALHOU] ${f}: ${err.message}`);
    }
  }
}

function generateReport() {
  const jobs = listJobs();
  const lines = ["# MOVIE SUMMARY — RELATÓRIO", ""];
  for (const j of jobs) {
    lines.push(`## ${j.slug}`, "", `- Status: ${j.status}`, `- Etapa: ${j.step ?? "-"}`,
      `- Tentativas: ${j.attempts}/${j.max_attempts}`,
      j.last_error ? `- Último erro: ${j.last_error}` : "", "");
  }
  const reportPath = path.join(paths.output, "report.md");
  fs.writeFileSync(reportPath, lines.join("\n"));
  console.log(`Relatório escrito em ${reportPath}`);
}

program.parseAsync(process.argv);
