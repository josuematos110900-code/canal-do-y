package com.ketshop.activities;

import android.content.Intent;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.managers.NotificationScheduler;
import com.ketshop.models.Profile;
import com.ketshop.network.Async;
import com.ketshop.repositories.AuthRepository;
import com.ketshop.repositories.ProfileRepository;
import com.ketshop.utils.UiUtils;
import com.ketshop.utils.Validator;

public class LoginActivity extends BaseActivity {

    public static final String EXTRA_MESSAGE = "message";
    public static final String EXTRA_EMAIL = "email";

    private EditText email, password;
    private Button submit;
    private ProgressBar progress;
    private TextView message;
    private boolean passwordVisible;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);
        email = findViewById(R.id.login_email);
        password = findViewById(R.id.login_password);
        submit = findViewById(R.id.login_submit);
        progress = findViewById(R.id.login_progress);
        message = findViewById(R.id.login_message);

        String msg = getIntent().getStringExtra(EXTRA_MESSAGE);
        if (msg != null) {
            message.setVisibility(View.VISIBLE);
            message.setText(msg);
        }
        String presetEmail = getIntent().getStringExtra(EXTRA_EMAIL);
        if (presetEmail != null) email.setText(presetEmail);

        ImageButton toggle = findViewById(R.id.login_toggle_password);
        toggle.setOnClickListener(v -> {
            passwordVisible = !passwordVisible;
            password.setInputType(InputType.TYPE_CLASS_TEXT | (passwordVisible
                    ? InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD : InputType.TYPE_TEXT_VARIATION_PASSWORD));
            password.setSelection(password.length());
            toggle.setImageResource(passwordVisible ? R.drawable.ic_visibility_off : R.drawable.ic_visibility);
        });
        password.setOnEditorActionListener((v, actionId, e) -> {
            if (actionId == EditorInfo.IME_ACTION_DONE) { attempt(); return true; }
            return false;
        });
        submit.setOnClickListener(v -> attempt());
        findViewById(R.id.login_forgot).setOnClickListener(v -> {
            Intent i = new Intent(this, ForgotPasswordActivity.class);
            i.putExtra(EXTRA_EMAIL, UiUtils.text(email));
            startActivity(i);
        });
        findViewById(R.id.login_register).setOnClickListener(v ->
                startActivity(new Intent(this, RegisterActivity.class)));
        UiUtils.slideUp(findViewById(R.id.login_logo));
    }

    private void attempt() {
        String e = UiUtils.text(email);
        String p = password.getText().toString();
        if (!UiUtils.check(email, Validator.email(e))) return;
        if (!UiUtils.check(password, Validator.passwordLogin(p))) return;
        UiUtils.hideKeyboard(this);
        message.setVisibility(View.GONE);
        setLoading(submit, progress, true);
        submit.setText("");
        call(() -> {
            AuthRepository.signIn(e, p);
            return ProfileRepository.getMyProfile();
        }, this::onLoggedIn, err -> {
            resetButton();
            message.setVisibility(View.VISIBLE);
            message.setText(err.getMessage());
            UiUtils.shake(submit);
        });
    }

    private void onLoggedIn(Profile profile) {
        if (profile.blocked) {
            Async.run(() -> { AuthRepository.signOut(); return true; }, r -> { }, e -> { });
            resetButton();
            message.setVisibility(View.VISIBLE);
            message.setText(getString(R.string.account_blocked)
                    + (profile.blockedReason != null ? " " + profile.blockedReason : ""));
            return;
        }
        if (profile.lastPlayerId != null && !profile.lastPlayerId.isEmpty() && prefs.getLastPlayerId().isEmpty()) {
            prefs.setLastPlayer(profile.lastPlayerId, "");
        }
        if (prefs.isNotificationsEnabled()) NotificationScheduler.schedule(this);
        Intent i = new Intent(this, HomeActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(i);
        finish();
    }

    private void resetButton() {
        setLoading(submit, progress, false);
        submit.setText(R.string.login_submit);
    }
}
