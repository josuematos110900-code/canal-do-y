package com.ketshop.repositories;

import com.ketshop.network.ApiException;
import com.ketshop.network.SupabaseClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

/** Definições públicas configuradas no painel (tabela app_settings, is_public = true). */
public final class SettingsRepository {

    private static Map<String, Object> cache;
    private static long cacheTime;
    private static final long TTL_MS = 5 * 60 * 1000;

    private SettingsRepository() { }

    public static synchronized Map<String, Object> publicSettings(boolean forceRefresh) throws ApiException {
        if (!forceRefresh && cache != null && System.currentTimeMillis() - cacheTime < TTL_MS) return cache;
        JSONArray a = SupabaseClient.select("app_settings?select=key,value&is_public=eq.true");
        Map<String, Object> m = new HashMap<>();
        for (int i = 0; i < a.length(); i++) {
            JSONObject o = a.optJSONObject(i);
            m.put(o.optString("key"), o.opt("value"));
        }
        cache = m;
        cacheTime = System.currentTimeMillis();
        return m;
    }

    public static String getString(Map<String, Object> s, String key) {
        Object v = s.get(key);
        if (v == null || v == JSONObject.NULL) return "";
        return String.valueOf(v).trim();
    }

    public static boolean getBool(Map<String, Object> s, String key) {
        Object v = s.get(key);
        return v instanceof Boolean ? (Boolean) v : "true".equals(String.valueOf(v));
    }

    public static int getInt(Map<String, Object> s, String key, int def) {
        Object v = s.get(key);
        if (v instanceof Number) return ((Number) v).intValue();
        try {
            return Integer.parseInt(String.valueOf(v));
        } catch (Exception e) {
            return def;
        }
    }
}
