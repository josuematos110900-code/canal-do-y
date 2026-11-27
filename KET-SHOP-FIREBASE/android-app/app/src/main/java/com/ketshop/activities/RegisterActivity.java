package com.ketshop.activities;

import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.managers.NotificationScheduler;
import com.ketshop.repositories.AuthRepository;
import com.ketshop.utils.UiUtils;
import com.ketshop.utils.Validator;

public class RegisterActivity extends BaseActivity {

    private EditText name, phone, email, password, confirm;
    private CheckBox terms;
    private Button submit;
    private ProgressBar progress;
    private TextView message;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_register);
        setupToolbar(getString(R.string.register_toolbar), true);
        name = findViewById(R.id.register_name);
        phone = findViewById(R.id.register_phone);
        email = findViewById(R.id.register_email);
        password = findViewById(R.id.register_password);
        confirm = findViewById(R.id.register_password_confirm);
        terms = findViewById(R.id.register_terms);
        submit = findViewById(R.id.register_submit);
        progress = findViewById(R.id.register_progress);
        message = findViewById(R.id.register_message);

        submit.setOnClickListener(v -> attempt());
        findViewById(R.id.register_terms_link).setOnClickListener(v -> startActivity(new Intent(this, TermsActivity.class)));
        findViewById(R.id.register_privacy_link).setOnClickListener(v -> startActivity(new Intent(this, PrivacyActivity.class)));
        findViewById(R.id.register_login).setOnClickListener(v -> finish());
    }

    private void attempt() {
        String n = UiUtils.text(name);
        String ph = UiUtils.text(phone);
        String e = UiUtils.text(email);
        String p = password.getText().toString();
        String c = confirm.getText().toString();
        if (!UiUtils.check(name, Validator.fullName(n))) return;
        if (!UiUtils.check(phone, Validator.phone(ph, true))) return;
        if (!UiUtils.check(email, Validator.email(e))) return;
        if (!UiUtils.check(password, Validator.newPassword(p))) return;
        if (!UiUtils.check(confirm, Validator.confirm(p, c))) return;
        if (!terms.isChecked()) {
            UiUtils.shake(terms);
            UiUtils.toast(this, getString(R.string.register_terms_required));
            return;
        }
        UiUtils.hideKeyboard(this);
        message.setVisibility(View.GONE);
        setLoading(submit, progress, true);
        submit.setText("");
        final String phoneNorm = Validator.normalizePhone(ph);
        call(() -> AuthRepository.signUp(n, phoneNorm, e, p), sessionCreated -> {
            setLoading(submit, progress, false);
            submit.setText(R.string.register_submit);
            if (sessionCreated) {
                if (prefs.isNotificationsEnabled()) NotificationScheduler.schedule(this);
                Intent i = new Intent(this, HomeActivity.class);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(i);
                finish();
            } else {
                new AlertDialog.Builder(this)
                        .setTitle(R.string.register_confirm_email_title)
                        .setMessage(getString(R.string.register_confirm_email_message, e))
                        .setCancelable(false)
                        .setPositiveButton(R.string.action_ok, (d, w) -> {
                            Intent i = new Intent(this, LoginActivity.class);
                            i.putExtra(LoginActivity.EXTRA_EMAIL, e);
                            i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                            startActivity(i);
                            finish();
                        })
                        .show();
            }
        }, err -> {
            setLoading(submit, progress, false);
            submit.setText(R.string.register_submit);
            message.setVisibility(View.VISIBLE);
            message.setText(err.getMessage());
        });
    }
}
