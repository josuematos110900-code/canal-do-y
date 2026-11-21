package com.ketshop.network;

import com.ketshop.managers.SessionManager;

import java.util.HashMap;
import java.util.Map;

/** Pedidos HTTP autenticados com o ID token do Firebase (renova e repete uma vez em 401). */
final class FirebaseHttp {

    private FirebaseHttp() { }

    static HttpClient.Response authorized(String method, String url, byte[] body, String contentType,
                                          String authScheme, HttpClient.ProgressListener listener,
                                          int timeout, boolean allowAnonymous) throws ApiException {
        return authorized(method, url, body, contentType, authScheme, listener, timeout, allowAnonymous, null);
    }

    static HttpClient.Response authorized(String method, String url, byte[] body, String contentType,
                                          String authScheme, HttpClient.ProgressListener listener,
                                          int timeout, boolean allowAnonymous, Map<String, String> extra) throws ApiException {
        if (!FirebaseConfig.isConfigured()) throw ApiException.notConfigured();
        SessionManager session = SessionManager.get();
        String token = session.getValidIdToken();
        if (token == null && !allowAnonymous) throw ApiException.sessionExpired();
        HttpClient.Response r = HttpClient.execute(method, url, headers(token, contentType, authScheme, extra), body, timeout, listener);
        if (r.code == 401 && token != null) {
            token = session.forceRefresh();
            r = HttpClient.execute(method, url, headers(token, contentType, authScheme, extra), body, timeout, listener);
        }
        if (!r.ok()) throw ApiException.fromResponse(r.code, r.text());
        return r;
    }

    private static Map<String, String> headers(String token, String contentType, String scheme, Map<String, String> extra) {
        Map<String, String> h = new HashMap<>();
        if (extra != null) h.putAll(extra);
        if (token != null) h.put("Authorization", (scheme == null ? "Bearer " : scheme + " ") + token);
        if (contentType != null) h.put("Content-Type", contentType);
        return h;
    }

    static byte[] utf8(String s) {
        try {
            return s.getBytes("UTF-8");
        } catch (Exception e) {
            return new byte[0];
        }
    }
}
