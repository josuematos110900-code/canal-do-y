package com.ketshop.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.models.Product;
import com.ketshop.utils.Formatters;
import com.ketshop.utils.UiUtils;
import com.ketshop.utils.Validator;

public class PlayerIdActivity extends BaseActivity {

    public static final String EXTRA_PRODUCT = "product";

    private Product product;
    private EditText playerId, playerIdConfirm, nickname;
    private CheckBox save;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!requireSession()) return;
        product = (Product) getIntent().getSerializableExtra(EXTRA_PRODUCT);
        if (product == null) { finish(); return; }
        setContentView(R.layout.activity_player_id);
        setupToolbar(getString(R.string.player_toolbar), true);

        playerId = findViewById(R.id.player_id);
        playerIdConfirm = findViewById(R.id.player_id_confirm);
        nickname = findViewById(R.id.player_nickname);
        save = findViewById(R.id.player_save);
        ((TextView) findViewById(R.id.player_product_name)).setText(product.name);
        ((TextView) findViewById(R.id.player_product_price)).setText(Formatters.kz(product.priceKz));
        ((ImageView) findViewById(R.id.player_product_icon))
                .setImageResource(product.isDiamond() ? R.drawable.ic_diamond : R.drawable.ic_ticket);

        final String savedId = prefs.getLastPlayerId();
        Button useSaved = findViewById(R.id.player_use_saved);
        if (savedId != null && !savedId.isEmpty()) {
            useSaved.setVisibility(View.VISIBLE);
            useSaved.setText(getString(R.string.player_use_saved, savedId));
            useSaved.setOnClickListener(v -> {
                playerId.setText(savedId);
                playerIdConfirm.setText(savedId);
                nickname.setText(prefs.getLastPlayerNick());
            });
        }
        findViewById(R.id.player_continue).setOnClickListener(v -> next());
    }

    private void next() {
        String id = UiUtils.text(playerId).replaceAll("\\s", "");
        String confirm = UiUtils.text(playerIdConfirm).replaceAll("\\s", "");
        String nick = UiUtils.text(nickname);
        if (!UiUtils.check(playerId, Validator.playerId(id))) return;
        if (!id.equals(confirm)) {
            UiUtils.check(playerIdConfirm, getString(R.string.player_id_mismatch));
            return;
        }
        if (!UiUtils.check(nickname, Validator.nickname(nick))) return;
        if (save.isChecked()) prefs.setLastPlayer(id, nick);
        UiUtils.hideKeyboard(this);
        Intent i = new Intent(this, OrderConfirmationActivity.class);
        i.putExtra(OrderConfirmationActivity.EXTRA_PRODUCT, product);
        i.putExtra(OrderConfirmationActivity.EXTRA_PLAYER_ID, id);
        i.putExtra(OrderConfirmationActivity.EXTRA_NICKNAME, nick);
        startActivity(i);
    }
}
