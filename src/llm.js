import https from "node:https";

/**
 * Cliente mínimo para a Claude API (Anthropic), usado pelas etapas criativas
 * do pipeline (compreensão da história, roteiro, SEO). Requer ANTHROPIC_API_KEY.
 * Sem chave configurada, as funções que o chamam devem falhar com uma
 * mensagem clara — nunca inventar conteúdo sem o modelo.
 */
export function hasLlm() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function callClaude({ system, prompt, maxTokens = 4000, model = "claude-sonnet-5" }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não definido — necessário para as etapas de análise/roteiro/SEO.");
  }
  const body = JSON.stringify({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.anthropic.com",
        path: "/v1/messages",
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Claude API HTTP ${res.statusCode}: ${data.slice(0, 800)}`));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const text = parsed.content?.map((c) => c.text || "").join("") ?? "";
            resolve(text);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/** Extrai o primeiro bloco JSON válido de uma resposta de texto do modelo. */
export function extractJson(text) {
  const fence = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("resposta do modelo não contém JSON reconhecível");
  return JSON.parse(candidate.slice(start, end + 1));
}
