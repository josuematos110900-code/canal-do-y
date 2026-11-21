package com.ketshop.utils;

import android.content.Context;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/** Lê os textos legais incluídos no APK (assets) como alternativa ao texto do painel. */
public final class LegalText {

    private LegalText() { }

    public static String fromAssets(Context c, String fileName) {
        try {
            InputStream is = c.getAssets().open(fileName);
            try {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[4096];
                int n;
                while ((n = is.read(buf)) != -1) out.write(buf, 0, n);
                return out.toString("UTF-8");
            } finally {
                is.close();
            }
        } catch (Exception e) {
            return "";
        }
    }
}
