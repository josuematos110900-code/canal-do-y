package com.ketshop.activities;

import android.os.Bundle;
import android.view.View;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.repositories.SettingsRepository;
import com.ketshop.utils.LegalText;

/**
 * Mostra o texto definido no painel (app_settings.privacy_text); se estiver vazio
 * ou sem rede, usa o texto incluído no APK (assets/privacy.txt).
 */
public class PrivacyActivity extends BaseActivity {

    private TextView text, source;
    private View progress;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_privacy);
        setupToolbar(getString(R.string.privacy_title), true);
        text = findViewById(R.id.privacy_text);
        source = findViewById(R.id.privacy_source);
        progress = findViewById(R.id.privacy_progress);
        call(() -> SettingsRepository.publicSettings(false), s -> {
            String remote = SettingsRepository.getString(s, "privacy_text");
            show(remote.isEmpty() ? null : remote);
        }, e -> show(null));
    }

    private void show(String remote) {
        progress.setVisibility(View.GONE);
        if (remote != null) {
            text.setText(remote);
            source.setText(R.string.legal_source_remote);
        } else {
            text.setText(LegalText.fromAssets(this, "privacy.txt"));
            source.setText(R.string.legal_source_local);
        }
    }
}
