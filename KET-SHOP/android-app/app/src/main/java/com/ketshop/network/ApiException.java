package com.ketshop.network;

import org.json.JSONObject;

/**
 * Erro de API com mensagem já traduzida para o utilizador.
 */
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

    public static ApiException network() {
        return new ApiException(NETWORK, "NETWORK", "Sem ligação à Internet. Verifique a rede e tente novamente.");
    }

    public static ApiException sessionExpired() {
        return new ApiException(SESSION_EXPIRED, "SESSION_EXPIRED", "A sua sessão expirou. Inicie sessão novamente.");
    }

    public static ApiException notConfigured() {
        return new ApiException(NOT_CONFIGURED, "NOT_CONFIGURED",
                "A app ainda não está ligada ao Supabase. Configure SupabaseConfig.java (ver CODEASSIST.md).");
    }

    public static ApiException parse(Exception e) {
        return new ApiException(PARSE, "PARSE", "Resposta inesperada do servidor. Tente novamente.");
    }

    public static ApiException validation(String message) {
        return new ApiException(VALIDATION, "VALIDATION", message);
    }

    /** Constrói a excepção a partir da resposta HTTP (GoTrue, PostgREST ou Storage). */
    public static ApiException fromResponse(int http, String body) {
        String code = "";
        String raw = "";
        try {
            JSONObject o = new JSONObject(body == null || body.isEmpty() ? "{}" : body);
            code = firstNonEmpty(o.optString("error_code"), o.optString("code"), o.optString("error"));
            raw = firstNonEmpty(o.optString("message"), o.optString("msg"),
                    o.optString("error_description"), o.optString("error"));
        } catch (Exception ignored) {
            raw = body == null ? "" : body;
        }
        return new ApiException(http, code, translate(http, code, raw));
    }

    private static String translate(int http, String code, String raw) {
        String r = raw == null ? "" : raw;
        String lower = r.toLowerCase();

        // Erros das nossas funções SQL: "CODIGO: mensagem em português"
        int sep = r.indexOf(": ");
        if (sep > 2 && sep < 40 && r.substring(0, sep).matches("[A-Z_]+")) {
            String msg = r.substring(sep + 2).trim();
            if (msg.isEmpty()) return "Ocorreu um erro. Tente novamente.";
            return Character.toUpperCase(msg.charAt(0)) + msg.substring(1) + (msg.endsWith(".") ? "" : ".");
        }

        if (http == 429 || lower.contains("rate limit") || lower.contains("too many")) {
            return "Demasiadas tentativas. Aguarde alguns minutos e tente novamente.";
        }
        if (lower.contains("invalid login credentials") || "invalid_credentials".equals(code)) {
            return "E-mail ou palavra-passe incorrectos.";
        }
        if (lower.contains("email not confirmed") || "email_not_confirmed".equals(code)) {
            return "Confirme o seu e-mail (verifique a caixa de entrada) antes de iniciar sessão.";
        }
        if (lower.contains("already registered") || lower.contains("already exists") || "user_already_exists".equals(code)) {
            return "Já existe uma conta com este e-mail.";
        }
        if (lower.contains("password should be") || "weak_password".equals(code)) {
            return "A palavra-passe é demasiado fraca. Use pelo menos 8 caracteres com letras e números.";
        }
        if (lower.contains("same_password") || lower.contains("different from the old")) {
            return "A nova palavra-passe tem de ser diferente da actual.";
        }
        if (lower.contains("invalid email") || "email_address_invalid".equals(code)) {
            return "Endereço de e-mail inválido.";
        }
        if (lower.contains("signups not allowed") || "signup_disabled".equals(code)) {
            return "O registo de novas contas está desactivado.";
        }
        if (lower.contains("payload too large") || http == 413) {
            return "O ficheiro é demasiado grande (máximo 5 MB).";
        }
        if (lower.contains("mime type") || lower.contains("invalid_mime_type")) {
            return "Formato de ficheiro não suportado. Use JPG, PNG ou WEBP.";
        }
        if (lower.contains("row-level security") || lower.contains("violates row-level") || http == 403) {
            return "Não tem permissão para realizar esta operação.";
        }
        if (lower.contains("jwt expired") || http == 401) {
            return "A sua sessão expirou. Inicie sessão novamente.";
        }
        if (http == 404) {
            return "Recurso não encontrado. Verifique se o Supabase foi configurado (SQL instalado).";
        }
        if (http >= 500) {
            return "O servidor está indisponível de momento. Tente novamente mais tarde.";
        }
        return r.isEmpty() ? "Ocorreu um erro (" + http + "). Tente novamente." : r;
    }

    private static String firstNonEmpty(String... values) {
        for (String v : values) {
            if (v != null && !v.isEmpty() && !"null".equals(v)) return v;
        }
        return "";
    }
}
