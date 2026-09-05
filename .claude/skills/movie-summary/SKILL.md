---
name: movie-summary
description: Automação de ponta a ponta que transforma vídeos longos de filmes/documentários autorizados em vídeos de resumo narrado, publicados automaticamente no YouTube 2x/semana. Usar sempre que o utilizador invocar /movie-summary ou pedir para processar/agendar/publicar um resumo de filme.
---

# Movie Summary — Skill para Claude Code

Este projecto é uma automação de canal de YouTube de RESUMO DE FILMES. A
lógica pesada (ffmpeg, transcrição, geração de roteiro/SEO por IA, TTS,
upload/agendamento no YouTube) já está implementada em código em `src/` e
`scripts/` — o comando `/movie-summary` é sobretudo um **wrapper** para o CLI
Node (`bin/movie-summary.js`). Este ficheiro existe para o Claude Code saber
o que correr e como interpretar/explicar os resultados.

## Regra de direitos autorais

Só processar vídeos que o utilizador tenha autorização, licença, domínio
público ou outra base legal adequada para usar e publicar. Nunca descarregar
ou republicar automaticamente conteúdo protegido sem autorização. Se a base
legal não for clara, perguntar antes de avançar.

## Como correr o comando

`/movie-summary` mapeia directamente para:

```bash
node bin/movie-summary.js [input] [flags]
```

Tabela de flags (todas implementadas em `bin/movie-summary.js`):

| Comando | O que faz |
|---|---|
| `/movie-summary input/movies/filme.mp4` | pipeline completo (análise → roteiro → narração → edição → thumbnail → SEO → validação) |
| `--short` / `--medium` / `--full` / `--auto` | duração alvo do resumo |
| `--batch <pasta>` | processa todos os vídeos da pasta |
| `--watch` | liga o watcher + fila (processa tudo o que aparecer em `input/movies/`, sem publicar) |
| `--autonomous` | watcher + fila + worker + publicação automática agendada no YouTube — o modo 24/7 |
| `--queue` / `--status` | mostra o estado dos jobs |
| `--publish` | agenda no YouTube todos os jobs em `READY` para o próximo slot livre |
| `--schedule` | mostra os próximos horários de publicação disponíveis |
| `--retry` | repõe jobs `FAILED` em `PENDING` |
| `--report` | escreve `output/report.md` |
| `--check-env` | verifica ffmpeg/ffprobe/python3 e quais chaves de API estão configuradas |

Antes de sugerir `--autonomous` ao utilizador, corre `--check-env` e
confirma que ele já configurou as chaves necessárias (ver README.md) —
sem elas, o pipeline falha de forma controlada em cada etapa que precisa
de IA, TTS, ou YouTube, e o job fica `FAILED` com o motivo em `last_error`.

## O que o pipeline já faz sozinho (código, não é preciso pedir ao Claude)

1. Metadata (`scripts/media/metadata.py`, ffprobe).
2. Extracção de áudio (`extract_audio.py`).
3. Transcrição (`transcribe.py` — faster-whisper local ou OpenAI Whisper API).
4. Deteção de cenas por mudança visual (`detect_scenes.py`, filtro `scene` do ffmpeg).
5. Compreensão da história, personagens e eventos (`src/pipeline/story.js`,
   chama a Claude API — nunca inventa factos fora da transcrição; nomes
   incertos ficam marcados `"certainty": "uncertain"`).
6. Roteiro original de narração (`src/pipeline/script.js`, estrutura
   HOOK → APRESENTAÇÃO → CONFLITO → DESENVOLVIMENTO → REVELAÇÕES → CLÍMAX → FINAL).
7. Narração TTS (`src/pipeline/tts.js`, ElevenLabs ou OpenAI).
8. Plano de cenas de apoio + montagem 16:9 e 9:16 com legendas queimadas
   (`src/pipeline/scenePlan.js` + `assemble_video.py`).
9. Thumbnail a partir do evento de maior importância (`thumbnail.py`).
10. SEO — título, descrição, keywords, hashtags (`src/pipeline/seo.js`).
11. Validação de todos os ficheiros de saída antes de marcar `READY`.
12. Upload + agendamento no YouTube como `private` com `publishAt`
    (`src/youtube/upload.js`) — o YouTube publica sozinho à hora marcada.
13. Cálculo do próximo slot livre respeitando `config/schedule.json`
    (por omissão: terça e sexta às 18:00, `Africa/Luanda`), sem nunca
    colidir com uma publicação já agendada (`src/scheduler.js`).

## Quando o Claude Code deve intervir directamente (fora do CLI)

- Diagnosticar um `last_error` na fila (`--status`/`--queue`) e explicar ao
  utilizador o que falta configurar.
- Ajudar a preencher o `.env` (nunca escrever segredos reais no código ou
  no chat — só orientar onde os colocar).
- Rever manualmente um roteiro gerado em `output/scripts/<slug>.txt` se o
  utilizador pedir uma segunda opinião editorial.
- Ajustar `config/config.json` / `config/schedule.json` a pedido do
  utilizador (dias de publicação, hora, duração dos resumos, etc.).
- Nunca reactivar `--autonomous`/publicação automática sem o utilizador ter
  confirmado explicitamente as contas e o `privacyStatus` pretendido.

## Nunca

- Inventar personagens, acontecimentos, diálogos ou finais que não estejam
  na transcrição/análise.
- Apagar ficheiros em `input/movies/`.
- Publicar com `privacyStatus` diferente de `private` + `publishAt` sem
  pedido explícito do utilizador.
- Colocar chaves reais em ficheiros versionados.
