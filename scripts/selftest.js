#!/usr/bin/env node
/**
 * Testes de fumo que NÃO precisam de chaves de API: geram um vídeo sintético
 * com o próprio ffmpeg e verificam metadata, extracção de áudio, deteção de
 * cenas, o scheduler (2x/semana, Africa/Luanda) e a fila (DB).
 * Corre com: npm test
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { ROOT, paths, ensureDirs } from "../src/config.js";
import { nextAvailableSlot, nextAvailableSlots } from "../src/scheduler.js";
import { upsertMovie, createJob, getJobBySlug, updateJob, listJobs } from "../src/db.js";

ensureDirs();
let passed = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  [OK] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FALHOU] ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("\n== movie-summary selftest ==\n");

// --- Scheduler: terça/sexta 18:00 Africa/Luanda (UTC+1 => 17:00 UTC) ---
check("scheduler: próximo slot cai numa terça ou sexta às 17:00 UTC", () => {
  const iso = nextAvailableSlot();
  const d = new Date(iso);
  const day = d.getUTCDay(); // 2=terça, 5=sexta
  assert.ok(day === 2 || day === 5, `dia da semana inesperado: ${day}`);
  assert.equal(d.getUTCHours(), 17);
  assert.equal(d.getUTCMinutes(), 0);
});

check("scheduler: slots consecutivos nunca colidem e ficam por ordem", () => {
  const slots = nextAvailableSlots(4);
  assert.equal(slots.length, 4);
  const unique = new Set(slots);
  assert.equal(unique.size, 4);
  for (let i = 1; i < slots.length; i++) {
    assert.ok(new Date(slots[i]) > new Date(slots[i - 1]));
  }
});

// --- DB / fila ---
check("db: cria filme + job e evita duplicar job para o mesmo slug", () => {
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

// --- FFmpeg / metadata / áudio / cenas com vídeo sintético ---
const sample = path.join(paths.temp, "selftest-sample.mp4");
try {
  execFileSync("ffmpeg", [
    "-y", "-f", "lavfi", "-i", "testsrc=duration=3:size=320x240:rate=10",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
    "-shortest", "-pix_fmt", "yuv420p", sample,
  ], { stdio: "ignore" });

  check("ffmpeg: vídeo sintético de teste foi gerado", () => {
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
    assert.ok(meta.duration >= 2.5 && meta.duration <= 3.5);
  });

  check("extract_audio.py: produz um .wav não vazio", () => {
    const out = path.join(paths.temp, "selftest-audio.wav");
    execFileSync("python3", [path.join(ROOT, "scripts", "media", "extract_audio.py"), sample, out], {
      cwd: path.join(ROOT, "scripts", "media"),
    });
    assert.ok(fs.existsSync(out) && fs.statSync(out).size > 0);
  });

  check("detect_scenes.py: devolve pelo menos uma cena cobrindo todo o vídeo", () => {
    const out = path.join(paths.temp, "selftest-scenes.json");
    execFileSync("python3", [path.join(ROOT, "scripts", "media", "detect_scenes.py"), sample, out], {
      cwd: path.join(ROOT, "scripts", "media"),
    });
    const scenes = JSON.parse(fs.readFileSync(out, "utf-8"));
    assert.ok(scenes.scenes.length >= 1);
    assert.ok(Math.abs(scenes.scenes.at(-1).end - scenes.duration) < 0.6);
  });
} catch (err) {
  console.error(`  [AVISO] testes de ffmpeg saltados: ${err.message}`);
}

console.log(`\n${passed} verificação(ões) passaram.\n`);
