package com.ketshop.managers;

import android.content.Context;
import android.content.SharedPreferences;

import com.ketshop.network.ApiException;
import com.ketshop.network.HttpClient;
import com.ketshop.network.SupabaseConfig;

import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

/**
 * Guarda e renova a sessão do Supabase Auth (access_token + refresh_token).
 * A sessão fica em SharedPreferences privadas (MODE_PRIVATE) e é excluída do backup.
 */
public final class SessionManager {

    private static final String PREFS = "ketshop_session";
    private static final String K_ACCESS = "access_token";
    private static final String K_REFRESH = "refresh_token";
    private static final String K_EXPIRES = "expires_at";
    private static final String K_USER_ID = "user_id";
    private static final String K_EMAIL = "email";
    private static final long REFRESH_MARGIN_SECONDS = 90;

    private static SessionManager instance;
    private final SharedPreferences prefs;
    private final Object lock = new Object();

    private SessionManager(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static synchronized void init(Context context) {
        if (instance == null) instance = new SessionManager(context);
    }

    public static SessionManager get() {
        if (instance == null) throw new IllegalStateException("SessionManager.init() não foi chamado");
        return instance;
    }

    public boolean isLoggedIn() {
        return prefs.getString(K_REFRESH, null) != null;
    }

    public String getUserId() { return prefs.getString(K_USER_ID, null); }

    public String getEmail() { return prefs.getString(K_EMAIL, ""); }

    /** Guarda a resposta de /auth/v1/token ou /auth/v1/signup. */
    public void saveSession(JSONObject auth) {
        String access = auth.optString("access_token", null);
        String refresh = auth.optString("refresh_token", null);
        if (access == null || refresh == null || access.isEmpty()) return;
        long expiresAt = auth.optLong("expires_at", 0);
        if (expiresAt == 0) {
            expiresAt = System.currentTimeMillis() / 1000L + auth.optLong("expires_in", 3600);
        }
        JSONObject user = auth.optJSONObject("user");
        SharedPreferences.Editor e = prefs.edit()
                .putString(K_ACCESS, access)
                .putString(K_REFRESH, refresh)
                .putLong(K_EXPIRES, expiresAt);
        if (user != null) {
            e.putString(K_USER_ID, user.optString("id"));
            e.putString(K_EMAIL, user.optString("email"));
        }
        e.apply();
    }

    public void clear() {
        prefs.edit().clear().apply();
    }

    /**
     * Devolve um access token válido, renovando-o se estiver prestes a expirar.
     * Devolve null se não houver sessão (pedidos feitos como anon).
     */
    public String getValidAccessToken() throws ApiException {
        synchronized (lock) {
            String access = prefs.getString(K_ACCESS, null);
            if (access == null) return null;
            long now = System.currentTimeMillis() / 1000L;
            long expiresAt = prefs.getLong(K_EXPIRES, 0);
            if (expiresAt - now > REFRESH_MARGIN_SECONDS) return access;
            return refreshLocked();
        }
    }

    /** Força a renovação (usado quando o servidor responde 401). */
    public String forceRefresh() throws ApiException {
        synchronized (lock) {
            return refreshLocked();
        }
    }

    private String refreshLocked() throws ApiException {
        String refresh = prefs.getString(K_REFRESH, null);
        if (refresh == null) throw ApiException.sessionExpired();
        Map<String, String> h = new HashMap<>();
        h.put("apikey", SupabaseConfig.SUPABASE_ANON_KEY);
        if (SupabaseConfig.SUPABASE_ANON_KEY.startsWith("eyJ")) {
            h.put("Authorization", "Bearer " + SupabaseConfig.SUPABASE_ANON_KEY);
        }
        h.put("Content-Type", "application/json");
        String body = "{\"refresh_token\":" + JSONObject.quote(refresh) + "}";
        HttpClient.Response r;
        try {
            r = HttpClient.execute("POST", SupabaseConfig.authUrl("token?grant_type=refresh_token"), h,
                    body.getBytes("UTF-8"), SupabaseConfig.READ_TIMEOUT_MS, null);
        } catch (java.io.UnsupportedEncodingException e) {
            throw ApiException.sessionExpired();
        }
        if (r.code == 400 || r.code == 401 || r.code == 403) {
            clear();
            throw ApiException.sessionExpired();
        }
        if (!r.ok()) throw ApiException.fromResponse(r.code, r.text());
        try {
            JSONObject o = new JSONObject(r.text());
            saveSession(o);
            return o.getString("access_token");
        } catch (Exception e) {
            throw ApiException.parse(e);
        }
    }
}
