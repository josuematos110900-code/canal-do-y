package com.ketshop.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.adapters.PaymentMethodAdapter;
import com.ketshop.models.Order;
import com.ketshop.models.PaymentMethod;
import com.ketshop.repositories.OrderRepository;
import com.ketshop.repositories.PaymentRepository;
import com.ketshop.utils.Formatters;
import com.ketshop.utils.Rows;
import com.ketshop.utils.StateView;
import com.ketshop.utils.UiUtils;

import java.util.List;

public class PaymentActivity extends BaseActivity {

    public static final String EXTRA_ORDER_ID = "order_id";

    private String orderId;
    private Order order;
    private PaymentMethodAdapter adapter;
    private LinearLayout methodsContainer, details;
    private View instructionsCard;
    private Button continueBtn;
    private ProgressBar progress;
    private StateView state;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!requireSession()) return;
        orderId = getIntent().getStringExtra(EXTRA_ORDER_ID);
        if (orderId == null) { finish(); return; }
        setContentView(R.layout.activity_payment);
        setupToolbar(getString(R.string.payment_toolbar), true);

        methodsContainer = findViewById(R.id.payment_methods);
        details = findViewById(R.id.payment_details);
        instructionsCard = findViewById(R.id.payment_instructions_card);
        continueBtn = findViewById(R.id.payment_continue);
        progress = findViewById(R.id.payment_progress);
        adapter = new PaymentMethodAdapter(this);
        state = new StateView(this, findViewById(R.id.payment_scroll), this::load);

        findViewById(R.id.payment_copy_code).setOnClickListener(v -> {
            if (order != null) UiUtils.copy(this, getString(R.string.payment_order_code), order.orderCode);
        });
        continueBtn.setOnClickListener(v -> {
            Intent i = new Intent(this, ProofUploadActivity.class);
            i.putExtra(ProofUploadActivity.EXTRA_ORDER_ID, orderId);
            startActivity(i);
        });
        findViewById(R.id.payment_later).setOnClickListener(v -> {
            Intent i = new Intent(this, OrderDetailsActivity.class);
            i.putExtra(OrderDetailsActivity.EXTRA_ORDER_ID, orderId);
            startActivity(i);
            finish();
        });
        load();
    }

    private void load() {
        state.loading();
        call(() -> {
            Order o = OrderRepository.get(orderId);
            List<PaymentMethod> m = PaymentRepository.activeMethods();
            return new Object[]{o, m};
        }, res -> {
            @SuppressWarnings("unchecked")
            List<PaymentMethod> methods = (List<PaymentMethod>) res[1];
            bind((Order) res[0], methods);
        }, e -> state.error(e.getMessage()));
    }

    private void bind(Order o, List<PaymentMethod> methods) {
        order = o;
        state.content();
        ((TextView) findViewById(R.id.payment_code)).setText(o.orderCode);
        ((TextView) findViewById(R.id.payment_product)).setText(o.productTitle() + " · ID " + o.playerId);
        ((TextView) findViewById(R.id.payment_total)).setText(Formatters.kz(o.totalKz));

        if (!o.status.acceptsProof()) {
            // Já pago/enviado: mostra os detalhes
            Intent i = new Intent(this, OrderTrackingActivity.class);
            i.putExtra(OrderTrackingActivity.EXTRA_ORDER_ID, o.id);
            startActivity(i);
            finish();
            return;
        }

        adapter.setItems(methods);
        findViewById(R.id.payment_empty).setVisibility(methods.isEmpty() ? View.VISIBLE : View.GONE);
        methodsContainer.removeAllViews();
        for (int i = 0; i < methods.size(); i++) {
            final int pos = i;
            View row = adapter.getView(i, null, methodsContainer);
            row.setOnClickListener(v -> choose(pos));
            methodsContainer.addView(row);
        }
        if (o.paymentMethodId != null) {
            adapter.selectById(o.paymentMethodId);
            refreshRows();
            showInstructions(o.paymentMethod());
        }
    }

    private void choose(int position) {
        final PaymentMethod m = adapter.getItem(position);
        adapter.select(position);
        refreshRows();
        progress.setVisibility(View.VISIBLE);
        continueBtn.setEnabled(false);
        call(() -> OrderRepository.setPaymentMethod(orderId, m.id), updated -> {
            progress.setVisibility(View.GONE);
            order = updated;
            showInstructions(updated.paymentMethod());
        }, e -> {
            progress.setVisibility(View.GONE);
            UiUtils.toast(this, e.getMessage());
        });
    }

    private void refreshRows() {
        for (int i = 0; i < methodsContainer.getChildCount(); i++) {
            adapter.getView(i, methodsContainer.getChildAt(i), methodsContainer);
        }
    }

    private void showInstructions(PaymentMethod m) {
        if (m == null) return;
        instructionsCard.setVisibility(View.VISIBLE);
        ((TextView) findViewById(R.id.payment_method_title)).setText(m.name);
        details.removeAllViews();
        Rows.copyable(this, details, getString(R.string.pay_amount), Formatters.kz(order.totalKz).replace(" Kz", ""));
        Rows.copyable(this, details, getString(R.string.pay_holder), m.accountHolder);
        Rows.copyable(this, details, getString(R.string.pay_bank), m.bankName);
        Rows.copyable(this, details, getString(R.string.pay_iban), m.iban);
        Rows.copyable(this, details, getString(R.string.pay_account), m.accountNumber);
        Rows.copyable(this, details, getString(R.string.pay_phone), m.phoneNumber);
        Rows.copyable(this, details, getString(R.string.pay_entity), m.entity);
        Rows.copyable(this, details, getString(R.string.pay_reference), m.reference);
        Rows.copyable(this, details, getString(R.string.pay_description), order.orderCode);
        ((TextView) findViewById(R.id.payment_instructions)).setText(m.instructions);

        boolean hasData = notEmpty(m.iban) || notEmpty(m.phoneNumber) || notEmpty(m.reference)
                || notEmpty(m.accountNumber) || notEmpty(m.entity);
        findViewById(R.id.payment_missing_data).setVisibility(hasData ? View.GONE : View.VISIBLE);
        continueBtn.setEnabled(hasData);
        UiUtils.slideUp(instructionsCard);
    }

    private static boolean notEmpty(String s) {
        return s != null && !s.trim().isEmpty();
    }
}
