import fs from "node:fs";
import { getYoutubeClient } from "./auth.js";

/**
 * Faz upload do vídeo como PRIVATE, define o agendamento (publishAt) e o
 * thumbnail. O YouTube publica automaticamente à hora marcada — não é
 * preciso nenhuma acção manual depois disto.
 */
export async function uploadAndSchedule({ videoPath, thumbnailPath, title, description, tags, publishAtIso }) {
  const youtube = getYoutubeClient();

  if (!fs.existsSync(videoPath)) throw new Error(`vídeo não encontrado para upload: ${videoPath}`);

  const publishDate = new Date(publishAtIso);
  if (Number.isNaN(publishDate.getTime()) || publishDate.getTime() <= Date.now()) {
    throw new Error(`publishAt inválido ou no passado: ${publishAtIso}`);
  }

  const insertRes = await youtube.videos.insert({
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
  });

  const videoId = insertRes.data.id;

  if (thumbnailPath && fs.existsSync(thumbnailPath)) {
    await youtube.thumbnails.set({ videoId, media: { body: fs.createReadStream(thumbnailPath) } });
  }

  return { videoId, publishAt: publishDate.toISOString() };
}

export async function checkVideoStatus(videoId) {
  const youtube = getYoutubeClient();
  const res = await youtube.videos.list({ part: ["status", "processingDetails"], id: [videoId] });
  return res.data.items?.[0] ?? null;
}
