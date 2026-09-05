import { google } from "googleapis";

/**
 * Cliente OAuth2 do YouTube Data API v3. Requer, no .env:
 *   YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
 *
 * O refresh token é obtido UMA VEZ através do fluxo de consentimento no
 * browser (ver scripts/youtube/get-refresh-token.js) e depois reutilizado
 * indefinidamente pelo worker autónomo — sem intervenção manual.
 */
export function getYoutubeClient() {
  const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN } = process.env;
  if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET || !YOUTUBE_REFRESH_TOKEN) {
    throw new Error(
      "YouTube não configurado: define YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET e " +
        "YOUTUBE_REFRESH_TOKEN no .env (ver README secção 'Configurar o YouTube')."
    );
  }
  const oauth2Client = new google.auth.OAuth2(YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: YOUTUBE_REFRESH_TOKEN });
  return google.youtube({ version: "v3", auth: oauth2Client });
}
