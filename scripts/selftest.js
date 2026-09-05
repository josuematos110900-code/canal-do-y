#!/usr/bin/env node
/**
 * Testes de fumo que NÃO precisam de chaves de API e NÃO fazem nenhum
 * upload real ao YouTube: geram um vídeo sintético com o próprio ffmpeg e
 * verificam metadata, extracção de áudio, deteção de cenas, montagem de
 * vídeo, o scheduler (2x/semana, Africa/Luanda, sem colisões), o watcher
 * (não processa ficheiros a meio de cópia), a fila/DB e o retry.
 * Corre com: npm test
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { ROOT, paths, ensureDirs } from "../src/config.js";
import { nextAvailableSlot, nextAvailableSlots } from "../src/scheduler.js";
import {
  upsertMovie, createJob, getJobBySlug, updateJob, listJobs, db,
} from "../src/db.js";
import { scanOnce } from "../src/watcher.js";
import { retryFailedJobs } from "../src/worker.js";
import { uploadAndSchedule } from "../src/youtube/upload.js";

ensureDirs();
let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    console.log(`  [OK] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FALHOU] ${name}: ${err.message}`);
    failures.push(name);
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    console.log(`  [OK] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FALHOU] ${name}: ${err.message}`);
    failures.push(name);
  }
}

console.log("\n== movie-summary selftest ==\n");

console.log("-- Scheduler --");
check("próximo slot cai numa terça ou sexta às 17:00 UTC (18:00 Africa/Luanda)", () => {
  const iso = nextAvailableSlot();
  const d = new Date(iso);
  const day = d.getUTCDay(); // 2=terça, 5=sexta
  assert.ok(day === 2 || day === 5, `dia da semana inesperado: ${day}`);
  assert.equal(d.getUTCHours(), 17);
  assert.equal(d.getUTCMinutes(), 0);
});

check("4 vídeos em fila alternam terça/sexta/terça/sexta sem colisões", () => {
  const slots = nextAvailableSlots(4);
  assert.equal(slots.length, 4);
  assert.equal(new Set(slots).size, 4, "slots devem ser todos diferentes");
  const days = slots.map((s) => new Date(s).getUTCDay());
  assert.deepEqual(days, [days[0], days[0] === 2 ? 5 : 2, days[0], days[0] === 2 ? 5 : 2]);
  for (let i = 1; i < slots.length; i++) {
    assert.ok(new Date(slots[i]) > new Date(slots[i - 1]), "slots devem estar em ordem crescente");
  }
});

console.log("\n-- Fila / DB --");
check("cria filme + job e evita duplicar job para o mesmo slug", () => {
  const slug = `selftest-${Date.now()}`;
  const movie = upsertMovie({ slug, sourcePath: "/tmp/fake.mp4" });
  const job = createJob(movie.id);
  assert.equal(job.status, "PENDING");
  const found = getJobBySlug(slug);
  assert.equal(found.id, job.id);
  updateJob(job.id, { status: "READY" });
  const jobs = listJobs("READY").filter((j) => j.slug === slug);
  assert.equal(jobs.length, 1);
});

console.log("\n-- Retry --");
check("retryFailedJobs repõe FAILED em PENDING e zera as tentativas", async () => {
  const slug = `selftest-retry-${Date.now()}`;
  const movie = upsertMovie({ slug, sourcePath: "/tmp/fake-retry.mp4" });
  const job = createJob(movie.id);
  updateJob(job.id, { status: "FAILED", attempts: 3, last_error: "erro simulado" });
  const count = await retryFailedJobs();
  assert.ok(count >= 1);
  const after = db.prepare("SELECT * FROM jobs WHERE id = ?").get(job.id);
  assert.equal(after.status, "PENDING");
  assert.equal(after.attempts, 0);
});

console.log("\n-- Watcher (não processa ficheiro a meio de cópia) --");
check("ficheiro a crescer NÃO é detectado; ficheiro estável É detectado", () => {
  const name = `selftest-watch-${Date.now()}.mp4`;
  const full = path.join(paths.inputMovies, name);
  fs.writeFileSync(full, Buffer.alloc(100));
  let created = scanOnce(); // 1ª verificação: regista o tamanho, ainda não decide
  assert.equal(created.filter((c) => c.movie.slug === path.parse(name).name).length, 0);

  fs.writeFileSync(full, Buffer.alloc(500)); // "cresceu" — simula cópia em curso
  created = scanOnce();
  assert.equal(created.length, 0, "não deve criar job enquanto o tamanho ainda muda");

  created = scanOnce(); // tamanho agora estável (500 == 500 desde a verificação anterior)
  const match = created.find((c) => c.movie.slug === path.parse(name).name);
  assert.ok(match, "deve criar job assim que o tamanho estabiliza");

  fs.unlinkSync(full);
});

console.log("\n-- YouTube (sem upload real) --");
await checkAsync("uploadAndSchedule falha de forma clara sem credenciais configuradas", async () => {
  const savedEnv = { ...process.env };
  delete process.env.YOUTUBE_CLIENT_ID;
  delete process.env.YOUTUBE_CLIENT_SECRET;
  delete process.env.YOUTUBE_REFRESH_TOKEN;
  try {
    await uploadAndSchedule({
      videoPath: "/tmp/nao-existe.mp4",
      thumbnailPath: null,
      title: "t",
      description: "d",
      tags: [],
      publishAtIso: new Date(Date.now() + 86400000).toISOString(),
    });
    throw new Error("devia ter lançado erro — nenhuma chamada de rede foi feita");
  } catch (err) {
    assert.match(err.message, /YouTube não configurado/);
  } finally {
    process.env = savedEnv;
  }
});

console.log("\n-- FFmpeg / metadata / áudio / cenas / montagem (vídeo sintético) --");
const sample = path.join(paths.temp, "selftest-sample.mp4");
try {
  execFileSync("ffmpeg", [
    "-y", "-f", "lavfi", "-i", "testsrc=duration=4:size=320x240:rate=10",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=4",
    "-shortest", "-pix_fmt", "yuv420p", sample,
  ], { stdio: "ignore" });

  check("vídeo sintético de teste foi gerado", () => {
    assert.ok(fs.existsSync(sample) && fs.statSync(sample).size > 0);
  });

  check("metadata.py: extrai duração/resolução do vídeo sintético", () => {
    const out = path.join(paths.temp, "selftest-metadata.json");
    execFileSync("python3", [path.join(ROOT, "scripts", "media", "metadata.py"), sample, out], {
      cwd: path.join(ROOT, "scripts", "media"),
    });
    const meta = JSON.parse(fs.readFileSync(out, "utf-8"));
    assert.equal(meta.width, 320);
    assert.equal(meta.height, 240);
    assert.ok(meta.duration >= 3.5 && meta.duration <= 4.5);
  });

  check("extract_audio.py: produz um .wav não vazio", () => {
    const out = path.join(paths.temp, "selftest-audio.wav");
    execFileSync("python3", [path.join(ROOT, "scripts", "media", "extract_audio.py"), sample, out], {
      cwd: path.join(ROOT, "scripts", "media"),
    });
    assert.ok(fs.existsSync(out) && fs.statSync(out).size > 0);
  });

  let scenesData;
  check("detect_scenes.py: devolve pelo menos uma cena cobrindo todo o vídeo", () => {
    const out = path.join(paths.temp, "selftest-scenes.json");
    execFileSync("python3", [path.join(ROOT, "scripts", "media", "detect_scenes.py"), sample, out], {
      cwd: path.join(ROOT, "scripts", "media"),
    });
    scenesData = JSON.parse(fs.readFileSync(out, "utf-8"));
    assert.ok(scenesData.scenes.length >= 1);
    assert.ok(Math.abs(scenesData.scenes.at(-1).end - scenesData.duration) < 0.6);
  });

  check("assemble_video.py: monta um vídeo 16:9 real a partir de um plano de cenas", () => {
    const plan = {
      source: sample,
      scenes: [{ start: 0, end: Math.min(1.5, scenesData.duration) }],
    };
    const planPath = path.join(paths.temp, "selftest-plan.json");
    fs.writeFileSync(planPath, JSON.stringify(plan));
    const out = path.join(paths.temp, "selftest-assembled.mp4");
    execFileSync("python3", [
      path.join(ROOT, "scripts", "media", "assemble_video.py"),
      planPath, "none", "none", out, "16:9",
    ], { cwd: path.join(ROOT, "scripts", "media") });
    assert.ok(fs.existsSync(out) && fs.statSync(out).size > 0);
  });
} catch (err) {
  console.error(`  [AVISO] testes de ffmpeg saltados: ${err.message}`);
}

console.log(`\n${passed} verificação(ões) passaram, ${failures.length} falharam.\n`);
if (failures.length > 0) {
  console.error(`Falharam: ${failures.join(", ")}`);
  process.exitCode = 1;
}
