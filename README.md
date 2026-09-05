# movie-summary

Automação de ponta a ponta de um canal de YouTube de **resumo de filmes**:
recebe um vídeo longo autorizado em `input/movies/`, e sozinho — sem edição
manual — produz e publica um vídeo de resumo narrado, 2 vezes por semana.

> ⚠️ Projecto independente do `editorajs1`. Não partilha código,
> `package.json` nem configuração com ele.

> ⚠️ **Direitos autorais**: usar apenas com filmes/vídeos próprios,
> licenciados, de domínio público, ou com outra base legal para processar e
> publicar. O sistema não descarrega nem republica conteúdo protegido.

## Fluxo

```
VÍDEO LONGO → METADATA → ÁUDIO → TRANSCRIÇÃO → CENAS → HISTÓRIA → EVENTOS
  → ROTEIRO → NARRAÇÃO → PLANO DE CENAS → EDIÇÃO → LEGENDAS → THUMBNAIL
  → SEO → VALIDAÇÃO → UPLOAD → AGENDAMENTO → PUBLICAÇÃO NO YOUTUBE
```

## 1. Instalação

Requisitos de sistema:

- **Node.js ≥ 18** (usa `node:sqlite`, incluído no runtime — sem dependências nativas)
- **Python 3**
- **ffmpeg / ffprobe** — `apt-get install ffmpeg` (Ubuntu/Debian) ou `brew install ffmpeg` (macOS)

```bash
cd movie-summary
npm install
pip3 install -r requirements.txt   # opcional: só se quiseres transcrição local (faster-whisper)
cp .env.example .env
```

Verifica o que está pronto e o que falta configurar:

```bash
npm run check-env
# ou: node bin/movie-summary.js --check-env
```

Corre os testes de fumo (não precisam de nenhuma chave de API):

```bash
npm test
```

## 2. Configurar as chaves (`.env`)

Edita `.env` (nunca faças commit deste ficheiro — já está no `.gitignore`):

