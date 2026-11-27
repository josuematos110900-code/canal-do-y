package com.ketshop.repositories;

import com.ketshop.managers.SessionManager;
import com.ketshop.network.ApiException;
import com.ketshop.network.SupabaseClient;
import com.ketshop.network.SupabaseConfig;

import org.json.JSONException;
import org.json.JSONObject;

/** Supabase Auth (GoTrue) via REST. Métodos síncronos. */
public final class AuthRepository {

    private AuthRepository() { }

    public static void signIn(String email, String password) throws ApiException {
        JSONObject body = new JSONObject();
        try {
            body.put("email", email.trim().toLowerCase());
            body.put("password", password);
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
        JSONObject res = SupabaseClient.authPublicPost("token?grant_type=password", body);
        if (!res.has("access_token")) throw ApiException.validation("Não foi possível iniciar sessão.");
        SessionManager.get().saveSession(res);
    }

    /**
     * Regista um novo cliente. Devolve true se a sessão já ficou activa,
     * false se o Supabase exige confirmação por e-mail.
     */
    public static boolean signUp(String fullName, String phone, String email, String password) throws ApiException {
        JSONObject body = new JSONObject();
        try {
            JSONObject data = new JSONObject();
            data.put("full_name", fullName.trim());
            data.put("phone", phone == null ? "" : phone.trim());
            body.put("email", email.trim().toLowerCase());
            body.put("password", password);
            body.put("data", data);
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
        JSONObject res = SupabaseClient.authPublicPost("signup", body);
        if (res.has("access_token")) {
            SessionManager.get().saveSession(res);
            return true;
        }
        // Com "Confirm email" activo, o Supabase devolve o utilizador sem sessão.
        // Se o e-mail já existir, devolve um utilizador sem identities (anti-enumeração).
        if (res.has("identities") && res.optJSONArray("identities") != null
                && res.optJSONArray("identities").length() == 0) {
            throw ApiException.validation("Já existe uma conta com este e-mail.");
        }
        return false;
    }

    public static void sendPasswordReset(String email) throws ApiException {
        JSONObject body = new JSONObject();
        try {
            body.put("email", email.trim().toLowerCase());
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
        String redirect = SupabaseConfig.PASSWORD_RESET_REDIRECT_URL;
        String path = "recover";
        if (redirect != null && redirect.startsWith("https://") && !redirect.contains("SEU-DOMINIO")) {
            path += "?redirect_to=" + SupabaseClient.enc(redirect);
        }
        SupabaseClient.authPublicPost(path, body);
    }

    public static void changePassword(String newPassword) throws ApiException {
        JSONObject body = new JSONObject();
        try {
            body.put("password", newPassword);
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
        SupabaseClient.authUserRequest("PUT", "user", body);
    }

    /** Termina a sessão no servidor (best effort) e limpa localmente. */
    public static void signOut() {
        try {
            SupabaseClient.authUserRequest("POST", "logout", new JSONObject());
        } catch (Exception ignored) {
            // mesmo sem rede, a sessão local é apagada
        }
        SessionManager.get().clear();
    }

    /** Elimina a conta através da Edge Function delete-account (service_role fica no servidor). */
    public static void deleteAccount() throws ApiException {
        JSONObject body = new JSONObject();
        try {
            body.put("confirm", "ELIMINAR");
        } catch (JSONException e) {
            throw ApiException.parse(e);
        }
        try {
            SupabaseClient.invokeFunction("delete-account", body);
        } catch (ApiException e) {
            if (e.getHttpCode() == 404) {
                throw ApiException.validation("O serviço de eliminação de conta não está disponível. Contacte o suporte.");
            }
            if ("OPEN_ORDERS".equals(e.getErrorCode())) {
                throw ApiException.validation("Tem encomendas em curso. Aguarde a conclusão antes de eliminar a conta.");
            }
            if ("STAFF_ACCOUNT".equals(e.getErrorCode())) {
                throw ApiException.validation("Contas da equipa não podem ser eliminadas pela app.");
            }
            throw e;
        }
        SessionManager.get().clear();
    }
}
