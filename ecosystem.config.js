/**
 * Configuração PM2 para correr o movie-summary 24/7 num servidor próprio.
 *
 * Arquitetura escolhida: UM único processo autónomo ("movie-summary-worker")
 * que já embebe watcher + fila + scheduler + publicador — em vez de
 * processos separados para "worker" e "scheduler". Motivo: todos partilham
 * a mesma base SQLite (data/database.sqlite) via node:sqlite, que não foi
 * desenhada para múltiplos processos a escrever em simultâneo; um único
 * processo evita condições de corrida e mantém o comportamento "um job de
 * cada vez, por ordem" que o worker garante (ver src/worker.js). É também
 * mais simples de operar: um serviço, um log, um restart.
 *
 * Uso:
 *   npm i -g pm2
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup        # opcional: arrancar sozinho no boot do servidor
 *
 * Logs: pm2 logs movie-summary-worker
 * Estado: pm2 status   (ou: node bin/movie-summary.js --status)
 */
module.exports = {
  apps: [
    {
      name: "movie-summary-worker",
      script: "./bin/movie-summary.js",
      args: "--autonomous",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 10000,
      max_restarts: 20,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-error.log",
      time: true,
    },
  ],
};