| Variável | Para quê | Como obter |
|---|---|---|
| `ANTHROPIC_API_KEY` | compreender a história, escrever o roteiro, gerar SEO | [console.anthropic.com](https://console.anthropic.com) |
| `OPENAI_API_KEY` | transcrição via API (alternativa a instalar faster-whisper) e/ou TTS | [platform.openai.com](https://platform.openai.com) |
| `TTS_PROVIDER` | `elevenlabs` (padrão) ou `openai` | — |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | narração (se `TTS_PROVIDER=elevenlabs`) | [elevenlabs.io](https://elevenlabs.io) → Voice Library, copia o Voice ID |
| `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` | upload/agendamento no YouTube | Google Cloud Console (ver abaixo) |
| `YOUTUBE_REFRESH_TOKEN` | idem — obtido uma única vez | script incluído (ver abaixo) |

Sem `ANTHROPIC_API_KEY`, o pipeline pára de forma controlada na etapa de
análise da história (nunca inventa conteúdo sem modelo). Sem TTS ou YouTube
configurados, essas etapas falham da mesma forma clara — o resto do
pipeline continua a poder ser usado (ex: só gerar roteiro).

### Configurar o YouTube (uma única vez, com browser)

1. Na [Google Cloud Console](https://console.cloud.google.com/), cria um
   projecto, activa a **YouTube Data API v3**, e cria uma credencial OAuth
   2.0 do tipo "Aplicação de ambiente de trabalho" — copia o Client ID e o
   Client Secret para o `.env`.
2. Corre, num computador com browser (não precisa de ser o servidor):
   ```bash
   node scripts/youtube/get-refresh-token.js
   ```
3. Segue o link, autoriza com a conta do canal, cola o código de volta.
4. Copia o `YOUTUBE_REFRESH_TOKEN` devolvido para o `.env`.

Este token não expira por uso — o worker autónomo usa-o indefinidamente.

## 3. Configurar os dias e a hora de publicação

`config/schedule.json`:

```json
{
  "timezone": "Africa/Luanda",
  "posts_per_week": 2,
  "days": ["TUESDAY", "FRIDAY"],
  "publish_time": "18:00"
}
```

`Africa/Luanda` (WAT) é UTC+1 o ano inteiro (sem horário de Verão), por isso
o scheduler usa esse deslocamento fixo — não precisa de bases de dados de
fuso horário. Para outro fuso, adiciona `"utc_offset_hours": N` a este
ficheiro.

Outras preferências gerais em `config/config.json` (duração dos resumos,
threshold de deteção de cenas, resolução, etc.).

## 4. Usar

### Um vídeo de cada vez (sem publicar)

```bash
node bin/movie-summary.js input/movies/filme.mp4 --auto
```

Produz em `output/`: vídeo 16:9, short 9:16, thumbnail, legendas, roteiro e
metadata SEO. Fica marcado `READY` na fila — nada é publicado sozinho neste
modo.

### Publicar manualmente o que estiver `READY`

```bash
node bin/movie-summary.js --publish
```

Agenda cada vídeo `READY` para o próximo slot livre (terça/sexta 18:00,
por omissão), como `private` + `publishAt` — o YouTube publica sozinho à
hora marcada.

### Modo totalmente autónomo (24/7)

```bash
node bin/movie-summary.js --autonomous
# ou, equivalente:
npm run autonomous
npm run worker
```

Isto liga, no mesmo processo:

- **watcher** — monitoriza `input/movies/` (polling seguro, só considera um
  ficheiro "pronto" quando o tamanho pára de crescer entre duas verificações);
- **fila** — processa os vídeos pendentes por ordem de chegada, um de cada vez;
- **pipeline completo** — análise → roteiro → narração → edição → SEO → validação;
- **publicação automática** — cada vídeo `READY` é agendado no YouTube para
  o próximo slot livre, respeitando `config/schedule.json`.

A partir daqui, o único trabalho manual é **colocar um vídeo autorizado em
`input/movies/`**.

**Importante**: `--autonomous` é um processo Node que precisa de ficar
sempre ligado. Numa máquina/servidor próprio, corre-o com um supervisor —
ver secção **9. Produção 24/7** abaixo (`ecosystem.config.js` incluído).

> Numa sessão de Claude Code na cloud (container efémero), este processo
> morre quando a sessão termina — não é o sítio certo para o correr 24/7.
> Usa uma VM, servidor doméstico, ou serviço tipo Railway/Render que fica
> sempre ligado.

### Outros comandos

```bash
node bin/movie-summary.js --queue      # lista a fila e o estado de cada job
node bin/movie-summary.js --status     # contagem por estado
node bin/movie-summary.js --schedule   # mostra os próximos slots livres
node bin/movie-summary.js --retry      # repõe jobs FAILED para nova tentativa
node bin/movie-summary.js --report     # escreve output/report.md
node bin/movie-summary.js --batch input/movies/   # processa uma pasta inteira
```

## 5. Estados da fila

```
PENDING → ANALYZING → SCRIPTING → VOICE_GENERATING → EDITING → READY
        → UPLOADING → SCHEDULED → PUBLISHED
(qualquer etapa pode cair em FAILED após esgotar as tentativas)
```

Consulta com `--queue` / `--status`; a base de dados fica em
`data/database.sqlite` (SQLite, tabelas `movies`, `jobs`, `scenes`,
`scripts`, `videos`, `publications`, `logs`).

## 6. Recuperação de erros

Cada job tenta até `max_attempts` (3, por omissão) vezes antes de ficar
`FAILED`, guardando sempre o motivo em `last_error` — nunca é declarado
`READY`/`PUBLISHED` sem os ficheiros de facto existirem (ver
`src/pipeline/run.js::validateOutputs`). `--retry` repõe os `FAILED` em
`PENDING` para o worker tentar de novo (por exemplo depois de configurares
uma chave que faltava).

## 7. Estrutura do projecto

```
movie-summary/
├── .claude/skills/movie-summary/SKILL.md   # ensina o Claude Code a orquestrar isto
├── bin/movie-summary.js                    # CLI (todos os comandos --flag)
├── src/
│   ├── config.js, logger.js, db.js, scheduler.js, watcher.js, worker.js
│   ├── pipeline/  (story, script, scenePlan, tts, seo, run)
│   └── youtube/   (auth, upload)
├── scripts/
│   ├── media/     (metadata, extract_audio, transcribe, detect_scenes,
│   │               assemble_video, thumbnail — Python + ffmpeg)
│   ├── youtube/get-refresh-token.js
│   └── selftest.js
├── input/movies/, input/audio/
├── output/{videos,shorts,thumbnails,subtitles,scripts,audio,metadata}/
├── analysis/, scenes/, temp/, logs/, data/
├── config/{config.json,schedule.json}
└── .env.example
```

## 8. Solução de problemas

| Sintoma | Causa provável |
|---|---|
| Job falha em `ANALYZING` com "ANTHROPIC_API_KEY não configurado" | falta a chave no `.env` |
| Job falha em `ANALYZING` com "nenhum motor de transcrição disponível" | falta `OPENAI_API_KEY` ou `pip install faster-whisper` |
| Job falha em `VOICE_GENERATING` | falta configurar `TTS_PROVIDER`/chave correspondente |
| `--publish` ou `--autonomous` falham com "YouTube não configurado" | falta correr `get-refresh-token.js` e preencher o `.env` |
| `ffmpeg: command not found` | instalar ffmpeg no sistema |
| Um vídeo nunca sai de `PENDING` | confere `--status`/logs em `logs/pipeline.log` — o watcher só avança quando o tamanho do ficheiro pára de mudar |

## 9. Produção 24/7

### Recuperação sem retrabalho (checkpointing)

Cada etapa do pipeline (`src/pipeline/run.js`) só corre se o seu ficheiro de
saída ainda não existir. Se um job falhar (ex: YouTube em baixo na etapa
19), o retry seguinte **salta** metadata/áudio/transcrição/cenas/história/
roteiro/narração já concluídos e vai directo à etapa que falhou — nunca
volta a pagar transcrição ou TTS por causa de um erro mais à frente.

### PM2 (recomendado)

```bash
npm i -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # opcional: o PM2 volta a arrancar sozinho depois de um reboot
```

Ver estado e logs:

```bash
pm2 status
pm2 logs movie-summary-worker
node bin/movie-summary.js --status   # estado do domínio (fila, agendados, erros)
```

`ecosystem.config.js` corre um único processo (`--autonomous`) que já
embebe watcher + fila + scheduler + publicador — ver o comentário no
próprio ficheiro para a justificação (evita duas instâncias a escrever na
mesma SQLite ao mesmo tempo).

### Alternativa: systemd

```ini
# /etc/systemd/system/movie-summary.service
[Unit]
Description=Movie Summary — worker autónomo
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/caminho/para/movie-summary
ExecStart=/usr/bin/node /caminho/para/movie-summary/bin/movie-summary.js --autonomous
Restart=on-failure
RestartSec=10
EnvironmentFile=/caminho/para/movie-summary/.env
User=movie-summary

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now movie-summary
sudo journalctl -u movie-summary -f
```

## Roadmap (fora do MVP actual)

- Enquadramento inteligente por deteção de rosto para o crop 9:16 (hoje é
  crop central); plugável em `assemble_video.py`.
- Dashboard web sobre a fila (hoje é CLI + SQLite).
- Multi-canal / multi-idioma.
