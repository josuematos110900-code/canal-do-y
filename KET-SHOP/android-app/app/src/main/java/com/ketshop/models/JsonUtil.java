package com.ketshop.models;

import org.json.JSONObject;

/** Leitura segura de campos JSON que podem ser null. */
final class JsonUtil {
    private JsonUtil() { }

    static String str(JSONObject o, String key) {
        if (o == null || o.isNull(key)) return null;
        String v = o.optString(key, null);
        return v == null || "null".equals(v) ? null : v;
    }

    static String str(JSONObject o, String key, String def) {
        String v = str(o, key);
        return v == null ? def : v;
    }

    static Integer intOrNull(JSONObject o, String key) {
        if (o == null || o.isNull(key) || !o.has(key)) return null;
        return o.optInt(key);
    }

    static double dbl(JSONObject o, String key) {
        if (o == null || o.isNull(key)) return 0;
        return o.optDouble(key, 0);
    }
}
