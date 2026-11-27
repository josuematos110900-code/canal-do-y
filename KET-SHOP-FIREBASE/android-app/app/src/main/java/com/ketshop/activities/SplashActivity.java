package com.ketshop.activities;

import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.animation.AnimationUtils;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.managers.SessionManager;
import com.ketshop.models.Profile;
import com.ketshop.network.ApiException;
import com.ketshop.network.Async;
import com.ketshop.network.FirebaseConfig;
import com.ketshop.repositories.AuthRepository;
import com.ketshop.repositories.ProfileRepository;
import com.ketshop.repositories.SettingsRepository;

import java.util.Map;

public class SplashActivity extends BaseActivity {

    private ProgressBar progress;
    private TextView error;
    private Button retry;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);
        ImageView logo = findViewById(R.id.splash_logo);
        progress = findViewById(R.id.splash_progress);
        error = findViewById(R.id.splash_error);
        retry = findViewById(R.id.splash_retry);
        logo.startAnimation(AnimationUtils.loadAnimation(this, R.anim.logo_enter));
        findViewById(R.id.splash_title).startAnimation(AnimationUtils.loadAnimation(this, R.anim.slide_up));
        retry.setOnClickListener(v -> start());
        Async.mainDelayed(this::start, 1100);
    }

    private void start() {
        if (!isAlive()) return;
        error.setVisibility(View.GONE);
        retry.setVisibility(View.GONE);
        progress.setVisibility(View.VISIBLE);

        if (!FirebaseConfig.isConfigured()) {
            showError(ApiException.notConfigured().getMessage(), false);
            return;
        }
        call(() -> SettingsRepository.publicSettings(true), this::checkVersionThenRoute, e -> {
            if (e.isNetwork()) showError(e.getMessage(), true);
            else route(); // definições indisponíveis não bloqueiam a app
        });
    }

    private void checkVersionThenRoute(Map<String, Object> settings) {
        int min = SettingsRepository.getInt(settings, "min_android_version", 1);
        int current = 1;
        try {
            PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
            current = pi.versionCode;
        } catch (Exception ignored) {
            // mantém 1
        }
        if (current < min) {
            progress.setVisibility(View.GONE);
            new AlertDialog.Builder(this)
                    .setTitle(R.string.update_required_title)
                    .setMessage(R.string.update_required_message)
                    .setCancelable(false)
                    .setPositiveButton(R.string.action_ok, (d, w) -> finish())
                    .show();
            return;
        }
        route();
    }

    private void route() {
        if (!prefs.isOnboardingDone()) {
            open(OnboardingActivity.class);
            return;
        }
        if (!SessionManager.get().isLoggedIn()) {
            open(LoginActivity.class);
            return;
        }
        // Valida a sessão e o estado da conta
        call(ProfileRepository::getMyProfile, this::onProfile, e -> {
            if (e.isNetwork()) open(HomeActivity.class); // offline: entra e mostra erros nos ecrãs
            else open(LoginActivity.class);
        });
    }

    private void onProfile(Profile p) {
        if (p.blocked) {
            Async.run(() -> { AuthRepository.signOut(); return true; }, r -> { }, e -> { });
            goToLogin(getString(R.string.account_blocked) + (p.blockedReason != null ? " " + p.blockedReason : ""));
            return;
        }
        open(HomeActivity.class);
    }

    private void open(Class<?> c) {
        startActivity(new Intent(this, c));
        overridePendingTransition(R.anim.fade_in, R.anim.fade_out);
        finish();
    }

    private void showError(String message, boolean canRetry) {
        progress.setVisibility(View.GONE);
        error.setVisibility(View.VISIBLE);
        error.setText(message);
        retry.setVisibility(canRetry ? View.VISIBLE : View.GONE);
        if (!canRetry) {
            error.setOnClickListener(v -> {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://console.firebase.google.com")));
                } catch (Exception ignored) {
                    // sem navegador
                }
            });
        }
    }
}
