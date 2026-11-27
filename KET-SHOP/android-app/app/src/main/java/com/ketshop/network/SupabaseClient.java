package com.ketshop.network;

import com.ketshop.managers.SessionManager;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.net.URLEncoder;
import java.util.HashMap;
import java.util.Map;

/**
 * Acesso REST ao Supabase (Auth, PostgREST, Storage e Edge Functions).
 * Todos os métodos são SÍNCRONOS: chamar sempre dentro de Async.run().
 */
public final class SupabaseClient {

    private SupabaseClient() { }

    // ------------------------------------------------------------------ Auth

    /** POST público (login, registo, recuperação). */
    public static JSONObject authPublicPost(String path, JSONObject body) throws ApiException {
        ensureConfigured();
        Map<String, String> h = baseHeaders(null);
        h.put("Content-Type", "application/json");
        HttpClient.Response r = HttpClient.execute("POST", SupabaseConfig.authUrl(path), h,
                bytes(body.toString()), SupabaseConfig.READ_TIMEOUT_MS, null);
        if (!r.ok()) throw ApiException.fromResponse(r.code, r.text());
        return toObject(r.text());
    }

    /** Pedido Auth autenticado (ex.: PUT user para mudar palavra-passe, POST logout). */
    public static JSONObject authUserRequest(String method, String path, JSONObject body) throws ApiException {
        HttpClient.Response r = authorized(method, SupabaseConfig.authUrl(path),
                body == null ? null : bytes(body.toString()), "application/json", null, null,
                SupabaseConfig.READ_TIMEOUT_MS);
        return toObject(r.text());
    }

    // ------------------------------------------------------------- PostgREST

    /** GET /rest/v1/<pathAndQuery> devolvendo um array JSON. */
    public static JSONArray select(String pathAndQuery) throws ApiException {
        HttpClient.Response r = authorized("GET", SupabaseConfig.restUrl(pathAndQuery), null, null, null, null,
                SupabaseConfig.READ_TIMEOUT_MS);
        try {
            String t = r.text();
            return new JSONArray(t.isEmpty() ? "[]" : t);
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
    }

    /** POST /rest/v1/rpc/<fn>. Devolve o texto JSON (objecto, array ou escalar). */
    public static String rpc(String function, JSONObject args) throws ApiException {
        HttpClient.Response r = authorized("POST", SupabaseConfig.restUrl("rpc/" + function),
                bytes(args == null ? "{}" : args.toString()), "application/json", null, null,
                SupabaseConfig.READ_TIMEOUT_MS);
        return r.text();
    }

    public static JSONObject rpcObject(String function, JSONObject args) throws ApiException {
        return toObject(rpc(function, args));
    }

    /** DELETE /rest/v1/<pathAndQuery> (as políticas RLS decidem o que pode ser apagado). */
    public static void delete(String pathAndQuery) throws ApiException {
        authorized("DELETE", SupabaseConfig.restUrl(pathAndQuery), null, null, null, null,
                SupabaseConfig.READ_TIMEOUT_MS);
    }

    // --------------------------------------------------------------- Storage

    public static JSONObject storageUpload(String bucket, String objectPath, byte[] data, String mime,
                                           HttpClient.ProgressListener listener) throws ApiException {
        Map<String, String> extra = new HashMap<>();
        extra.put("x-upsert", "false");
        extra.put("Cache-Control", "max-age=3600");
        HttpClient.Response r = authorized("POST",
                SupabaseConfig.storageUrl("object/" + bucket + "/" + encodePath(objectPath)),
                data, mime, extra, listener, SupabaseConfig.UPLOAD_TIMEOUT_MS);
        return toObject(r.text());
    }

    public static byte[] storageDownload(String bucket, String objectPath) throws ApiException {
        HttpClient.Response r = authorized("GET",
                SupabaseConfig.storageUrl("object/authenticated/" + bucket + "/" + encodePath(objectPath)),
                null, null, null, null, SupabaseConfig.UPLOAD_TIMEOUT_MS);
        return r.body;
    }

    // --------------------------------------------------------- Edge Functions

    public static JSONObject invokeFunction(String name, JSONObject body) throws ApiException {
        HttpClient.Response r = authorized("POST", SupabaseConfig.functionsUrl(name),
                bytes(body == null ? "{}" : body.toString()), "application/json", null, null,
                SupabaseConfig.READ_TIMEOUT_MS);
        return toObject(r.text());
    }

    // --------------------------------------------------------------- Helpers

    /**
     * Executa um pedido com o JWT do utilizador. Se receber 401, tenta
     * renovar a sessão UMA vez e repete o pedido.
     */
    private static HttpClient.Response authorized(String method, String url, byte[] body, String contentType,
                                                  Map<String, String> extra, HttpClient.ProgressListener listener,
                                                  int timeout) throws ApiException {
        ensureConfigured();
        SessionManager session = SessionManager.get();
        String token = session.getValidAccessToken();
        HttpClient.Response r = HttpClient.execute(method, url, headers(token, contentType, extra), body, timeout, listener);
        if (r.code == 401 && token != null) {
            token = session.forceRefresh();
            r = HttpClient.execute(method, url, headers(token, contentType, extra), body, timeout, listener);
        }
        if (!r.ok()) throw ApiException.fromResponse(r.code, r.text());
        return r;
    }

    private static Map<String, String> headers(String token, String contentType, Map<String, String> extra) {
        Map<String, String> h = baseHeaders(token);
        if (contentType != null) h.put("Content-Type", contentType);
        if (extra != null) h.putAll(extra);
        return h;
    }

    static Map<String, String> baseHeaders(String userToken) {
        Map<String, String> h = new HashMap<>();
        h.put("apikey", SupabaseConfig.SUPABASE_ANON_KEY);
        if (userToken != null) {
            h.put("Authorization", "Bearer " + userToken);
        } else if (SupabaseConfig.SUPABASE_ANON_KEY.startsWith("eyJ")) {
            // Chave "anon" antiga (JWT): pode ir também no Authorization.
            // Chaves novas "sb_publishable_..." não são JWT: vão só no cabeçalho apikey.
            h.put("Authorization", "Bearer " + SupabaseConfig.SUPABASE_ANON_KEY);
        }
        return h;
    }

    private static void ensureConfigured() throws ApiException {
        if (!SupabaseConfig.isConfigured()) throw ApiException.notConfigured();
    }

    static byte[] bytes(String s) {
        try {
            return s.getBytes("UTF-8");
        } catch (Exception e) {
            return new byte[0];
        }
    }

    private static JSONObject toObject(String text) throws ApiException {
        try {
            if (text == null || text.trim().isEmpty() || "null".equals(text.trim())) return new JSONObject();
            String t = text.trim();
            if (t.startsWith("[")) {
                JSONArray a = new JSONArray(t);
                return a.length() > 0 ? a.getJSONObject(0) : new JSONObject();
            }
            return new JSONObject(t);
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
    }

    /** Codifica um valor para filtros PostgREST (ex.: eq.<valor>). */
    public static String enc(String value) {
        try {
            return URLEncoder.encode(value, "UTF-8").replace("+", "%20");
        } catch (Exception e) {
            return value;
        }
    }

    private static String encodePath(String path) {
        String[] parts = path.split("/");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) sb.append('/');
            sb.append(enc(parts[i]));
        }
        return sb.toString();
    }
}
