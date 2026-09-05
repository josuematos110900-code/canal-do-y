import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { paths, config, ROOT } from "../config.js";
import { logger } from "../logger.js";
import { updateJob, logEvent, schedulePublication } from "../db.js";
import { analyzeStory } from "./story.js";
import { writeScript, scriptToPlainText } from "./script.js";
import { buildScenePlan } from "./scenePlan.js";
import { buildSeo } from "./seo.js";
import { generateNarration } from "./tts.js";
import { nextAvailableSlot } from "../scheduler.js";
import { uploadAndSchedule } from "../youtube/upload.js";

function py(script, args) {
  return execFileSync("python3", [path.join(ROOT, "scripts", "media", script), ...args], {
    encoding: "utf-8",
    cwd: path.join(ROOT, "scripts", "media"),
  });
}

function setStatus(jobId, status, step) {
  updateJob(jobId, { status, step });
  logEvent(jobId, "INFO", step, `status -> ${status}`);
  logger.info(`job#${jobId}`, `${status} (${step})`);
}

const existsNonEmpty = (p) => Boolean(p) && fs.existsSync(p) && fs.statSync(p).size > 0;

/**
 * Corre `fn()` apenas se os ficheiros em `outputs` ainda não existirem
 * (ou estiverem vazios). Isto é o que torna os retries baratos: depois de
 * uma falha a meio do pipeline (ex: YouTube em baixo), o worker volta a
 * chamar runPipeline() do zero, mas cada etapa já concluída é detectada e
 * SALTADA em vez de reprocessada — nunca se paga transcrição/TTS/render
 * duas vezes por causa de um erro numa etapa posterior.
 */
function step(jobId, status, name, outputs, fn) {
  const list = Array.isArray(outputs) ? outputs : [outputs];
  if (list.length > 0 && list.every(existsNonEmpty)) {
    logEvent(jobId, "INFO", name, "já concluída — a saltar (checkpoint encontrado)");
    logger.info(`job#${jobId}`, `${name}: checkpoint encontrado, a saltar`);
    return;
  }
  setStatus(jobId, status, name);
  fn();
}

/**
 * Corre o pipeline completo para um job, do vídeo bruto até ao vídeo(s)
 * final(is) prontos e — se autoPublish estiver activo e o YouTube estiver
 * configurado — agendados no YouTube. Lança erro em qualquer falha; quem
 * chama (worker/queue) é responsável por aplicar a política de retries.
 * Todas as etapas são "resumíveis": ver `step()` acima.
 */
