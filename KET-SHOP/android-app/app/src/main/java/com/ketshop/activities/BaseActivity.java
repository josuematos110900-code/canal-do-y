package com.ketshop.activities;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.widget.ImageButton;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.managers.PrefsManager;
import com.ketshop.managers.SessionManager;
import com.ketshop.network.ApiException;
import com.ketshop.network.Async;
import com.ketshop.utils.UiUtils;

/**
 * Base de todas as Activities: barra superior, chamadas assíncronas
 * seguras (ignora resultados se o ecrã já fechou) e tratamento central
 * de sessão expirada.
 */
public abstract class BaseActivity extends Activity {

    protected PrefsManager prefs;
    private boolean destroyed;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        SessionManager.init(getApplicationContext());
        prefs = new PrefsManager(this);
    }

    @Override
    public void setContentView(int layoutResID) {
        super.setContentView(layoutResID);
        applySystemBarInsets();
    }

    /**
     * Android 15+ (targetSdk 35/36) desenha a app de ponta a ponta, por baixo da barra
     * de estado e da barra de navegação. Aqui afastamos o conteúdo dessas barras (e do
     * teclado), para nada ficar escondido. Em versões anteriores o sistema já o faz.
     */
    private void applySystemBarInsets() {
        if (Build.VERSION.SDK_INT < 35) return;
        ViewGroup content = findViewById(android.R.id.content);
        if (content == null || content.getChildCount() == 0) return;
        final View root = content.getChildAt(0);
        final int l = root.getPaddingLeft(), t = root.getPaddingTop(), r = root.getPaddingRight(), b = root.getPaddingBottom();
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            android.graphics.Insets ime = insets.getInsets(WindowInsets.Type.ime());
            v.setPadding(l + bars.left, t + bars.top, r + bars.right, b + Math.max(bars.bottom, ime.bottom));
            return WindowInsets.CONSUMED;
        });
        root.requestApplyInsets();
    }

    @Override
    protected void onDestroy() {
        destroyed = true;
        super.onDestroy();
    }

    protected boolean isAlive() {
        return !destroyed && !isFinishing();
    }

    /** Ecrãs que exigem sessão chamam isto em onCreate. Devolve false se redireccionou. */
    protected boolean requireSession() {
        if (!SessionManager.get().isLoggedIn()) {
            goToLogin(null);
            return false;
        }
        return true;
    }

    protected void goToLogin(String message) {
        Intent i = new Intent(this, LoginActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        if (message != null) i.putExtra(LoginActivity.EXTRA_MESSAGE, message);
        startActivity(i);
        finish();
    }

    /** Configura a barra superior (include layout/view_toolbar.xml). */
    protected void setupToolbar(String title, boolean showBack) {
        TextView t = findViewById(R.id.toolbar_title);
        if (t != null) t.setText(title);
        ImageButton back = findViewById(R.id.toolbar_back);
        if (back != null) {
            back.setVisibility(showBack ? View.VISIBLE : View.GONE);
            back.setOnClickListener(v -> onBackPressed());
        }
    }

    protected ImageButton toolbarAction(int iconRes, View.OnClickListener l) {
        ImageButton b = findViewById(R.id.toolbar_action);
        if (b != null) {
            b.setImageResource(iconRes);
            b.setVisibility(View.VISIBLE);
            b.setOnClickListener(l);
        }
        return b;
    }

    /** Executa uma tarefa em background com tratamento de erro por omissão (toast). */
    protected <T> void call(Async.Task<T> task, Async.OnSuccess<T> onSuccess) {
        call(task, onSuccess, e -> UiUtils.toast(this, e.getMessage()));
    }

    protected <T> void call(Async.Task<T> task, Async.OnSuccess<T> onSuccess, Async.OnError onError) {
        Async.run(task, result -> {
            if (isAlive() && onSuccess != null) onSuccess.accept(result);
        }, error -> {
            if (!isAlive()) return;
            if (handleSessionError(error)) return;
            if (onError != null) onError.accept(error);
        });
    }

    /** Se a sessão expirou, envia para o login. */
    protected boolean handleSessionError(ApiException e) {
        if (e.isSessionExpired()) {
            SessionManager.get().clear();
            goToLogin(e.getMessage());
            return true;
        }
        return false;
    }

    protected void setLoading(View button, View progress, boolean loading) {
        if (button != null) {
            button.setEnabled(!loading);
            button.setAlpha(loading ? 0.6f : 1f);
        }
        if (progress != null) progress.setVisibility(loading ? View.VISIBLE : View.GONE);
    }
}
