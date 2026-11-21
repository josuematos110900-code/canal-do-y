package com.ketshop.network;

/** Cloud Storage for Firebase via REST (v0). Métodos SÍNCRONOS. */
public final class StorageApi {

    private StorageApi() { }

    /**
     * Envia bytes para o caminho indicado em "multipart" (metadados JSON + ficheiro),
     * o mesmo protocolo do SDK oficial, para que o contentType chegue às Storage Rules
     * (que validam dono, tipo de imagem e tamanho).
     */
    public static void upload(String path, byte[] data, String mime, HttpClient.ProgressListener listener) throws ApiException {
        String boundary = "ketshop" + Long.toHexString(System.nanoTime());
        String metadata;
        try {
            metadata = new org.json.JSONObject().put("name", path).put("contentType", mime).toString();
        } catch (org.json.JSONException e) {
            throw ApiException.parse(e);
        }
        String crlf = "\r\n";
        String head = "--" + boundary + crlf + "Content-Type: application/json; charset=utf-8" + crlf + crlf + metadata
                + crlf + "--" + boundary + crlf + "Content-Type: " + mime + crlf + crlf;
        String tail = crlf + "--" + boundary + "--";
        byte[] h = FirebaseHttp.utf8(head), t = FirebaseHttp.utf8(tail);
        byte[] body = new byte[h.length + data.length + t.length];
        System.arraycopy(h, 0, body, 0, h.length);
        System.arraycopy(data, 0, body, h.length, data.length);
        System.arraycopy(t, 0, body, h.length + data.length, t.length);
        final int dataStart = h.length;
        final long dataLen = data.length;
        HttpClient.ProgressListener progress = listener == null ? null
                : (sent, total) -> listener.onProgress(Math.max(0, Math.min(dataLen, sent - dataStart)), dataLen);
        String url = FirebaseConfig.storageUrl() + "?name=" + enc(path);
        java.util.Map<String, String> extra = new java.util.HashMap<>();
        extra.put("X-Goog-Upload-Protocol", "multipart");
        FirebaseHttp.authorized("POST", url, body, "multipart/related; boundary=" + boundary, "Firebase", progress,
                FirebaseConfig.UPLOAD_TIMEOUT_MS, false, extra);
    }

    /** Descarrega o ficheiro com a sessão do utilizador (bucket privado). */
    public static byte[] download(String path) throws ApiException {
        String url = FirebaseConfig.storageUrl() + "/" + enc(path) + "?alt=media";
        return FirebaseHttp.authorized("GET", url, null, null, "Firebase", null, FirebaseConfig.UPLOAD_TIMEOUT_MS, false, null).body;
    }

    /** Codifica o caminho completo (inclui "/" -> %2F, como a API exige). */
    static String enc(String s) {
        try {
            return java.net.URLEncoder.encode(s, "UTF-8").replace("+", "%20");
        } catch (Exception e) {
            return s;
        }
    }
}
