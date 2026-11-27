package com.ketshop.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.adapters.StatusHistoryAdapter;
import com.ketshop.managers.PollingManager;
import com.ketshop.models.Order;
import com.ketshop.models.OrderStatus;
import com.ketshop.models.StatusHistoryEntry;
import com.ketshop.repositories.OrderRepository;
import com.ketshop.utils.StateView;
import com.ketshop.utils.UiUtils;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Acompanhamento em tempo quase real: actualiza automaticamente a cada N
 * segundos enquanto o ecrã está aberto (Definições -> intervalo).
 */
public class OrderTrackingActivity extends BaseActivity {

    public static final String EXTRA_ORDER_ID = "order_id";

    private String orderId;
    private Order order;
    private StateView state;
    private PollingManager poller;
    private boolean firstLoad = true;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!requireSession()) return;
        orderId = getIntent().getStringExtra(EXTRA_ORDER_ID);
        if (orderId == null) { finish(); return; }
        setContentView(R.layout.activity_order_tracking);
        setupToolbar(getString(R.string.tracking_toolbar), true);
        toolbarAction(R.drawable.ic_refresh, v -> load());
        state = new StateView(this, findViewById(R.id.tracking_scroll), this::load);
        poller = new PollingManager(prefs.getPollSeconds(), this::load);

        findViewById(R.id.tracking_details).setOnClickListener(v -> {
            Intent i = new Intent(this, OrderDetailsActivity.class);
            i.putExtra(OrderDetailsActivity.EXTRA_ORDER_ID, orderId);
            startActivity(i);
        });
        findViewById(R.id.tracking_support).setOnClickListener(v -> {
            Intent i = new Intent(this, SupportActivity.class);
            if (order != null) i.putExtra(SupportActivity.EXTRA_ORDER_CODE, order.orderCode);
            startActivity(i);
        });
        findViewById(R.id.tracking_send_proof).setOnClickListener(v -> {
            if (order == null) return;
            Intent i = new Intent(this, order.paymentMethodId == null ? PaymentActivity.class : ProofUploadActivity.class);
            i.putExtra(ProofUploadActivity.EXTRA_ORDER_ID, orderId);
            startActivity(i);
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (poller == null) return;
        load();
        poller.start();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (poller != null) poller.stop();
    }

    private void load() {
        if (firstLoad) state.loading();
        call(() -> {
            Order o = OrderRepository.get(orderId);
            List<StatusHistoryEntry> h = OrderRepository.history(orderId);
            return new Object[]{o, h};
        }, res -> {
            firstLoad = false;
            @SuppressWarnings("unchecked")
            List<StatusHistoryEntry> history = (List<StatusHistoryEntry>) res[1];
            bind((Order) res[0], history);
        }, e -> {
            if (firstLoad) state.error(e.getMessage());
        });
    }

    private void bind(Order o, List<StatusHistoryEntry> history) {
        OrderStatus previous = order != null ? order.status : null;
        order = o;
        state.content();
        ((TextView) findViewById(R.id.tracking_code)).setText(o.orderCode);
        ((TextView) findViewById(R.id.tracking_product)).setText(o.productTitle());
        ((TextView) findViewById(R.id.tracking_player)).setText(getString(R.string.tracking_player,
                o.playerId + (o.playerNickname != null ? " (" + o.playerNickname + ")" : "")));
        ((TextView) findViewById(R.id.tracking_last_update)).setText(getString(R.string.tracking_updated_at,
                new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date())));
        TextView pill = findViewById(R.id.tracking_status);
        UiUtils.statusPill(pill, o.status);
        if (previous != null && previous != o.status) {
            pill.startAnimation(android.view.animation.AnimationUtils.loadAnimation(this, R.anim.logo_enter));
            UiUtils.toast(this, getString(R.string.tracking_status_changed, o.status.label));
        }

        TextView alert = findViewById(R.id.tracking_alert);
        if (o.status == OrderStatus.PAYMENT_REJECTED) {
            alert.setVisibility(View.VISIBLE);
            alert.setBackgroundResource(R.drawable.bg_error_box);
            alert.setText(getString(R.string.tracking_rejected, o.rejectionReason == null ? "-" : o.rejectionReason));
        } else if (o.status == OrderStatus.CANCELLED) {
            alert.setVisibility(View.VISIBLE);
            alert.setBackgroundResource(R.drawable.bg_card_solid);
            alert.setText(getString(R.string.tracking_cancelled, o.cancelReason == null ? "-" : o.cancelReason));
        } else if (o.status == OrderStatus.COMPLETED) {
            alert.setVisibility(View.VISIBLE);
            alert.setBackgroundResource(R.drawable.bg_success_box);
            alert.setText(R.string.tracking_completed);
        } else if (o.status == OrderStatus.PENDING_PAYMENT) {
            alert.setVisibility(View.VISIBLE);
            alert.setBackgroundResource(R.drawable.bg_warning_box);
            alert.setText(R.string.tracking_pending);
        } else {
            alert.setVisibility(View.GONE);
        }
        findViewById(R.id.tracking_send_proof).setVisibility(o.status.acceptsProof() ? View.VISIBLE : View.GONE);

        buildTimeline(o.status);
        StatusHistoryAdapter.bind(this, findViewById(R.id.tracking_history), history);
        if (o.status.isFinal()) poller.stop();
    }

    private void buildTimeline(OrderStatus current) {
        LinearLayout timeline = findViewById(R.id.tracking_timeline);
        timeline.removeAllViews();
        LayoutInflater inf = LayoutInflater.from(this);
        int currentStep = current.step;
        OrderStatus[] steps = OrderStatus.TIMELINE;
        for (int i = 0; i < steps.length; i++) {
            View row = inf.inflate(R.layout.item_timeline_step, timeline, false);
            TextView title = row.findViewById(R.id.step_title);
            TextView sub = row.findViewById(R.id.step_subtitle);
            View dot = row.findViewById(R.id.step_dot);
            View line = row.findViewById(R.id.step_line);
            OrderStatus s = steps[i];
            String label = s.label;
            int dotRes;
            if (current == OrderStatus.CANCELLED) {
                dotRes = R.drawable.bg_timeline_pending;
                title.setAlpha(0.5f);
            } else if (current == OrderStatus.PAYMENT_REJECTED && s == OrderStatus.UNDER_REVIEW) {
                dotRes = R.drawable.bg_timeline_failed;
                label = OrderStatus.PAYMENT_REJECTED.label;
                sub.setText(R.string.tracking_step_rejected);
            } else if (s.step < currentStep || (current == OrderStatus.COMPLETED && s == OrderStatus.COMPLETED)) {
                dotRes = R.drawable.bg_timeline_done;
            } else if (s.step == currentStep) {
                dotRes = R.drawable.bg_timeline_current;
                sub.setText(R.string.tracking_step_current);
                dot.startAnimation(android.view.animation.AnimationUtils.loadAnimation(this, R.anim.pulse));
            } else {
                dotRes = R.drawable.bg_timeline_pending;
                title.setAlpha(0.55f);
            }
            title.setText(label);
            dot.setBackgroundResource(dotRes);
            if (i == steps.length - 1) line.setVisibility(View.INVISIBLE);
            else if (s.step < currentStep && current != OrderStatus.CANCELLED) line.setBackgroundColor(getResources().getColor(R.color.ks_neon));
            if (sub.getText().length() == 0) sub.setVisibility(View.GONE);
            timeline.addView(row);
        }
    }
}
