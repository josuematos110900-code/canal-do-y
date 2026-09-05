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

/**
 * Corre o pipeline completo para um job, do vídeo bruto até ao vídeo(s)
 * final(is) prontos e — se autoPublish estiver activo e o YouTube estiver
 * configurado — agendados no YouTube. Lança erro em qualquer falha; quem
 * chama (worker/queue) é responsável por aplicar a política de retries.
 */
export async function runPipeline(job, movie, { mode = "auto", autoPublish = false, generateShort = true } = {}) {
  const slug = movie.slug;
  const jobId = job.id;
  const a = (...p) => path.join(paths.analysis, ...p);
  const o = (...p) => path.join(paths.output, ...p);

  // 1-2. Metadata (já feito ao criar o movie, mas revalida o ficheiro).
  setStatus(jobId, "ANALYZING", "metadata");
  const metadataPath = a(`${slug}.metadata.json`);
  py("metadata.py", [movie.source_path, metadataPath]);
  const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));

  // 3. Áudio.
  setStatus(jobId, "ANALYZING", "extract_audio");
  const audioPath = path.join(paths.temp, `${slug}.wav`);
  py("extract_audio.py", [movie.source_path, audioPath]);

  // 4. Transcrição.
  setStatus(jobId, "ANALYZING", "transcribe");
  const transcriptJson = a(`${slug}.transcript.json`);
  const transcriptSrt = a(`${slug}.transcript.srt`);
  py("transcribe.py", [audioPath, transcriptJson, transcriptSrt]);

  // 5. Deteção de cenas.
  setStatus(jobId, "ANALYZING", "detect_scenes");
  const scenesJson = path.join(paths.scenes, `${slug}.scenes.json`);
  py("detect_scenes.py", [movie.source_path, scenesJson]);
  const scenes = JSON.parse(fs.readFileSync(scenesJson, "utf-8"));

  // 6-9. Compreensão da história, personagens, eventos, linha temporal.
  setStatus(jobId, "ANALYZING", "story_analysis");
  const story = await analyzeStory({ transcriptPath: transcriptJson, scenesPath: scenesJson });
  fs.writeFileSync(a(`${slug}.story.json`), JSON.stringify(story, null, 2));

  // 10-11. Roteiro (inclui título/seleção de eventos essenciais).
  setStatus(jobId, "SCRIPTING", "write_script");
  const script = await writeScript({ story, sourceDurationSeconds: metadata.duration, mode });
  const scriptPath = o("scripts", `${slug}.json`);
  fs.writeFileSync(scriptPath, JSON.stringify(script, null, 2));
  fs.writeFileSync(o("scripts", `${slug}.txt`), scriptToPlainText(script));

  // 12. Narração.
  setStatus(jobId, "VOICE_GENERATING", "tts");
  const narrationPath = o("audio", `${slug}.narration.mp3`);
  await generateNarration(scriptToPlainText(script), narrationPath);

  // 13. Plano de cenas de apoio.
  setStatus(jobId, "EDITING", "scene_plan");
  const plan = buildScenePlan({ script, scenes, sourcePath: movie.source_path });
  const planPath = a(`${slug}.plan.json`);
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2));

  // 14. Edição (16:9) + legendas queimadas.
  setStatus(jobId, "EDITING", "assemble_video");
  const finalVideo = o("videos", `${slug}-resumo.mp4`);
  py("assemble_video.py", [planPath, narrationPath, transcriptSrt, finalVideo, "16:9"]);

  let shortVideo = null;
  if (generateShort || config.generate_short) {
    setStatus(jobId, "EDITING", "assemble_short");
    shortVideo = o("shorts", `${slug}-short.mp4`);
    py("assemble_video.py", [planPath, narrationPath, transcriptSrt, shortVideo, "9:16"]);
  }

  // 15. Thumbnail.
  setStatus(jobId, "EDITING", "thumbnail");
  const eventsForThumb = a(`${slug}.events.json`);
  fs.writeFileSync(eventsForThumb, JSON.stringify({ events: story.events }, null, 2));
  const thumbPath = o("thumbnails", `${slug}.jpg`);
  py("thumbnail.py", [finalVideo, eventsForThumb, thumbPath]);

  // 16. SEO.
  setStatus(jobId, "EDITING", "seo");
  const seo = buildSeo({ script, story, slug });
  const metaOut = o("metadata", `${slug}.json`);
  fs.writeFileSync(metaOut, JSON.stringify({ slug, mode, ...seo }, null, 2));

  // 17-18. Validação.
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
  }

  return { finalVideo, shortVideo, thumbPath, seo, metadata, story, script };
}

export function validateOutputs({ finalVideo, shortVideo, thumbPath, scriptPath, metaOut, transcriptSrt }) {
  const exists = (p) => Boolean(p) && fs.existsSync(p) && fs.statSync(p).size > 0;
  return {
    video_final: exists(finalVideo),
    video_short: shortVideo ? exists(shortVideo) : true,
    thumbnail: exists(thumbPath),
    roteiro: exists(scriptPath),
    metadata_seo: exists(metaOut),
    legendas: exists(transcriptSrt),
  };
}
