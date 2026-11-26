/* =====================================================================
   Elite Shop — Configuração do painel
   Substitua pelos valores do seu projecto (Project Settings -> API).
   Use APENAS a chave publicável (sb_publishable_...) ou "anon public". NUNCA coloque aqui a service_role:
   este ficheiro é público e qualquer pessoa o pode ler no navegador.
   ===================================================================== */
window.KETSHOP_CONFIG = {
  SUPABASE_URL: "https://phgjhqwlphqhclbistpb.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_MkkpUqljmFh1Y8hQHeu7bw_dIxbnycT",
  PROOF_BUCKET: "payment-proofs",
  // Intervalo de segurança caso o Realtime não esteja disponível (ms)
  FALLBACK_POLL_MS: 30000
};
