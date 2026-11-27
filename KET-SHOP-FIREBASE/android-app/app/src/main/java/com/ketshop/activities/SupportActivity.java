package com.ketshop.activities;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.repositories.SettingsRepository;
import com.ketshop.utils.UiUtils;

import java.util.Map;

/** Contactos de suporte (configurados no painel — nunca fixos no APK) e FAQ. */
public class SupportActivity extends BaseActivity {

    public static final String EXTRA_ORDER_CODE = "order_code";

    private String orderCode;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_support);
        setupToolbar(getString(R.string.support_title), true);
        orderCode = getIntent().getStringExtra(EXTRA_ORDER_CODE);
        if (orderCode != null) {
            ((TextView) findViewById(R.id.support_order_ref)).setText(getString(R.string.support_about_order, orderCode));
        }
        buildFaq();
        call(() -> SettingsRepository.publicSettings(true), this::bindContacts, e -> {
            findViewById(R.id.support_progress).setVisibility(View.GONE);
            TextView t = findViewById(R.id.support_not_configured);
            t.setVisibility(View.VISIBLE);
            t.setText(e.getMessage());
        });
    }

    private void bindContacts(Map<String, Object> s) {
        findViewById(R.id.support_progress).setVisibility(View.GONE);
        final String whatsapp = SettingsRepository.getString(s, "support_whatsapp").replaceAll("[^0-9]", "");
        final String email = SettingsRepository.getString(s, "support_email");
        final String phone = SettingsRepository.getString(s, "support_phone");
        String hours = SettingsRepository.getString(s, "support_hours");
        boolean any = !whatsapp.isEmpty() || !email.isEmpty() || !phone.isEmpty();
        findViewById(R.id.support_not_configured).setVisibility(any ? View.GONE : View.VISIBLE);
        findViewById(R.id.support_contacts).setVisibility(any || !hours.isEmpty() ? View.VISIBLE : View.GONE);

        final String msg = orderCode != null
                ? getString(R.string.support_message_order, orderCode)
                : getString(R.string.support_message_general);

        TextView wa = findViewById(R.id.support_whatsapp);
        if (!whatsapp.isEmpty()) {
            wa.setVisibility(View.VISIBLE);
            wa.setOnClickListener(v -> open(new Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://wa.me/" + whatsapp + "?text=" + Uri.encode(msg)))));
        }
        TextView em = findViewById(R.id.support_email);
        if (!email.isEmpty()) {
            em.setVisibility(View.VISIBLE);
            em.setText(email);
            em.setOnClickListener(v -> {
                Intent i = new Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:" + email));
                i.putExtra(Intent.EXTRA_SUBJECT, orderCode != null ? "KET SHOP — " + orderCode : "KET SHOP — Suporte");
                i.putExtra(Intent.EXTRA_TEXT, msg);
                open(i);
            });
        }
        TextView ph = findViewById(R.id.support_phone);
        if (!phone.isEmpty()) {
            ph.setVisibility(View.VISIBLE);
            ph.setText(phone);
            ph.setOnClickListener(v -> open(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + phone.replace(" ", "")))));
        }
        TextView hr = findViewById(R.id.support_hours);
        if (!hours.isEmpty()) {
            hr.setVisibility(View.VISIBLE);
            hr.setText(hours);
        }
    }

    private void open(Intent i) {
        try {
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            UiUtils.toast(this, getString(R.string.support_no_app));
        }
    }

    private void buildFaq() {
        String[] q = getResources().getStringArray(R.array.faq_questions);
        String[] a = getResources().getStringArray(R.array.faq_answers);
        LinearLayout box = findViewById(R.id.support_faq);
        LayoutInflater inf = LayoutInflater.from(this);
        for (int i = 0; i < Math.min(q.length, a.length); i++) {
            View item = inf.inflate(R.layout.item_faq, box, false);
            ((TextView) item.findViewById(R.id.faq_question)).setText(q[i]);
            final TextView ans = item.findViewById(R.id.faq_answer);
            ans.setText(a[i]);
            item.setOnClickListener(v -> ans.setVisibility(ans.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE));
            box.addView(item);
        }
    }
}
