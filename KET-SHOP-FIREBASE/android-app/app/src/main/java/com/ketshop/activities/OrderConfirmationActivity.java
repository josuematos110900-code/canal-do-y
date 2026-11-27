package com.ketshop.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.models.Order;
import com.ketshop.models.Product;
import com.ketshop.repositories.OrderRepository;
import com.ketshop.utils.Formatters;
import com.ketshop.utils.Rows;
import com.ketshop.utils.UiUtils;

public class OrderConfirmationActivity extends BaseActivity {

    public static final String EXTRA_PRODUCT = "product";
    public static final String EXTRA_PLAYER_ID = "player_id";
    public static final String EXTRA_NICKNAME = "nickname";

    private Product product;
    private String playerId, nickname;
    private Button submit;
    private ProgressBar progress;
    private CheckBox checkId;
    private EditText notes;
    private boolean submitting;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!requireSession()) return;
        product = (Product) getIntent().getSerializableExtra(EXTRA_PRODUCT);
        playerId = getIntent().getStringExtra(EXTRA_PLAYER_ID);
        nickname = getIntent().getStringExtra(EXTRA_NICKNAME);
        if (product == null || playerId == null) { finish(); return; }
        setContentView(R.layout.activity_order_confirmation);
        setupToolbar(getString(R.string.confirm_toolbar), true);

        submit = findViewById(R.id.confirm_submit);
        progress = findViewById(R.id.confirm_progress);
        checkId = findViewById(R.id.confirm_check_id);
        notes = findViewById(R.id.confirm_notes);

        LinearLayout summary = findViewById(R.id.confirm_summary);
        Rows.summary(summary, getString(R.string.summary_game), product.game);
        Rows.summary(summary, getString(R.string.summary_product), product.name);
        if (product.isDiamond()) {
            Rows.summary(summary, getString(R.string.summary_amount),
                    Formatters.number(product.baseAmount) + " + " + Formatters.number(product.bonusAmount)
                            + " = " + Formatters.number(product.totalAmount));
        }
        Rows.summary(summary, getString(R.string.summary_quantity), "1");
        Rows.summary(summary, getString(R.string.summary_player_id), playerId);
        Rows.summary(summary, getString(R.string.summary_nickname), nickname);
        ((TextView) findViewById(R.id.confirm_total)).setText(Formatters.kz(product.priceKz));
        findViewById(R.id.confirm_on_demand).setVisibility(product.onDemand ? View.VISIBLE : View.GONE);
        submit.setOnClickListener(v -> submit());
    }

    private void submit() {
        if (submitting) return;
        if (!checkId.isChecked()) {
            UiUtils.shake(checkId);
            UiUtils.toast(this, getString(R.string.confirm_check_required));
            return;
        }
        submitting = true;
        setLoading(submit, progress, true);
        submit.setText("");
        String n = UiUtils.text(notes);
        call(() -> OrderRepository.create(product.id, playerId,
                nickname == null || nickname.isEmpty() ? null : nickname, n.isEmpty() ? null : n), this::onCreated, e -> {
            submitting = false;
            setLoading(submit, progress, false);
            submit.setText(R.string.confirm_submit);
            UiUtils.info(this, getString(R.string.error_title), e.getMessage());
        });
    }

    private void onCreated(Order order) {
        UiUtils.toast(this, getString(R.string.confirm_created, order.orderCode));
        // Home -> Pagamento: remove os ecrãs de selecção da pilha para não repetir a encomenda
        Intent home = new Intent(this, HomeActivity.class);
        home.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        Intent pay = new Intent(this, PaymentActivity.class);
        pay.putExtra(PaymentActivity.EXTRA_ORDER_ID, order.id);
        startActivities(new Intent[]{home, pay});
        finish();
    }
}
