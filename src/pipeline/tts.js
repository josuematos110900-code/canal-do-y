import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { logger } from "../logger.js";

/**
 * Gera narração TTS a partir de um roteiro de texto. Suporta:
 *  - TTS_PROVIDER=elevenlabs (ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID)
 *  - TTS_PROVIDER=openai     (OPENAI_API_KEY)
 * Sem provedor configurado, falha com uma mensagem clara (nunca finge sucesso).
 */
export async function generateNarration(text, outPath) {
  const provider = (process.env.TTS_PROVIDER || "elevenlabs").toLowerCase();

  if (provider === "elevenlabs") {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;
    if (!apiKey || !voiceId) {
      throw new Error(
        "TTS (elevenlabs) não configurado: define ELEVENLABS_API_KEY e ELEVENLABS_VOICE_ID no .env"
      );
    }
    return elevenLabsTts(text, outPath, apiKey, voiceId);
  }

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("TTS (openai) não configurado: define OPENAI_API_KEY no .env");
    return openAiTts(text, outPath, apiKey);
  }

  throw new Error(`TTS_PROVIDER desconhecido: "${provider}" (usa "elevenlabs" ou "openai")`);
}

function postJsonForAudio({ hostname, path, headers, body }, outPath) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method: "POST", headers },
      (res) => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let errBody = "";
          res.on("data", (c) => (errBody += c));
          res.on("end", () => reject(new Error(`TTS HTTP ${res.statusCode}: ${errBody.slice(0, 500)}`)));
          return;
        }
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        const file = fs.createWriteStream(outPath);
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(outPath)));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function elevenLabsTts(text, outPath, apiKey, voiceId) {
  const body = JSON.stringify({
    text,
    model_id: "eleven_multilingual_v2",
    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  });
  return postJsonForAudio(
    {
      hostname: "api.elevenlabs.io",
      path: `/v1/text-to-speech/${voiceId}`,
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "Content-Length": Buffer.byteLength(body),
      },
      body,
    },
    outPath
  );
}

async function openAiTts(text, outPath, apiKey) {
  const body = JSON.stringify({ model: "tts-1-hd", voice: "onyx", input: text, format: "mp3" });
  return postJsonForAudio(
    {
      hostname: "api.openai.com",
      path: "/v1/audio/speech",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      body,
    },
    outPath
  );
}

export function logTts(jobId, msg) {
  logger.info(`job#${jobId} tts`, msg);
}
