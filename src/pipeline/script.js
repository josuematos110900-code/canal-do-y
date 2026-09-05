import { callClaude, extractJson, hasLlm } from "../llm.js";
import { config } from "../config.js";

const SYSTEM = `És um argumentista de vídeos de resumo de filmes para YouTube, a
escrever em português. Escreves um roteiro de narração ORIGINAL a partir de uma
análise de história já feita (não inventas nada além do que está na análise).

Estrutura obrigatória: HOOK → APRESENTAÇÃO → INÍCIO → CONFLITO →
DESENVOLVIMENTO → REVELAÇÕES → CLÍMAX → FINAL.

Regras:
- Frases curtas, ritmo rápido, natural para narração em voz alta.
- Nunca inventar personagens, factos, diálogos ou desfechos.
- Incluir o final da história (não escondas o desfecho).
- Cada linha do roteiro deve poder ser associada a um "time_seconds" da
  análise (o instante do filme a que essa parte da narração se refere).

Devolve APENAS um bloco JSON:
{
  "title_options": ["...", "...", "...", "...", "..."],
  "lines": [ { "text": "...", "time_seconds": 0, "section": "hook|apresentacao|inicio|conflito|desenvolvimento|revelacoes|climax|final" } ]
}`;

function targetDurationSeconds(mode, sourceDurationSeconds) {
  const c = config;
  if (mode === "short") return (c.short_duration_min + c.short_duration_max) / 2;
  if (mode === "medium") return (c.medium_duration_min + c.medium_duration_max) / 2;
  if (mode === "full") return (c.full_duration_min + c.full_duration_max) / 2;
  // auto: proporcional à duração original, dentro dos limites "full".
  const proportional = sourceDurationSeconds * 0.06;
  return Math.min(Math.max(proportional, c.medium_duration_min), c.full_duration_max);
}

export async function writeScript({ story, sourceDurationSeconds, mode = "auto" }) {
  if (!hasLlm()) {
    throw new Error(
      "SCRIPTING falhou: ANTHROPIC_API_KEY não configurado. O roteiro é escrito por um " +
        "modelo a partir da análise da história — define a chave no .env."
    );
  }
  const targetSeconds = targetDurationSeconds(mode, sourceDurationSeconds);
  const targetWords = Math.round((targetSeconds / 60) * 150); // ~150 palavras/min de narração

  const relevantEvents = story.events
    .filter((e) => e.importance >= config.min_event_importance)
    .sort((a, b) => a.time_seconds - b.time_seconds);

  const prompt = `ANÁLISE DA HISTÓRIA:\n${JSON.stringify(story, null, 2)}\n\n` +
    `EVENTOS ACIMA DO LIMIAR DE IMPORTÂNCIA (${config.min_event_importance}):\n` +
    JSON.stringify(relevantEvents, null, 2) +
    `\n\nMODO: ${mode}. Duração alvo do vídeo final: ~${Math.round(targetSeconds)}s. ` +
    `Escreve um roteiro com aproximadamente ${targetWords} palavras no total.`;

  const raw = await callClaude({ system: SYSTEM, prompt, maxTokens: 8000 });
  const script = extractJson(raw);
  script.target_seconds = targetSeconds;
  return script;
}

export function scriptToPlainText(script) {
  return script.lines.map((l) => l.text).join(" ");
}
