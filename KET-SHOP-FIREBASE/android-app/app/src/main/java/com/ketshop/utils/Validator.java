package com.ketshop.utils;

import android.util.Patterns;

/** Validação de campos (devolve null se válido ou a mensagem de erro). */
public final class Validator {

    private Validator() { }

    public static String email(String v) {
        if (v == null || v.trim().isEmpty()) return "Indique o e-mail.";
        if (!Patterns.EMAIL_ADDRESS.matcher(v.trim()).matches()) return "E-mail inválido.";
        return null;
    }

    public static String passwordLogin(String v) {
        if (v == null || v.isEmpty()) return "Indique a palavra-passe.";
        return null;
    }

    public static String newPassword(String v) {
        if (v == null || v.length() < 8) return "Use pelo menos 8 caracteres.";
        if (v.length() > 72) return "Máximo de 72 caracteres.";
        boolean letter = false, digit = false;
        for (int i = 0; i < v.length(); i++) {
            char c = v.charAt(i);
            if (Character.isLetter(c)) letter = true;
            if (Character.isDigit(c)) digit = true;
        }
        if (!letter || !digit) return "Use letras e números.";
        return null;
    }

    public static String confirm(String pass, String confirm) {
        if (confirm == null || !confirm.equals(pass)) return "As palavras-passe não coincidem.";
        return null;
    }

    public static String fullName(String v) {
        if (v == null || v.trim().length() < 3) return "Indique o nome completo.";
        if (v.trim().length() > 120) return "Nome demasiado longo.";
        if (!v.trim().contains(" ")) return "Indique nome e apelido.";
        return null;
    }

    /** Telefone angolano: 9 dígitos a começar por 9, com ou sem +244. Opcional se allowEmpty. */
    public static String phone(String v, boolean allowEmpty) {
        String d = v == null ? "" : v.replaceAll("[\\s-]", "");
        if (d.isEmpty()) return allowEmpty ? null : "Indique o telefone.";
        if (d.startsWith("+244")) d = d.substring(4);
        else if (d.startsWith("00244")) d = d.substring(5);
        if (!d.matches("9[0-9]{8}")) return "Telefone inválido (ex.: 923 456 789).";
        return null;
    }

    public static String normalizePhone(String v) {
        String d = v == null ? "" : v.replaceAll("[\\s-]", "");
        if (d.isEmpty()) return "";
        if (d.startsWith("+244")) d = d.substring(4);
        else if (d.startsWith("00244")) d = d.substring(5);
        return "+244" + d;
    }

    /** ID Free Fire: apenas dígitos, 5 a 15. */
    public static String playerId(String v) {
        String d = v == null ? "" : v.replaceAll("\\s", "");
        if (d.isEmpty()) return "Indique o ID do jogador.";
        if (!d.matches("[0-9]+")) return "O ID deve conter apenas números.";
        if (d.length() < 5 || d.length() > 15) return "O ID deve ter entre 5 e 15 dígitos.";
        return null;
    }

    public static String nickname(String v) {
        if (v != null && v.trim().length() > 40) return "Máximo de 40 caracteres.";
        return null;
    }
}
