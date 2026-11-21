/* =====================================================================
   KET SHOP — Configuração do painel
   Substitua pelos valores do seu projecto (Project Settings -> API).
   Use APENAS a chave "anon public". NUNCA coloque aqui a service_role:
   este ficheiro é público e qualquer pessoa o pode ler no navegador.
   ===================================================================== */
window.KETSHOP_CONFIG = {
  SUPABASE_URL: "https://SEU-PROJECTO.supabase.co",
  SUPABASE_ANON_KEY: "COLE_AQUI_A_SUA_ANON_KEY",
  PROOF_BUCKET: "payment-proofs",
  // Intervalo de segurança caso o Realtime não esteja disponível (ms)
  FALLBACK_POLL_MS: 30000
};
