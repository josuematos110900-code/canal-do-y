#!/usr/bin/env node
/**
 * Ferramenta de configuração ÚNICA (correr manualmente uma vez, num
 * computador com browser). Obtém o YOUTUBE_REFRESH_TOKEN a partir de
 * YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET (criados na Google Cloud
 * Console, com o YouTube Data API v3 activado).
 *
 * Uso:
 *   node scripts/youtube/get-refresh-token.js
 * Segue o link impresso, autoriza a app, cola o código de volta no terminal.
 * Copia o refresh_token devolvido para o .env como YOUTUBE_REFRESH_TOKEN.
 */
import readline from "node:readline";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();

const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET } = process.env;
if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET) {
  console.error("Define YOUTUBE_CLIENT_ID e YOUTUBE_CLIENT_SECRET no .env antes de correr este script.");
  process.exit(1);
}

const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob";
const oauth2Client = new google.auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, REDIRECT_URI);

const url = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube"],
});

console.log("\n1. Abre este link no browser e autoriza a app com a conta do canal:\n");
console.log(url);
console.log("\n2. Copia o código de autorização apresentado e cola-o aqui.\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question("Código: ", async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log("\nSucesso! Adiciona isto ao teu ficheiro .env:\n");
    console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
    if (!tokens.refresh_token) {
      console.log(
        "\nAviso: não veio refresh_token. Revoga o acesso da app em " +
          "https://myaccount.google.com/permissions e repete com prompt=consent."
      );
    }
  } catch (err) {
    console.error("Falhou a troca do código por tokens:", err.message);
    process.exit(1);
  }
});
