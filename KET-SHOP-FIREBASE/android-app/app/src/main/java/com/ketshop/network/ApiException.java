package com.ketshop.network;

import org.json.JSONObject;

/** Erro de API com mensagem já traduzida para o utilizador (Firebase Auth, Firestore, Storage). */
public class ApiException extends Exception {

    public static final int NETWORK = -1;
    public static final int SESSION_EXPIRED = -2;
    public static final int NOT_CONFIGURED = -3;
    public static final int PARSE = -4;
    public static final int VALIDATION = -5;

    private final int httpCode;
    private final String errorCode;

    public ApiException(int httpCode, String errorCode, String userMessage) {
        super(userMessage);
        this.httpCode = httpCode;
        this.errorCode = errorCode == null ? "" : errorCode;
    }

    public int getHttpCode() { return httpCode; }
    public String getErrorCode() { return errorCode; }
    public boolean isSessionExpired() { return httpCode == SESSION_EXPIRED; }
    public boolean isNetwork() { return httpCode == NETWORK; }
    public boolean isPermissionDenied() { return "PERMISSION_DENIED".equals(errorCode) || httpCode == 403; }
    public boolean isNotFound() { return "NOT_FOUND".equals(errorCode) || httpCode == 404; }
    public boolean isMissingIndex() { return "FAILED_PRECONDITION".equals(errorCode) && getMessage().contains("índice"); }

    public static ApiException network() {
        return new ApiException(NETWORK, "NETWORK", "Sem ligação à Internet. Verifique a rede e tente novamente.");
    }

    public static ApiException sessionExpired() {
        return new ApiException(SESSION_EXPIRED, "SESSION_EXPIRED", "A sua sessão expirou. Inicie sessão novamente.");
    }

    public static ApiException notConfigured() {
        return new ApiException(NOT_CONFIGURED, "NOT_CONFIGURED",
                "A app ainda não está ligada ao Firebase. Configure FirebaseConfig.java (ver CODEASSIST.md).");
    }

    public static ApiException parse(Exception e) {
        return new ApiException(PARSE, "PARSE", "Resposta inesperada do servidor. Tente novamente.");
    }

    public static ApiException validation(String message) {
        return new ApiException(VALIDATION, "VALIDATION", message);
    }

    /** Respostas de erro Google: {"error":{"code":400,"message":"EMAIL_EXISTS","status":"..."}} */
    public static ApiException fromResponse(int http, String body) {
        String message = "";
        String status = "";
        try {
            JSONObject root = new JSONObject(body == null || body.isEmpty() ? "{}" : body);
            Object err = root.opt("error");
            if (err instanceof JSONObject) {
                message = ((JSONObject) err).optString("message", "");
                status = ((JSONObject) err).optString("status", "");
            } else if (root.has("error")) {
                message = root.optString("error_description", root.optString("error"));
            }
        } catch (Exception ignored) {
            message = body == null ? "" : body;
        }
        // Firebase Auth devolve o código no "message" (ex.: "WEAK_PASSWORD : Password should be...")
        String authCode = message.split("[ :]")[0];
        String code = !status.isEmpty() && !"INVALID_ARGUMENT".equals(status) ? status : authCode;
        return new ApiException(http, code, translate(http, authCode, status, message));
    }

    private static String translate(int http, String authCode, String status, String raw) {
        switch (authCode) {
            case "EMAIL_EXISTS": return "Já existe uma conta com este e-mail.";
            case "INVALID_LOGIN_CREDENTIALS":
            case "INVALID_PASSWORD":
            case "EMAIL_NOT_FOUND": return "E-mail ou palavra-passe incorrectos.";
            case "USER_DISABLED": return "Esta conta foi desactivada. Contacte o suporte.";
            case "TOO_MANY_ATTEMPTS_TRY_LATER": return "Demasiadas tentativas. Aguarde alguns minutos e tente novamente.";
            case "WEAK_PASSWORD": return "A palavra-passe é demasiado fraca. Use pelo menos 8 caracteres com letras e números.";
            case "INVALID_EMAIL": return "Endereço de e-mail inválido.";
            case "OPERATION_NOT_ALLOWED": return "O início de sessão por e-mail não está activo no Firebase (Authentication → Sign-in method).";
            case "CREDENTIAL_TOO_OLD_LOGIN_AGAIN":
            case "TOKEN_EXPIRED":
            case "INVALID_ID_TOKEN":
            case "USER_NOT_FOUND": return "Por segurança, termine sessão e entre novamente antes desta operação.";
            case "INVALID_REFRESH_TOKEN": return "A sua sessão expirou. Inicie sessão novamente.";
            default: break;
        }
        if ("PERMISSION_DENIED".equals(status) || http == 403) {
            return "Operação não autorizada. Os dados podem ter mudado (preço, estado da encomenda) — actualize e tente novamente.";
        }
        if ("UNAUTHENTICATED".equals(status) || http == 401) return "A sua sessão expirou. Inicie sessão novamente.";
        if ("NOT_FOUND".equals(status) || http == 404) return "Registo não encontrado.";
        if ("FAILED_PRECONDITION".equals(status) && raw.contains("index")) {
            return "Falta criar um índice no Firestore (ver FIREBASE.md, secção Índices).";
        }
        if ("ALREADY_EXISTS".equals(status)) return "Este registo já existe. Tente novamente.";
        if ("RESOURCE_EXHAUSTED".equals(status) || http == 429) return "Limite de utilização atingido. Tente mais tarde.";
        if (http == 413) return "O ficheiro é demasiado grande (máximo 5 MB).";
        if (http >= 500) return "O servidor está indisponível de momento. Tente novamente mais tarde.";
        return raw == null || raw.isEmpty() ? "Ocorreu um erro (" + http + "). Tente novamente." : raw;
    }
}
