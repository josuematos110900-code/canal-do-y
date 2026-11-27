package com.ketshop.utils;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.graphics.drawable.GradientDrawable;
import android.view.View;
import android.view.animation.AnimationUtils;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import com.ketshop.R;
import com.ketshop.models.OrderStatus;

public final class UiUtils {

    private UiUtils() { }

    public static void toast(Context c, String msg) {
        Toast.makeText(c, msg, Toast.LENGTH_LONG).show();
    }

    public static int dp(Context c, int v) {
        return Math.round(v * c.getResources().getDisplayMetrics().density);
    }

    public static void hideKeyboard(Activity a) {
        View v = a.getCurrentFocus();
        if (v == null) return;
        InputMethodManager imm = (InputMethodManager) a.getSystemService(Context.INPUT_METHOD_SERVICE);
        if (imm != null) imm.hideSoftInputFromWindow(v.getWindowToken(), 0);
    }

    public static void copy(Context c, String label, String text) {
        ClipboardManager cm = (ClipboardManager) c.getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm != null) {
            cm.setPrimaryClip(ClipData.newPlainText(label, text));
            toast(c, label + " copiado.");
        }
    }

    /** Mostra erro no campo e devolve false se houver erro. */
    public static boolean check(EditText field, String error) {
        if (error != null) {
            field.setError(error);
            field.requestFocus();
            shake(field);
            return false;
        }
        field.setError(null);
        return true;
    }

    public static String text(EditText e) {
        return e.getText() == null ? "" : e.getText().toString().trim();
    }

    public static void shake(View v) {
        v.animate().translationX(12).setDuration(60).withEndAction(() ->
                v.animate().translationX(-12).setDuration(60).withEndAction(() ->
                        v.animate().translationX(0).setDuration(60).start()).start()).start();
    }

    public static void slideUp(View v) {
        v.startAnimation(AnimationUtils.loadAnimation(v.getContext(), R.anim.slide_up));
    }

    public static void confirm(Context c, String title, String message, String positive, Runnable onYes) {
        new AlertDialog.Builder(c)
                .setTitle(title)
                .setMessage(message)
                .setPositiveButton(positive, (d, w) -> onYes.run())
                .setNegativeButton(R.string.action_cancel, null)
                .show();
    }

    public static void info(Context c, String title, String message) {
        new AlertDialog.Builder(c)
                .setTitle(title)
                .setMessage(message)
                .setPositiveButton(R.string.action_ok, null)
                .show();
    }

    /** Aplica a cor do estado a uma "pill" (TextView com fundo bg_pill). */
    public static void statusPill(TextView tv, OrderStatus status) {
        int color = tv.getContext().getResources().getColor(status.colorRes);
        tv.setText(status.label);
        tv.setTextColor(color);
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(dp(tv.getContext(), 12));
        g.setColor((color & 0x00FFFFFF) | 0x26000000);
        g.setStroke(dp(tv.getContext(), 1), (color & 0x00FFFFFF) | 0x66000000);
        tv.setBackground(g);
    }
}
