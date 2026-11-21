package com.ketshop.activities;

import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.text.InputType;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.models.Order;
import com.ketshop.models.OrderItem;
import com.ketshop.models.PaymentMethod;
import com.ketshop.models.PaymentProof;
import com.ketshop.repositories.OrderRepository;
import com.ketshop.repositories.ProofRepository;
import com.ketshop.utils.Formatters;
import com.ketshop.utils.ImageUtils;
import com.ketshop.utils.Rows;
import com.ketshop.utils.StateView;
import com.ketshop.utils.UiUtils;

import java.util.List;

public class OrderDetailsActivity extends BaseActivity {

    public static final String EXTRA_ORDER_ID = "order_id";

    private String orderId;
    private Order order;
    private StateView state;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!requireSession()) return;
        orderId = getIntent().getStringExtra(EXTRA_ORDER_ID);
        if (orderId == null) { finish(); return; }
        setContentView(R.layout.activity_order_details);
        setupToolbar(getString(R.string.order_details_toolbar), true);
        toolbarAction(R.drawable.ic_more_vert, this::showMenu);
        state = new StateView(this, findViewById(R.id.order_details_scroll), this::load);
        findViewById(R.id.order_details_track).setOnClickListener(v -> openTracking());
        findViewById(R.id.order_details_cancel).setOnClickListener(v -> askCancel());
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (state != null) load();
    }

    private void load() {
        if (order == null) state.loading();
        call(() -> {
            Order o = OrderRepository.get(orderId);
            List<PaymentProof> proofs = ProofRepository.forOrder(orderId);
            return new Object[]{o, proofs};
        }, res -> {
            @SuppressWarnings("unchecked")
            List<PaymentProof> proofs = (List<PaymentProof>) res[1];
            bind((Order) res[0], proofs);
        }, e -> state.error(e.getMessage()));
    }

    private void bind(Order o, List<PaymentProof> proofs) {
        order = o;
        state.content();
        ((TextView) findViewById(R.id.order_details_code)).setText(o.orderCode);
        ((TextView) findViewById(R.id.order_details_date)).setText(getString(R.string.order_details_created, Formatters.dateTime(o.createdAt)));
        UiUtils.statusPill(findViewById(R.id.order_details_status), o.status);

        TextView alert = findViewById(R.id.order_details_alert);
        alert.setVisibility(View.GONE);
        if (o.rejectionReason != null && o.status == com.ketshop.models.OrderStatus.PAYMENT_REJECTED) {
            alert.setVisibility(View.VISIBLE);
            alert.setBackgroundResource(R.drawable.bg_error_box);
            alert.setText(getString(R.string.tracking_rejected, o.rejectionReason));
        } else if (o.cancelReason != null && o.status == com.ketshop.models.OrderStatus.CANCELLED) {
            alert.setVisibility(View.VISIBLE);
            alert.setBackgroundResource(R.drawable.bg_card_solid);
            alert.setText(getString(R.string.tracking_cancelled, o.cancelReason));
        }

        LinearLayout items = findViewById(R.id.order_details_items);
        items.removeAllViews();
        for (OrderItem it : o.items) {
            Rows.summary(items, it.productName, it.quantity + " × " + Formatters.kz(it.unitPriceKz));
            if (it.totalAmount > 0) Rows.summary(items, getString(R.string.summary_amount), Formatters.number(it.totalAmount) + " " + it.unitLabel);
        }
        Rows.summary(items, getString(R.string.summary_game), o.game);
        Rows.summary(items, getString(R.string.summary_player_id), o.playerId);
        Rows.summary(items, getString(R.string.summary_nickname), o.playerNickname);
        Rows.summary(items, getString(R.string.label_notes), o.customerNotes);
        Rows.summary(items, getString(R.string.confirm_total), Formatters.kz(o.totalKz));

        LinearLayout payment = findViewById(R.id.order_details_payment);
        payment.removeAllViews();
        PaymentMethod pm = o.paymentMethod();
        if (pm == null) {
            Rows.summary(payment, getString(R.string.order_details_method), getString(R.string.order_details_no_method));
        } else {
            Rows.summary(payment, getString(R.string.order_details_method), pm.name);
            Rows.copyable(this, payment, getString(R.string.pay_iban), pm.iban);
            Rows.copyable(this, payment, getString(R.string.pay_phone), pm.phoneNumber);
            Rows.copyable(this, payment, getString(R.string.pay_entity), pm.entity);
            Rows.copyable(this, payment, getString(R.string.pay_reference), pm.reference);
        }

        LinearLayout proofsBox = findViewById(R.id.order_details_proofs);
        proofsBox.removeAllViews();
        if (proofs.isEmpty()) {
            TextView t = new TextView(this);
            t.setText(R.string.order_details_no_proofs);
            t.setTextColor(getResources().getColor(R.color.text_muted));
            proofsBox.addView(t);
        }
        LayoutInflater inf = LayoutInflater.from(this);
        for (final PaymentProof p : proofs) {
            View row = inf.inflate(R.layout.item_proof_row, proofsBox, false);
            ((TextView) row.findViewById(R.id.proof_row_title)).setText(p.statusLabel()
                    + (p.reviewNotes != null ? " — " + p.reviewNotes : ""));
            ((TextView) row.findViewById(R.id.proof_row_subtitle)).setText(Formatters.dateTime(p.createdAt)
                    + " · " + Formatters.bytes(p.sizeBytes));
            row.findViewById(R.id.proof_row_view).setOnClickListener(v -> viewProof(p));
            proofsBox.addView(row);
        }

        Button primary = findViewById(R.id.order_details_primary);
        if (o.status.acceptsProof()) {
            primary.setVisibility(View.VISIBLE);
            boolean needsMethod = o.paymentMethodId == null;
            primary.setText(needsMethod ? R.string.order_details_pay : R.string.tracking_send_proof);
            primary.setOnClickListener(v -> {
                Intent i = new Intent(this, needsMethod ? PaymentActivity.class : ProofUploadActivity.class);
                i.putExtra(PaymentActivity.EXTRA_ORDER_ID, orderId);
                startActivity(i);
            });
        } else {
            primary.setVisibility(View.GONE);
        }
        findViewById(R.id.order_details_cancel).setVisibility(o.status.cancellableByCustomer() ? View.VISIBLE : View.GONE);
    }

    private void showMenu(View anchor) {
        if (order == null) return;
        PopupMenu menu = new PopupMenu(this, anchor);
        menu.getMenuInflater().inflate(R.menu.menu_order_details, menu.getMenu());
        menu.getMenu().findItem(R.id.action_cancel_order).setVisible(order.status.cancellableByCustomer());
        menu.setOnMenuItemClickListener(item -> {
            int id = item.getItemId();
            if (id == R.id.action_copy_code) UiUtils.copy(this, getString(R.string.payment_order_code), order.orderCode);
            else if (id == R.id.action_track) openTracking();
            else if (id == R.id.action_support) {
                Intent i = new Intent(this, SupportActivity.class);
                i.putExtra(SupportActivity.EXTRA_ORDER_CODE, order.orderCode);
                startActivity(i);
            } else if (id == R.id.action_cancel_order) askCancel();
            return true;
        });
        menu.show();
    }

    private void openTracking() {
        Intent i = new Intent(this, OrderTrackingActivity.class);
        i.putExtra(OrderTrackingActivity.EXTRA_ORDER_ID, orderId);
        startActivity(i);
    }

    private void askCancel() {
        if (order == null || !order.status.cancellableByCustomer()) return;
        final EditText reason = new EditText(this);
        reason.setHint(R.string.cancel_reason_hint);
        reason.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        reason.setTextColor(getResources().getColor(R.color.text_primary));
        int pad = UiUtils.dp(this, 20);
        LinearLayout box = new LinearLayout(this);
        box.setPadding(pad, 0, pad, 0);
        box.addView(reason, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        new AlertDialog.Builder(this)
                .setTitle(R.string.cancel_title)
                .setMessage(getString(R.string.cancel_message, order.orderCode))
                .setView(box)
                .setPositiveButton(R.string.menu_cancel_order, (d, w) -> {
                    String r = reason.getText().toString().trim();
                    call(() -> OrderRepository.cancel(orderId, r.isEmpty() ? null : r), updated -> {
                        UiUtils.toast(this, getString(R.string.cancel_done));
                        load();
                    });
                })
                .setNegativeButton(R.string.action_back, null)
                .show();
    }

    /** Descarrega o comprovativo (acesso autenticado ao bucket privado) e mostra-o. */
    private void viewProof(PaymentProof p) {
        UiUtils.toast(this, getString(R.string.order_details_loading_proof));
        call(() -> {
            byte[] data = ProofRepository.download(p.storagePath);
            Bitmap b = ImageUtils.decodeSampled(data, 1600);
            if (b == null) throw com.ketshop.network.ApiException.validation(getString(R.string.order_details_proof_error));
            return b;
        }, bmp -> {
            ImageView iv = new ImageView(this);
            iv.setAdjustViewBounds(true);
            iv.setImageBitmap(bmp);
            int pad = UiUtils.dp(this, 12);
            iv.setPadding(pad, pad, pad, pad);
            new AlertDialog.Builder(this)
                    .setTitle(p.fileName)
                    .setView(iv)
                    .setPositiveButton(R.string.action_close, null)
                    .show();
        });
    }
}
