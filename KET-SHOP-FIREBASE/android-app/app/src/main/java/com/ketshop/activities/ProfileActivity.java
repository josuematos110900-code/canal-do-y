package com.ketshop.activities;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.managers.NotificationScheduler;
import com.ketshop.models.Profile;
import com.ketshop.repositories.AuthRepository;
import com.ketshop.repositories.NotificationRepository;
import com.ketshop.repositories.ProfileRepository;
import com.ketshop.utils.BottomNav;
import com.ketshop.utils.UiUtils;
import com.ketshop.utils.Validator;

public class ProfileActivity extends BaseActivity {

    private EditText editName, editPhone;
    private Button save;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!requireSession()) return;
        setContentView(R.layout.activity_profile);
        BottomNav.setup(this, BottomNav.PROFILE);
        editName = findViewById(R.id.profile_edit_name);
        editPhone = findViewById(R.id.profile_edit_phone);
        save = findViewById(R.id.profile_save);

        save.setOnClickListener(v -> saveProfile());
        findViewById(R.id.profile_menu_orders).setOnClickListener(v -> startActivity(new Intent(this, OrderHistoryActivity.class)));
        findViewById(R.id.profile_menu_notifications).setOnClickListener(v -> startActivity(new Intent(this, NotificationsActivity.class)));
        findViewById(R.id.profile_menu_support).setOnClickListener(v -> startActivity(new Intent(this, SupportActivity.class)));
        findViewById(R.id.profile_menu_settings).setOnClickListener(v -> startActivity(new Intent(this, SettingsActivity.class)));
        findViewById(R.id.profile_menu_terms).setOnClickListener(v -> startActivity(new Intent(this, TermsActivity.class)));
        findViewById(R.id.profile_menu_privacy).setOnClickListener(v -> startActivity(new Intent(this, PrivacyActivity.class)));
        findViewById(R.id.profile_logout).setOnClickListener(v -> UiUtils.confirm(this,
                getString(R.string.profile_logout), getString(R.string.profile_logout_confirm),
                getString(R.string.profile_logout), this::logout));
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (save == null) return;
        call(ProfileRepository::getMyProfile, this::bind);
        call(ProfileRepository::myOrderStats, s -> {
            ((TextView) findViewById(R.id.profile_stat_total)).setText(String.valueOf(s[0]));
            ((TextView) findViewById(R.id.profile_stat_done)).setText(String.valueOf(s[1]));
            ((TextView) findViewById(R.id.profile_stat_active)).setText(String.valueOf(s[2]));
        }, e -> { });
        call(NotificationRepository::unreadCount, c -> BottomNav.setBadge(this, c), e -> { });
    }

    private void bind(Profile p) {
        ((TextView) findViewById(R.id.profile_name)).setText(p.fullName.isEmpty() ? getString(R.string.home_default_name) : p.fullName);
        ((TextView) findViewById(R.id.profile_email)).setText(p.email);
        String initials = initials(p.fullName);
        ((TextView) findViewById(R.id.profile_avatar)).setText(initials);
        if (!editName.hasFocus()) editName.setText(p.fullName);
        if (!editPhone.hasFocus()) editPhone.setText(p.phone);
    }

    private static String initials(String name) {
        if (name == null || name.trim().isEmpty()) return "K";
        String[] parts = name.trim().split("\\s+");
        String a = parts[0].substring(0, 1);
        String b = parts.length > 1 ? parts[parts.length - 1].substring(0, 1) : "";
        return (a + b).toUpperCase();
    }

    private void saveProfile() {
        String n = UiUtils.text(editName);
        String ph = UiUtils.text(editPhone);
        if (!UiUtils.check(editName, Validator.fullName(n))) return;
        if (!UiUtils.check(editPhone, Validator.phone(ph, true))) return;
        UiUtils.hideKeyboard(this);
        setLoading(save, null, true);
        final String phone = ph.isEmpty() ? "" : Validator.normalizePhone(ph);
        call(() -> ProfileRepository.updateMyProfile(n, phone), p -> {
            setLoading(save, null, false);
            editName.clearFocus();
            editPhone.clearFocus();
            bind(p);
            UiUtils.toast(this, getString(R.string.profile_saved));
        }, e -> {
            setLoading(save, null, false);
            UiUtils.toast(this, e.getMessage());
        });
    }

    private void logout() {
        NotificationScheduler.cancel(this);
        prefs.clearUserData();
        call(() -> { AuthRepository.signOut(); return true; }, ok -> goToLogin(null), e -> goToLogin(null));
    }
}
