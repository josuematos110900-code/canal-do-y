package com.ketshop.network;

/**
 * Configuração do Firebase.
 *
 * Consola Firebase -> ⚙ Definições do projecto -> Geral:
 *   - "Chave da API Web" (Web API Key)  -> API_KEY
 *   - "ID do projecto"                   -> PROJECT_ID
 * Storage -> separador Ficheiros: nome do bucket (ex.: ketshop-xxxx.firebasestorage.app) -> STORAGE_BUCKET
 *
 * A Web API Key identifica o projecto e é pública por definição. A segurança
 * é garantida pelas Security Rules (firebase/firestore.rules e storage.rules).
 * NUNCA coloque aqui chaves de conta de serviço (service account).
 */
public final class FirebaseConfig {

    public static final String API_KEY = "COLE_AQUI_A_WEB_API_KEY";
    public static final String PROJECT_ID = "seu-projecto-id";
    public static final String STORAGE_BUCKET = "seu-projecto-id.firebasestorage.app";

    public static final long PROOF_MAX_BYTES = 5L * 1024L * 1024L;

    public static final int CONNECT_TIMEOUT_MS = 15000;
    public static final int READ_TIMEOUT_MS = 30000;
    public static final int UPLOAD_TIMEOUT_MS = 120000;

    private FirebaseConfig() { }

    public static boolean isConfigured() {
        return !API_KEY.startsWith("COLE_") && API_KEY.length() > 20
                && !PROJECT_ID.startsWith("seu-") && !STORAGE_BUCKET.startsWith("seu-");
    }

    public static String authUrl(String method) {
        return "https://identitytoolkit.googleapis.com/v1/accounts:" + method + "?key=" + API_KEY;
    }

    public static String tokenUrl() {
        return "https://securetoken.googleapis.com/v1/token?key=" + API_KEY;
    }

    /** Raiz dos documentos: .../databases/(default)/documents */
    public static String documentsRoot() {
        return "projects/" + PROJECT_ID + "/databases/(default)/documents";
    }

    public static String firestoreUrl(String suffix) {
        return "https://firestore.googleapis.com/v1/" + documentsRoot() + suffix;
    }

    public static String storageUrl() {
        return "https://firebasestorage.googleapis.com/v0/b/" + STORAGE_BUCKET + "/o";
    }
}
