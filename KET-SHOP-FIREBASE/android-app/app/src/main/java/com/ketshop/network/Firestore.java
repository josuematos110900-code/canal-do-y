package com.ketshop.network;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * Cliente mínimo da API REST do Cloud Firestore (v1), sem bibliotecas.
 * Converte entre JSON "simples" (como os modelos usam) e o formato tipado do
 * Firestore. Todas as escritas usam :commit (POST), por isso não é preciso PATCH.
 * Métodos SÍNCRONOS: chamar dentro de Async.run().
 */
public final class Firestore {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    private Firestore() { }

    // ================================================================ Leitura

    /** GET de um documento. Devolve null se não existir. */
    public static JSONObject get(String path, boolean allowAnonymous) throws ApiException {
        try {
            HttpClient.Response r = FirebaseHttp.authorized("GET", FirebaseConfig.firestoreUrl("/" + path), null, null,
                    null, null, FirebaseConfig.READ_TIMEOUT_MS, allowAnonymous);
            return decodeDocument(new JSONObject(r.text()));
        } catch (ApiException e) {
            if (e.isNotFound()) return null;
            throw e;
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
    }

    public static JSONObject get(String path) throws ApiException {
        return get(path, false);
    }

    /** Executa uma consulta estruturada. */
    public static List<JSONObject> query(Query q) throws ApiException {
        String url = FirebaseConfig.firestoreUrl((q.parent == null ? "" : "/" + q.parent) + ":runQuery");
        try {
            JSONObject body = new JSONObject().put("structuredQuery", q.toJson());
            HttpClient.Response r = FirebaseHttp.authorized("POST", url, FirebaseHttp.utf8(body.toString()),
                    "application/json", null, null, FirebaseConfig.READ_TIMEOUT_MS, q.anonymous);
            JSONArray arr = new JSONArray(r.text());
            List<JSONObject> out = new ArrayList<>();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject d = arr.getJSONObject(i).optJSONObject("document");
                if (d != null) out.add(decodeDocument(d));
            }
            return out;
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
    }

    // ================================================================ Escrita

    /** Escreve vários documentos de forma atómica (tudo ou nada). */
    public static void commit(List<Write> writes) throws ApiException {
        try {
            JSONArray arr = new JSONArray();
            for (Write w : writes) arr.put(w.toJson());
            JSONObject body = new JSONObject().put("writes", arr);
            FirebaseHttp.authorized("POST", FirebaseConfig.firestoreUrl(":commit"), FirebaseHttp.utf8(body.toString()),
                    "application/json", null, null, FirebaseConfig.READ_TIMEOUT_MS, false);
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
    }

    public static void commit(Write... writes) throws ApiException {
        List<Write> l = new ArrayList<>();
        for (Write w : writes) l.add(w);
        commit(l);
    }

    /** Identificador aleatório de 20 caracteres (como o Firestore gera). */
    public static String newId() {
        StringBuilder sb = new StringBuilder(20);
        for (int i = 0; i < 20; i++) sb.append(ID_CHARS.charAt(RANDOM.nextInt(ID_CHARS.length())));
        return sb.toString();
    }

    /** Uma operação de escrita para :commit. */
    public static final class Write {
        final String path;
        final JSONObject fields;
        final List<String> mask = new ArrayList<>();
        final List<String> serverTimestamps = new ArrayList<>();
        Boolean mustExist;
        boolean delete;
        boolean useMask;

        private Write(String path, JSONObject fields) {
            this.path = path;
            this.fields = fields == null ? new JSONObject() : fields;
        }

        /** Cria um documento novo (falha se já existir). */
        public static Write create(String path, JSONObject fields) {
            Write w = new Write(path, fields);
            w.mustExist = false;
            return w;
        }

        /** Actualiza apenas os campos indicados (o documento tem de existir). */
        public static Write update(String path, JSONObject fields) {
            Write w = new Write(path, fields);
            w.mustExist = true;
            w.useMask = true;
            Iterator<String> it = w.fields.keys();
            while (it.hasNext()) w.mask.add(it.next());
            return w;
        }

        public static Write delete(String path) {
            Write w = new Write(path, null);
            w.delete = true;
            return w;
        }

        /** Define o campo com a hora do servidor (request.time nas regras). */
        public Write serverTime(String... fieldNames) {
            for (String f : fieldNames) serverTimestamps.add(f);
            return this;
        }

        JSONObject toJson() throws JSONException {
            String name = FirebaseConfig.documentsRoot() + "/" + path;
            JSONObject w = new JSONObject();
            if (delete) {
                w.put("delete", name);
                return w;
            }
            w.put("update", new JSONObject().put("name", name).put("fields", encodeFields(fields)));
            if (useMask) {
                JSONArray paths = new JSONArray();
                for (String m : mask) paths.put(m); // nomes simples (snake_case), sem caracteres especiais
                w.put("updateMask", new JSONObject().put("fieldPaths", paths));
            }
            if (!serverTimestamps.isEmpty()) {
                JSONArray tr = new JSONArray();
                for (String f : serverTimestamps) {
                    tr.put(new JSONObject().put("fieldPath", f).put("setToServerValue", "REQUEST_TIME"));
                }
                w.put("updateTransforms", tr);
            }
            if (mustExist != null) w.put("currentDocument", new JSONObject().put("exists", mustExist));
            return w;
        }
    }

    /** Consulta estruturada simples: filtros de igualdade/comparação, ordenação e limite. */
    public static final class Query {
        final String collection;
        String parent;
        final JSONArray filters = new JSONArray();
        String orderField;
        boolean descending;
        int limit;
        boolean anonymous;

        public Query(String collection) {
            this.collection = collection;
        }

        /** Sub-colecção de um documento (ex.: parent "orders/KET-..."). */
        public Query parent(String docPath) { this.parent = docPath; return this; }

        public Query where(String field, String op, Object value) {
            try {
                filters.put(new JSONObject().put("fieldFilter", new JSONObject()
                        .put("field", new JSONObject().put("fieldPath", field))
                        .put("op", op)
                        .put("value", encodeValue(value))));
            } catch (JSONException ignored) {
                // não acontece com valores simples
            }
            return this;
        }

        public Query whereEq(String field, Object value) { return where(field, "EQUAL", value); }

        public Query orderBy(String field, boolean desc) { orderField = field; descending = desc; return this; }

        public Query limit(int n) { limit = n; return this; }

        public Query allowAnonymous() { anonymous = true; return this; }

        JSONObject toJson() throws JSONException {
            JSONObject q = new JSONObject();
            q.put("from", new JSONArray().put(new JSONObject().put("collectionId", collection)));
            if (filters.length() == 1) {
                q.put("where", filters.get(0));
            } else if (filters.length() > 1) {
                q.put("where", new JSONObject().put("compositeFilter",
                        new JSONObject().put("op", "AND").put("filters", filters)));
            }
            if (orderField != null) {
                q.put("orderBy", new JSONArray().put(new JSONObject()
                        .put("field", new JSONObject().put("fieldPath", orderField))
                        .put("direction", descending ? "DESCENDING" : "ASCENDING")));
            }
            if (limit > 0) q.put("limit", limit);
            return q;
        }
    }

    // ================================================================ Codec

    static JSONObject encodeFields(JSONObject plain) throws JSONException {
        JSONObject out = new JSONObject();
        Iterator<String> it = plain.keys();
        while (it.hasNext()) {
            String k = it.next();
            out.put(k, encodeValue(plain.opt(k)));
        }
        return out;
    }

    static JSONObject encodeValue(Object v) throws JSONException {
        JSONObject o = new JSONObject();
        if (v == null || v == JSONObject.NULL) {
            o.put("nullValue", JSONObject.NULL);
        } else if (v instanceof Boolean) {
            o.put("booleanValue", v);
        } else if (v instanceof Integer || v instanceof Long || v instanceof Short) {
            o.put("integerValue", String.valueOf(((Number) v).longValue()));
        } else if (v instanceof Number) {
            double d = ((Number) v).doubleValue();
            // números inteiros são guardados como integerValue (igual ao SDK JavaScript do painel)
            if (d == Math.rint(d) && Math.abs(d) < 1e15) o.put("integerValue", String.valueOf((long) d));
            else o.put("doubleValue", d);
        } else if (v instanceof JSONObject) {
            o.put("mapValue", new JSONObject().put("fields", encodeFields((JSONObject) v)));
        } else if (v instanceof JSONArray) {
            JSONArray in = (JSONArray) v;
            JSONArray values = new JSONArray();
            for (int i = 0; i < in.length(); i++) values.put(encodeValue(in.opt(i)));
            o.put("arrayValue", new JSONObject().put("values", values));
        } else {
            o.put("stringValue", String.valueOf(v));
        }
        return o;
    }

    /** Documento Firestore -> JSON simples, com "id" = último segmento do nome. */
    static JSONObject decodeDocument(JSONObject doc) throws JSONException {
        JSONObject fields = doc.optJSONObject("fields");
        JSONObject out = fields == null ? new JSONObject() : decodeFields(fields);
        String name = doc.optString("name", "");
        out.put("id", name.substring(name.lastIndexOf('/') + 1));
        if (!out.has("created_at") && doc.has("createTime")) out.put("created_at", doc.getString("createTime"));
        return out;
    }

    static JSONObject decodeFields(JSONObject fields) throws JSONException {
        JSONObject out = new JSONObject();
        Iterator<String> it = fields.keys();
        while (it.hasNext()) {
            String k = it.next();
            out.put(k, decodeValue(fields.getJSONObject(k)));
        }
        return out;
    }

    static Object decodeValue(JSONObject v) throws JSONException {
        if (v.has("stringValue")) return v.getString("stringValue");
        if (v.has("integerValue")) return Long.parseLong(v.getString("integerValue"));
        if (v.has("doubleValue")) return v.getDouble("doubleValue");
        if (v.has("booleanValue")) return v.getBoolean("booleanValue");
        if (v.has("timestampValue")) return v.getString("timestampValue");
        if (v.has("referenceValue")) return v.getString("referenceValue");
        if (v.has("mapValue")) {
            JSONObject f = v.getJSONObject("mapValue").optJSONObject("fields");
            return f == null ? new JSONObject() : decodeFields(f);
        }
        if (v.has("arrayValue")) {
            JSONArray values = v.getJSONObject("arrayValue").optJSONArray("values");
            JSONArray out = new JSONArray();
            if (values != null) for (int i = 0; i < values.length(); i++) out.put(decodeValue(values.getJSONObject(i)));
            return out;
        }
        return JSONObject.NULL;
    }
}
