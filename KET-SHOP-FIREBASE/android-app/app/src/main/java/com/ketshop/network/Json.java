package com.ketshop.network;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Construção concisa de JSON: Json.of("a", 1, "b", null). null vira JSONObject.NULL. */
public final class Json {

    private Json() { }

    public static JSONObject of(Object... kv) {
        JSONObject o = new JSONObject();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            try {
                o.put(String.valueOf(kv[i]), kv[i + 1] == null ? JSONObject.NULL : kv[i + 1]);
            } catch (JSONException ignored) {
                // chaves são sempre texto
            }
        }
        return o;
    }

    public static JSONArray arr(Object... values) {
        JSONArray a = new JSONArray();
        for (Object v : values) a.put(v == null ? JSONObject.NULL : v);
        return a;
    }

    /** Texto vazio -> null. */
    public static Object nullIfEmpty(String s) {
        return s == null || s.trim().isEmpty() ? null : s.trim();
    }
}
