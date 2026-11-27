package com.ketshop.network;

import com.ketshop.managers.SessionManager;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;

/** Firebase Authentication via REST (Identity Toolkit). Métodos SÍNCRONOS. */
public final class FirebaseAuthApi {

    private FirebaseAuthApi() { }

    public static JSONObject call(String method, JSONObject body) throws ApiException {
        if (!FirebaseConfig.isConfigured()) throw ApiException.notConfigured();
        Map<String, String> h = new HashMap<>();
        h.put("Content-Type", "application/json");
        HttpClient.Response r = HttpClient.execute("POST", FirebaseConfig.authUrl(method), h,
                FirebaseHttp.utf8(body.toString()), FirebaseConfig.READ_TIMEOUT_MS, null);
        if (!r.ok()) throw ApiException.fromResponse(r.code, r.text());
        try {
            return new JSONObject(r.text());
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
    }

    public static JSONObject signIn(String email, String password) throws ApiException {
        try {
            return call("signInWithPassword", new JSONObject().put("email", email).put("password", password)
                    .put("returnSecureToken", true));
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
    }

    public static JSONObject signUp(String email, String password) throws ApiException {
        try {
            return call("signUp", new JSONObject().put("email", email).put("password", password)
                    .put("returnSecureToken", true));
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
    }

    /** E-mail de redefinição (a página de redefinição é a do próprio Firebase). */
    public static void sendPasswordReset(String email) throws ApiException {
        try {
            call("sendOobCode", new JSONObject().put("requestType", "PASSWORD_RESET").put("email", email));
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
    }

    public static void sendEmailVerification() throws ApiException {
        try {
            call("sendOobCode", new JSONObject().put("requestType", "VERIFY_EMAIL")
                    .put("idToken", SessionManager.get().getValidIdToken()));
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
    }

    public static JSONObject changePassword(String newPassword) throws ApiException {
        try {
            return call("update", new JSONObject().put("idToken", SessionManager.get().getValidIdToken())
                    .put("password", newPassword).put("returnSecureToken", true));
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
    }

    public static void deleteAccount() throws ApiException {
        try {
            call("delete", new JSONObject().put("idToken", SessionManager.get().getValidIdToken()));
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
    }
}
