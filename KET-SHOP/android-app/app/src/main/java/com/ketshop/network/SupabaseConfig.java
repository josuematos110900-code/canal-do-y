package com.ketshop.network;

/**
 * Configuração do Supabase.
 *
 * SUBSTITUA os dois valores abaixo pelos do seu projecto:
 *   Supabase Dashboard -> Project Settings -> API
 *     - Project URL           -> SUPABASE_URL
 *     - Publishable key (sb_publishable_...) ou anon public -> SUPABASE_ANON_KEY
 *
 * NUNCA coloque aqui a chave service_role. A chave anon é pública por
 * definição; a segurança é garantida pelas políticas RLS e pelas funções
 * SQL do servidor (ver supabase/).
 */
public final class SupabaseConfig {

    public static final String SUPABASE_URL = "https://phgjhqwlphqhclbistpb.supabase.co";
    public static final String SUPABASE_ANON_KEY = "sb_publishable_MkkpUqljmFh1Y8hQHeu7bw_dIxbnycT";

    /** Página pública (admin-web/reset-password.html) para definir nova palavra-passe. */
    public static final String PASSWORD_RESET_REDIRECT_URL = "https://SEU-DOMINIO-DO-PAINEL/reset-password.html";

    public static final String PROOF_BUCKET = "payment-proofs";
    public static final long PROOF_MAX_BYTES = 5L * 1024L * 1024L;

    public static final int CONNECT_TIMEOUT_MS = 15000;
    public static final int READ_TIMEOUT_MS = 30000;
    public static final int UPLOAD_TIMEOUT_MS = 120000;

    private SupabaseConfig() { }

    public static boolean isConfigured() {
        return SUPABASE_URL.startsWith("https://")
                && !SUPABASE_URL.contains("SEU-PROJECTO")
                && !SUPABASE_ANON_KEY.startsWith("COLE_")
                && SUPABASE_ANON_KEY.length() > 30;
    }

    public static String restUrl(String pathAndQuery) {
        return SUPABASE_URL + "/rest/v1/" + pathAndQuery;
    }

    public static String authUrl(String path) {
        return SUPABASE_URL + "/auth/v1/" + path;
    }

    public static String storageUrl(String path) {
        return SUPABASE_URL + "/storage/v1/" + path;
    }

    public static String functionsUrl(String name) {
        return SUPABASE_URL + "/functions/v1/" + name;
    }
}
