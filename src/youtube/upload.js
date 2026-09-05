import fs from "node:fs";
import { getYoutubeClient } from "./auth.js";
import { logger } from "../logger.js";

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function isRetryable(err) {
  const status = err?.code || err?.response?.status;
  return RETRYABLE_STATUS.has(Number(status)) || err?.message?.includes("ECONNRESET") || err?.message?.includes("ETIMEDOUT");
}

async function withRetry(label, fn, { attempts = 3, baseDelayMs = 2000 } = {}) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts || !isRetryable(err)) throw err;
      const delay = baseDelayMs * 2 ** (i - 1);
      logger.warn("youtube", `${label} falhou (tentativa ${i}/${attempts}, erro transitório): ${err.message}. A repetir em ${delay}ms.`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * Faz upload do vídeo como PRIVATE, define o agendamento (publishAt) e o
 * thumbnail. O YouTube publica automaticamente à hora marcada — não é
 * preciso nenhuma acção manual depois disto. Erros transitórios (rate
 * limit, 5xx, timeouts de rede) são repetidos com backoff exponencial;
 * erros de autenticação/validação (4xx que não sejam 429) falham de imediato
 * com uma mensagem clara, para o job cair em FAILED sem ficar preso a repetir
 * algo que nunca vai funcionar sozinho (ex: credenciais inválidas).
 */
export async function uploadAndSchedule({ videoPath, thumbnailPath, title, description, tags, publishAtIso }) {
  const youtube = getYoutubeClient();

  if (!fs.existsSync(videoPath)) throw new Error(`vídeo não encontrado para upload: ${videoPath}`);
  if (!title || !description) throw new Error("título e descrição são obrigatórios para o upload");

  const publishDate = new Date(publishAtIso);
  if (Number.isNaN(publishDate.getTime()) || publishDate.getTime() <= Date.now()) {
    throw new Error(`publishAt inválido ou no passado: ${publishAtIso}`);
  }

  const insertRes = await withRetry("videos.insert", () =>
    youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: title.slice(0, 100),
          description: description.slice(0, 5000),
          tags: (tags || []).slice(0, 500),
          categoryId: "24", // Entertainment
        },
        status: {
          privacyStatus: "private",
          publishAt: publishDate.toISOString(),
          selfDeclaredMadeForKids: false,
        },
      },
      media: { body: fs.createReadStream(videoPath) },
    })
  );

  const videoId = insertRes.data.id;
  if (!videoId) throw new Error("YouTube não devolveu um videoId — upload não confirmado");
  logger.ok("youtube", `upload confirmado, videoId=${videoId}`);

  if (thumbnailPath && fs.existsSync(thumbnailPath)) {
    await withRetry("thumbnails.set", () =>
      youtube.thumbnails.set({ videoId, media: { body: fs.createReadStream(thumbnailPath) } })
    );
  }

  return { videoId, publishAt: publishDate.toISOString() };
}

export async function checkVideoStatus(videoId) {
  const youtube = getYoutubeClient();
  const res = await youtube.videos.list({ part: ["status", "processingDetails"], id: [videoId] });
  return res.data.items?.[0] ?? null;
}
