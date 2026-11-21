package com.ketshop.utils;

import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** Formatação de moeda (Kz), números e datas em português. */
public final class Formatters {

    private static final Locale PT = new Locale("pt", "AO");

    private Formatters() { }

    private static DecimalFormat intFormat() {
        DecimalFormatSymbols s = new DecimalFormatSymbols(PT);
        s.setGroupingSeparator('.');
        s.setDecimalSeparator(',');
        return new DecimalFormat("#,##0", s);
    }

    private static DecimalFormat decFormat() {
        DecimalFormatSymbols s = new DecimalFormatSymbols(PT);
        s.setGroupingSeparator('.');
        s.setDecimalSeparator(',');
        return new DecimalFormat("#,##0.00", s);
    }

    /** 1050 -> "1.050 Kz"; 10.5 -> "10,50 Kz" */
    public static String kz(double value) {
        boolean whole = Math.abs(value - Math.rint(value)) < 0.005;
        return (whole ? intFormat().format(Math.rint(value)) : decFormat().format(value)) + " Kz";
    }

    /** 1272 -> "1.272" */
    public static String number(long value) {
        return intFormat().format(value);
    }

    public static String bytes(long size) {
        if (size < 1024) return size + " B";
        if (size < 1024 * 1024) return String.format(PT, "%.0f KB", size / 1024.0);
        return String.format(PT, "%.1f MB", size / (1024.0 * 1024.0));
    }

    /**
     * Converte timestamps ISO-8601 do PostgreSQL (ex.: 2026-11-21T14:03:22.123456+00:00)
     * para Date, sem java.time (indisponível em API &lt; 26).
     */
    public static Date parseIso(String iso) {
        if (iso == null || iso.length() < 19) return null;
        try {
            String base = iso.substring(0, 19);
            String rest = iso.substring(19);
            int tzIdx = -1;
            for (int i = 0; i < rest.length(); i++) {
                char c = rest.charAt(i);
                if (c == '+' || c == '-' || c == 'Z') { tzIdx = i; break; }
            }
            String tz = tzIdx >= 0 ? rest.substring(tzIdx) : "Z";
            if ("Z".equals(tz)) tz = "+00:00";
            if (tz.length() == 3) tz = tz + ":00";
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            f.setTimeZone(TimeZone.getTimeZone("GMT" + tz));
            return f.parse(base.replace(' ', 'T'));
        } catch (Exception e) {
            return null;
        }
    }

    public static String dateTime(String iso) {
        Date d = parseIso(iso);
        if (d == null) return "";
        return new SimpleDateFormat("dd/MM/yyyy 'às' HH:mm", PT).format(d);
    }

    public static String date(String iso) {
        Date d = parseIso(iso);
        if (d == null) return "";
        return new SimpleDateFormat("dd/MM/yyyy", PT).format(d);
    }

    /** "agora", "há 5 min", "há 3 h", "ontem", ou data. */
    public static String relative(String iso) {
        Date d = parseIso(iso);
        if (d == null) return "";
        long diff = (System.currentTimeMillis() - d.getTime()) / 1000L;
        if (diff < 60) return "agora";
        if (diff < 3600) return "há " + (diff / 60) + " min";
        if (diff < 86400) return "há " + (diff / 3600) + " h";
        if (diff < 172800) return "ontem";
        return new SimpleDateFormat("dd/MM/yyyy", PT).format(d);
    }

    public static String greeting() {
        int h = Integer.parseInt(new SimpleDateFormat("H", PT).format(new Date()));
        if (h < 12) return "Bom dia";
        if (h < 19) return "Boa tarde";
        return "Boa noite";
    }
}
