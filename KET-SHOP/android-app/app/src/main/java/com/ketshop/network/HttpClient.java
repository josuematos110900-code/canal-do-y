package com.ketshop.network;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

/**
 * Cliente HTTP mínimo baseado em HttpURLConnection (sem bibliotecas externas).
 * Suporta GET, POST, PUT e DELETE (PATCH não é suportado pelo HttpURLConnection;
 * por isso as actualizações são feitas através de funções RPC).
 */
public final class HttpClient {

    public interface ProgressListener {
        void onProgress(long sent, long total);
    }

    public static final class Response {
        public final int code;
        public final byte[] body;

        Response(int code, byte[] body) {
            this.code = code;
            this.body = body;
        }

        public String text() {
            try {
                return new String(body, "UTF-8");
            } catch (Exception e) {
                return "";
            }
        }

        public boolean ok() { return code >= 200 && code < 300; }
    }

    private HttpClient() { }

    public static Response execute(String method, String url, Map<String, String> headers,
                                   byte[] body, int readTimeoutMs, ProgressListener listener) throws ApiException {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod(method);
            conn.setConnectTimeout(SupabaseConfig.CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(readTimeoutMs);
            conn.setUseCaches(false);
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("X-Client-Info", "ketshop-android/1.0");
            if (headers != null) {
                for (Map.Entry<String, String> h : headers.entrySet()) {
                    conn.setRequestProperty(h.getKey(), h.getValue());
                }
            }
            if (body != null) {
                conn.setDoOutput(true);
                conn.setFixedLengthStreamingMode(body.length);
                OutputStream os = conn.getOutputStream();
                try {
                    int chunk = 8192;
                    long sent = 0;
                    for (int off = 0; off < body.length; off += chunk) {
                        int len = Math.min(chunk, body.length - off);
                        os.write(body, off, len);
                        sent += len;
                        if (listener != null) listener.onProgress(sent, body.length);
                    }
                    os.flush();
                } finally {
                    os.close();
                }
            }
            int code = conn.getResponseCode();
            InputStream is = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
            return new Response(code, readAll(is));
        } catch (IOException e) {
            throw ApiException.network();
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static byte[] readAll(InputStream is) throws IOException {
        if (is == null) return new byte[0];
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) out.write(buf, 0, n);
            return out.toByteArray();
        } finally {
            is.close();
        }
    }
}
