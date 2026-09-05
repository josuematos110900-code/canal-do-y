const BASE_KEYWORDS = [
  "resumo de filmes", "resumo do filme", "filme explicado",
  "filme explicado em português", "história do filme", "final explicado",
  "movie recap", "movie summary", "film recap",
];

const BASE_HASHTAGS = ["#ResumoDeFilmes", "#Filmes", "#Cinema", "#FilmeExplicado", "#MovieRecap"];

/**
 * Gera título/descrição/keywords/hashtags de forma determinística a partir
 * do roteiro e da análise da história — sem inventar informação sobre o filme.
 */
export function buildSeo({ script, story, slug }) {
  const titles = script.title_options?.length
    ? script.title_options
    : [`${slug} — Resumo Completo`, `${slug} Explicado`, `O Final de ${slug} Explicado`];

  const title = titles[0];

  const description =
    `Neste vídeo resumimos a história de "${slug}", acompanhando os principais ` +
    `acontecimentos, conflitos e momentos que mudam toda a história.\n\n` +
    `🎬 Resumo: ${story.logline}\n\n` +
    `⚠️ Este resumo contém spoilers e o final da história.\n\n` +
    BASE_HASHTAGS.join(" ");

  const specificKeywords = [slug.toLowerCase(), `${slug.toLowerCase()} resumo`, `${slug.toLowerCase()} explicado`];
  const keywords = [...new Set([...specificKeywords, ...BASE_KEYWORDS])].slice(0, 20);

  const hashtags = [...new Set([...BASE_HASHTAGS, `#${slug.replace(/\s+/g, "")}`])].slice(0, 8);

  return { title_options: titles, title, description, keywords, hashtags };
}