export async function runPipeline(job, movie, { mode = "auto", autoPublish = false, generateShort = true } = {}) {
  const slug = movie.slug;
  const jobId = job.id;
  const a = (...p) => path.join(paths.analysis, ...p);
  const o = (...p) => path.join(paths.output, ...p);

  // 1-2. Metadata.
  const metadataPath = a(`${slug}.metadata.json`);
  step(jobId, "ANALYZING", "metadata", metadataPath, () => py("metadata.py", [movie.source_path, metadataPath]));
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

  // 3. Áudio.
  const audioPath = path.join(paths.temp, `${slug}.wav`);
  step(jobId, "ANALYZING", "extract_audio", audioPath, () => py("extract_audio.py", [movie.source_path, audioPath]));

  // 4. Transcrição.
  const transcriptJson = a(`${slug}.transcript.json`);
  const transcriptSrt = a(`${slug}.transcript.srt`);
  step(jobId, "ANALYZING", "transcribe", [transcriptJson, transcriptSrt], () =>
    py("transcribe.py", [audioPath, transcriptJson, transcriptSrt])
  );

  // 5. Deteção de cenas.
  const scenesJson = path.join(paths.scenes, `${slug}.scenes.json`);
  step(jobId, "ANALYZING", "detect_scenes", scenesJson, () => py("detect_scenes.py", [movie.source_path, scenesJson]));
  const scenes = JSON.parse(fs.readFileSync(scenesJson, "utf-8"));

  // 6-9. Compreensão da história, personagens, eventos, linha temporal.
  // (chamada assíncrona — não usa o helper step() síncrono; checkpoint manual)
  const storyPath = a(`${slug}.story.json`);
  let story;
  if (existsNonEmpty(storyPath)) {
    logEvent(jobId, "INFO", "story_analysis", "já concluída — a saltar (checkpoint encontrado)");
    story = JSON.parse(fs.readFileSync(storyPath, "utf-8"));
  } else {
    setStatus(jobId, "ANALYZING", "story_analysis");
    story = await analyzeStory({ transcriptPath: transcriptJson, scenesPath: scenesJson });
    fs.writeFileSync(storyPath, JSON.stringify(story, null, 2));
  }

  // 10-11. Roteiro (inclui título/seleção de eventos essenciais).
  const scriptPath = o("scripts", `${slug}.json`);
  let script;
  if (existsNonEmpty(scriptPath)) {
    logEvent(jobId, "INFO", "write_script", "já concluída — a saltar (checkpoint encontrado)");
    script = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  } else {
    setStatus(jobId, "SCRIPTING", "write_script");
    script = await writeScript({ story, sourceDurationSeconds: metadata.duration, mode });
    fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));
    fs.writeFileSync(o("scripts", `${slug}.txt`), scriptToPlainText(script));
  }

  // 12. Narração.
  const narrationPath = o("audio", `${slug}.narration.mp3`);
  if (!existsNonEmpty(narrationPath)) {
    setStatus(jobId, "VOICE_GENERATING", "tts");
    await generateNarration(scriptToPlainText(script), narrationPath);
  } else {
    logEvent(jobId, "INFO", "tts", "já concluída — a saltar (checkpoint encontrado)");
  }

  // 13. Plano de cenas de apoio (barato — recalcula sempre, não é I/O pesado).
  setStatus(jobId, "EDITING", "scene_plan");
  const plan = buildScenePlan({ script, scenes, sourcePath: movie.source_path });
  const planPath = a(`${slug}.plan.json`);
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));

  // 14. Edição (16:9) + legendas queimadas.
  const finalVideo = o("videos", `${slug}-resumo.mp4`);
  step(jobId, "EDITING", "assemble_video", finalVideo, () =>
    py("assemble_video.py", [planPath, narrationPath, transcriptSrt, finalVideo, "16:9"])
  );

  let shortVideo = null;
  if (generateShort || config.generate_short) {
    shortVideo = o("shorts", `${slug}-short.mp4`);
    step(jobId, "EDITING", "assemble_short", shortVideo, () =>
      py("assemble_video.py", [planPath, narrationPath, transcriptSrt, shortVideo, "9:16"])
    );
  }

  // 15. Thumbnail.
  const thumbPath = o("thumbnails", `${slug}.jpg`);
  step(jobId, "EDITING", "thumbnail", thumbPath, () => {
    const eventsForThumb = a(`${slug}.events.json`);
    fs.writeFileSync(eventsForThumb, JSON.stringify({ events: story.events }, null, 2));
    py("thumbnail.py", [finalVideo, eventsForThumb, thumbPath]);
  });

  // 16. SEO.
  const metaOut = o("metadata", `${slug}.json`);
  let seo;
  if (existsNonEmpty(metaOut)) {
    logEvent(jobId, "INFO", "seo", "já concluída — a saltar (checkpoint encontrado)");
    seo = JSON.parse(fs.readFileSync(metaOut, "utf-8"));
  } else {
    setStatus(jobId, "EDITING", "seo");
    seo = buildSeo({ script, story, slug });
    fs.writeFileSync(metaOut, JSON.stringify({ slug, mode, ...seo }, null, 2));
  }

  // 17-18. Validação — corre sempre, mesmo com checkpoints, nunca é saltada.
  setStatus(jobId, "EDITING", "validate");
  const checklist = validateOutputs({ finalVideo, shortVideo, thumbPath, scriptPath, metaOut, transcriptSrt });
  const failed = Object.entries(checklist).filter(([, ok]) => !ok);
  if (failed.length > 0) {
    throw new Error(`validação falhou: ${failed.map(([k]) => k).join(", ")}`);
  }

  setStatus(jobId, "READY", "queued_for_publication");

  // 19. Publicação automática (se activada e YouTube configurado).
  if (autoPublish) {
    setStatus(jobId, "UPLOADING", "youtube_upload");
    const publishAtIso = nextAvailableSlot();
    const result = await uploadAndSchedule({
      videoPath: finalVideo,
      thumbnailPath: thumbPath,
      title: seo.title,
      description: seo.description,
      tags: seo.keywords,
      publishAtIso,
    });
    schedulePublication(jobId, { title: seo.title, publishAt: result.publishAt, privacyStatus: "private" });
    setStatus(jobId, "SCHEDULED", `youtube_video_id=${result.videoId}`);
    logger.ok(`job#${jobId}`, `YouTube confirmou videoId=${result.videoId}, publishAt=${result.publishAt}`);
  }

  return { finalVideo, shortVideo, thumbPath, seo, metadata, story, script };
}

export function validateOutputs({ finalVideo, shortVideo, thumbPath, scriptPath, metaOut, transcriptSrt }) {
  return {
    video_final: existsNonEmpty(finalVideo),
    video_short: shortVideo ? existsNonEmpty(shortVideo) : true,
    thumbnail: existsNonEmpty(thumbPath),
    roteiro: existsNonEmpty(scriptPath),
    metadata_seo: existsNonEmpty(metaOut),
    legendas: existsNonEmpty(transcriptSrt),
  };
}
