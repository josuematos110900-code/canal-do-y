package com.ketshop.network;
// Variante de TESTE: aponta para o Firebase Emulator Suite
public final class FirebaseConfig {
    public static final String API_KEY = "fake-api-key-for-emulator-000";
    public static final String PROJECT_ID = "ketshop-test";
    public static final String STORAGE_BUCKET = "ketshop-test.appspot.com";
    public static final long PROOF_MAX_BYTES = 5L * 1024L * 1024L;
    public static final int CONNECT_TIMEOUT_MS = 15000, READ_TIMEOUT_MS = 30000, UPLOAD_TIMEOUT_MS = 120000;
    private FirebaseConfig() { }
    public static boolean isConfigured() { return true; }
    public static String authUrl(String m) { return "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:" + m + "?key=" + API_KEY; }
    public static String tokenUrl() { return "http://127.0.0.1:9099/securetoken.googleapis.com/v1/token?key=" + API_KEY; }
    public static String documentsRoot() { return "projects/" + PROJECT_ID + "/databases/(default)/documents"; }
    public static String firestoreUrl(String s) { return "http://127.0.0.1:8080/v1/" + documentsRoot() + s; }
    public static String storageUrl() { return "http://127.0.0.1:9199/v0/b/" + STORAGE_BUCKET + "/o"; }
}
