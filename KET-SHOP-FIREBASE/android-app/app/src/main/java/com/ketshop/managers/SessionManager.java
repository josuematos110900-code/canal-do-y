package com.ketshop.managers;

import android.content.Context;
import android.content.SharedPreferences;

import com.ketshop.network.ApiException;
import com.ketshop.network.FirebaseConfig;
import com.ketshop.network.HttpClient;

import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

/**
 * Sessão do Firebase Authentication (ID token + refresh token), guardada em
 * SharedPreferences privadas e excluída do backup. Renova o token antes de expirar.
 */
public final class SessionManager {

    private static final String PREFS = "ketshop_session";
    private static final String K_ID_TOKEN = "id_token";
    private static final String K_REFRESH = "refresh_token";
    private static final String K_EXPIRES = "expires_at";
    private static final String K_USER_ID = "user_id";
    private static final String K_EMAIL = "email";
    private static final long REFRESH_MARGIN_SECONDS = 120;

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

    public boolean isLoggedIn() { return prefs.getString(K_REFRESH, null) != null; }
    public String getUserId() { return prefs.getString(K_USER_ID, null); }
    public String getEmail() { return prefs.getString(K_EMAIL, ""); }

    /**
     * Aceita as respostas de signInWithPassword/signUp/update
     * (idToken, refreshToken, expiresIn, localId, email) e de securetoken
     * (id_token, refresh_token, expires_in, user_id).
     */
    public void saveSession(JSONObject r) {
        String id = r.optString("idToken", r.optString("id_token", ""));
        String refresh = r.optString("refreshToken", r.optString("refresh_token", ""));
        if (id.isEmpty() || refresh.isEmpty()) return;
        long expiresIn = parseLong(r.optString("expiresIn", r.optString("expires_in", "3600")), 3600);
        SharedPreferences.Editor e = prefs.edit()
                .putString(K_ID_TOKEN, id)
                .putString(K_REFRESH, refresh)
                .putLong(K_EXPIRES, System.currentTimeMillis() / 1000L + expiresIn);
        String uid = r.optString("localId", r.optString("user_id", ""));
        if (!uid.isEmpty()) e.putString(K_USER_ID, uid);
        String email = r.optString("email", "");
        if (!email.isEmpty()) e.putString(K_EMAIL, email);
        e.apply();
    }

    public void clear() { prefs.edit().clear().apply(); }

    /** ID token válido (renova se necessário) ou null se não houver sessão. */
    public String getValidIdToken() throws ApiException {
        synchronized (lock) {
            String token = prefs.getString(K_ID_TOKEN, null);
            if (token == null) return null;
            long now = System.currentTimeMillis() / 1000L;
            if (prefs.getLong(K_EXPIRES, 0) - now > REFRESH_MARGIN_SECONDS) return token;
            return refreshLocked();
        }
    }

    public String forceRefresh() throws ApiException {
        synchronized (lock) {
            return refreshLocked();
        }
    }

    private String refreshLocked() throws ApiException {
        String refresh = prefs.getString(K_REFRESH, null);
        if (refresh == null) throw ApiException.sessionExpired();
        Map<String, String> h = new HashMap<>();
        h.put("Content-Type", "application/x-www-form-urlencoded");
        byte[] body;
        try {
            body = ("grant_type=refresh_token&refresh_token=" + java.net.URLEncoder.encode(refresh, "UTF-8")).getBytes("UTF-8");
        } catch (java.io.UnsupportedEncodingException e) {
            throw ApiException.sessionExpired();
        }
        HttpClient.Response r = HttpClient.execute("POST", FirebaseConfig.tokenUrl(), h, body, FirebaseConfig.READ_TIMEOUT_MS, null);
        if (r.code == 400 || r.code == 401 || r.code == 403) {
            clear();
            throw ApiException.sessionExpired();
        }
        if (!r.ok()) throw ApiException.fromResponse(r.code, r.text());
        try {
            JSONObject o = new JSONObject(r.text());
            saveSession(o);
            return o.getString("id_token");
        } catch (Exception e) {
            throw ApiException.parse(e);
        }
    }

    private static long parseLong(String s, long def) {
        try {
            return Long.parseLong(s);
        } catch (Exception e) {
            return def;
        }
    }
}
