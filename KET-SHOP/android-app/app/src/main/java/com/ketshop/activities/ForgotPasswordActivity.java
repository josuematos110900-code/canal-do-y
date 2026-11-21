package com.ketshop.activities;

import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ProgressBar;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.repositories.AuthRepository;
import com.ketshop.utils.UiUtils;
import com.ketshop.utils.Validator;

public class ForgotPasswordActivity extends BaseActivity {

    private EditText email;
    private Button submit;
    private ProgressBar progress;
    private TextView message;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_forgot_password);
        setupToolbar(getString(R.string.forgot_toolbar), true);
        email = findViewById(R.id.forgot_email);
        submit = findViewById(R.id.forgot_submit);
        progress = findViewById(R.id.forgot_progress);
        message = findViewById(R.id.forgot_message);
        String preset = getIntent().getStringExtra(LoginActivity.EXTRA_EMAIL);
        if (preset != null) email.setText(preset);
        submit.setOnClickListener(v -> send());
        findViewById(R.id.forgot_back).setOnClickListener(v -> finish());
    }

    private void send() {
        String e = UiUtils.text(email);
        if (!UiUtils.check(email, Validator.email(e))) return;
        UiUtils.hideKeyboard(this);
        setLoading(submit, progress, true);
        submit.setText("");
        message.setVisibility(View.GONE);
        call(() -> { AuthRepository.sendPasswordReset(e); return true; }, ok -> {
            setLoading(submit, progress, false);
            submit.setText(R.string.forgot_resend);
            message.setVisibility(View.VISIBLE);
            message.setBackgroundResource(R.drawable.bg_success_box);
            message.setText(getString(R.string.forgot_sent, e));
        }, err -> {
            setLoading(submit, progress, false);
            submit.setText(R.string.forgot_submit);
            message.setVisibility(View.VISIBLE);
            message.setBackgroundResource(R.drawable.bg_error_box);
            message.setText(err.getMessage());
        });
    }
}
