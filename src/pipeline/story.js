import fs from "node:fs";
import { callClaude, extractJson, hasLlm } from "../llm.js";

const SYSTEM = `És um analista de narrativa cinematográfica. Recebes a transcrição
(com timestamps) de um filme ou documentário autorizado e a lista de cenas
detectadas visualmente. A tua única função é COMPREENDER a história real
contida nesse material — nunca inventar personagens, acontecimentos, diálogos
ou finais que não estejam suportados pela transcrição.

Quando não tiveres a certeza sobre um nome, um facto ou uma relação entre
personagens, usa uma descrição neutra (ex.: "o protagonista", "a mulher",
"o polícia") e marca o campo "certainty" desse elemento como "uncertain".

Devolve APENAS um bloco JSON com esta forma exacta:
{
  "logline": "uma frase que resume a história",
  "structure": {
    "inicio": "...", "apresentacao": "...", "conflito": "...",
    "desenvolvimento": "...", "complicacao": "...", "climax": "...", "resolucao": "..."
  },
  "characters": [ { "name": "...", "role": "protagonist|antagonist|supporting", "certainty": "certain|uncertain" } ],
  "events": [
    { "time_seconds": 0, "importance": 0, "description": "...", "certainty": "certain|uncertain" }
  ]
}
"importance" vai de 0 a 100 (90-100 essencial, 75-89 importante, 60-74 útil, <60 dispensável).
Ordena "events" cronologicamente por "time_seconds".`;

export async function analyzeStory({ transcriptPath, scenesPath }) {
  if (!hasLlm()) {
    throw new Error(
      "ANALYZING falhou: ANTHROPIC_API_KEY não configurado. Esta etapa exige um modelo " +
        "para compreender a história sem inventar factos — define a chave no .env."
    );
  }
  const transcript = JSON.parse(fs.readFileSync(transcriptPath, "utf-8"));
  const scenes = JSON.parse(fs.readFileSync(scenesPath, "utf-8"));

  const transcriptText = transcript.segments
    .map((s) => `[${s.start.toFixed(1)}s] ${s.text}`)
    .join("\n");

  const prompt = `TRANSCRIÇÃO:\n${transcriptText}\n\nCENAS DETECTADAS (${scenes.scenes.length}):\n` +
    scenes.scenes.map((s) => `#${s.index} ${s.start.toFixed(1)}s–${s.end.toFixed(1)}s`).join("\n");

  const raw = await callClaude({ system: SYSTEM, prompt, maxTokens: 8000 });
  const story = extractJson(raw);
  return story;
}
