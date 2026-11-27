package com.ketshop.activities;

import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioGroup;
import android.widget.Switch;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.managers.NotificationScheduler;
import com.ketshop.repositories.AuthRepository;
import com.ketshop.utils.ProofFileProvider;
import com.ketshop.utils.UiUtils;
import com.ketshop.utils.Validator;

import java.io.File;

public class SettingsActivity extends BaseActivity {

    private EditText newPassword, newPasswordConfirm;
    private Button changePassword;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!requireSession()) return;
        setContentView(R.layout.activity_settings);
        setupToolbar(getString(R.string.settings_title), true);

        Switch notif = findViewById(R.id.settings_notifications);
        notif.setChecked(prefs.isNotificationsEnabled());
        notif.setOnCheckedChangeListener((b, checked) -> {
            prefs.setNotificationsEnabled(checked);
            if (checked) {
                NotificationScheduler.schedule(this);
                if (Build.VERSION.SDK_INT >= 33) {
                    requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 502);
                }
            } else {
                NotificationScheduler.cancel(this);
            }
        });

        RadioGroup interval = findViewById(R.id.settings_interval);
        int s = prefs.getPollSeconds();
        interval.check(s <= 15 ? R.id.settings_interval_15 : s <= 30 ? R.id.settings_interval_30 : R.id.settings_interval_60);
        interval.setOnCheckedChangeListener((g, id) -> {
            prefs.setPollSeconds(id == R.id.settings_interval_15 ? 15 : id == R.id.settings_interval_30 ? 30 : 60);
            UiUtils.toast(this, getString(R.string.settings_saved));
        });

        newPassword = findViewById(R.id.settings_new_password);
        newPasswordConfirm = findViewById(R.id.settings_new_password_confirm);
        changePassword = findViewById(R.id.settings_change_password);
        changePassword.setOnClickListener(v -> doChangePassword());

        findViewById(R.id.settings_clear_player).setOnClickListener(v -> {
            prefs.clearLastPlayer();
            UiUtils.toast(this, getString(R.string.settings_player_cleared));
        });
        findViewById(R.id.settings_clear_cache).setOnClickListener(v -> {
            File[] files = ProofFileProvider.proofDir(this).listFiles();
            int n = 0;
            if (files != null) for (File f : files) if (f.delete()) n++;
            UiUtils.toast(this, getString(R.string.settings_cache_cleared, n));
        });
        findViewById(R.id.settings_terms).setOnClickListener(v -> startActivity(new Intent(this, TermsActivity.class)));
        findViewById(R.id.settings_privacy).setOnClickListener(v -> startActivity(new Intent(this, PrivacyActivity.class)));
        findViewById(R.id.settings_delete_account).setOnClickListener(v -> askDelete());

        String version = "1.0";
        try {
            PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
            version = pi.versionName + " (" + pi.versionCode + ")";
        } catch (Exception ignored) {
            // mantém valor
        }
        ((TextView) findViewById(R.id.settings_version)).setText(getString(R.string.settings_version, version));
    }

    private void doChangePassword() {
        String p = newPassword.getText().toString();
        String c = newPasswordConfirm.getText().toString();
        if (!UiUtils.check(newPassword, Validator.newPassword(p))) return;
        if (!UiUtils.check(newPasswordConfirm, Validator.confirm(p, c))) return;
        UiUtils.hideKeyboard(this);
        setLoading(changePassword, null, true);
        call(() -> { AuthRepository.changePassword(p); return true; }, ok -> {
            setLoading(changePassword, null, false);
            newPassword.setText("");
            newPasswordConfirm.setText("");
            UiUtils.info(this, getString(R.string.settings_change_password), getString(R.string.settings_password_changed));
        }, e -> {
            setLoading(changePassword, null, false);
            UiUtils.toast(this, e.getMessage());
        });
    }

    private void askDelete() {
        final EditText confirm = new EditText(this);
        confirm.setHint("ELIMINAR");
        confirm.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
        confirm.setTextColor(getResources().getColor(R.color.text_primary));
        LinearLayout box = new LinearLayout(this);
        int pad = UiUtils.dp(this, 20);
        box.setPadding(pad, 0, pad, 0);
        box.addView(confirm, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        new AlertDialog.Builder(this)
                .setTitle(R.string.settings_delete_account)
                .setMessage(R.string.settings_delete_message)
                .setView(box)
                .setPositiveButton(R.string.action_delete, (d, w) -> {
                    if (!"ELIMINAR".equals(confirm.getText().toString().trim())) {
                        UiUtils.toast(this, getString(R.string.settings_delete_type));
                        return;
                    }
                    call(() -> { AuthRepository.deleteAccount(); return true; }, ok -> {
                        NotificationScheduler.cancel(this);
                        prefs.clearUserData();
                        goToLogin(getString(R.string.settings_deleted));
                    }, e -> UiUtils.info(this, getString(R.string.error_title), e.getMessage()));
                })
                .setNegativeButton(R.string.action_cancel, null)
                .show();
    }
}
