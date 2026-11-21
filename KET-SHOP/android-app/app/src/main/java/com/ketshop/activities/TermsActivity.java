package com.ketshop.activities;

import android.os.Bundle;
import android.view.View;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.repositories.SettingsRepository;
import com.ketshop.utils.LegalText;

/**
 * Mostra o texto definido no painel (app_settings.terms_text); se estiver vazio
 * ou sem rede, usa o texto incluído no APK (assets/terms.txt).
 */
public class TermsActivity extends BaseActivity {

    private TextView text, source;
    private View progress;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_terms);
        setupToolbar(getString(R.string.terms_title), true);
        text = findViewById(R.id.terms_text);
        source = findViewById(R.id.terms_source);
        progress = findViewById(R.id.terms_progress);
        call(() -> SettingsRepository.publicSettings(false), s -> {
            String remote = SettingsRepository.getString(s, "terms_text");
            show(remote.isEmpty() ? null : remote);
        }, e -> show(null));
    }

    private void show(String remote) {
        progress.setVisibility(View.GONE);
        if (remote != null) {
            text.setText(remote);
            source.setText(R.string.legal_source_remote);
        } else {
            text.setText(LegalText.fromAssets(this, "terms.txt"));
            source.setText(R.string.legal_source_local);
        }
    }
}
