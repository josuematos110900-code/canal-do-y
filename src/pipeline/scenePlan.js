/**
 * Constrói o plano de montagem: para cada linha do roteiro (com o seu
 * time_seconds de referência), escolhe a cena detectada no filme original
 * mais próxima desse instante, para servir de imagem de apoio à narração.
 * Junta cenas adjacentes/repetidas para evitar cortes demasiado curtos.
 */
export function buildScenePlan({ script, scenes, sourcePath, minSceneSeconds = 1.5, maxSceneSeconds = 8 }) {
  const allScenes = scenes.scenes;

  function nearestScene(t) {
    let best = allScenes[0];
    let bestDist = Infinity;
    for (const s of allScenes) {
      const dist = t < s.start ? s.start - t : t > s.end ? t - s.end : 0;
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    return best;
  }

  const plan = [];
  let lastEnd = -1;
  for (const line of script.lines) {
    const scene = nearestScene(line.time_seconds);
    let start = scene.start;
    let end = Math.min(scene.end, start + maxSceneSeconds);
    if (end - start < minSceneSeconds) end = start + minSceneSeconds;

    // Evita sobreposição/repetição exacta da cena anterior.
    if (start < lastEnd) start = lastEnd;
    if (end <= start) end = start + minSceneSeconds;

    plan.push({ start, end, narration_line: line.text, section: line.section });
    lastEnd = end;
  }

  return { source: sourcePath, scenes: plan };
}
