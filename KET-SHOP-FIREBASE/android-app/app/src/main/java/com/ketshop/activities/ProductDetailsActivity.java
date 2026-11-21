package com.ketshop.activities;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.models.Product;
import com.ketshop.repositories.ProductRepository;
import com.ketshop.utils.Formatters;
import com.ketshop.utils.ImageLoader;
import com.ketshop.utils.StateView;
import com.ketshop.utils.UiUtils;

public class ProductDetailsActivity extends BaseActivity {

    public static final String EXTRA_PRODUCT_ID = "product_id";

    private Product product;
    private StateView state;
    private Button buy;

    public static void open(Activity from, Product p) {
        Intent i = new Intent(from, ProductDetailsActivity.class);
        i.putExtra(EXTRA_PRODUCT_ID, p.id);
        from.startActivity(i);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!requireSession()) return;
        setContentView(R.layout.activity_product_details);
        setupToolbar(getString(R.string.details_title), true);
        buy = findViewById(R.id.details_buy);
        state = new StateView(this, findViewById(R.id.details_scroll), this::load);
        buy.setOnClickListener(v -> {
            if (product == null) return;
            Intent i = new Intent(this, PlayerIdActivity.class);
            i.putExtra(PlayerIdActivity.EXTRA_PRODUCT, product);
            startActivity(i);
        });
        load();
    }

    /** Recarrega sempre do servidor para mostrar o preço actual. */
    private void load() {
        String id = getIntent().getStringExtra(EXTRA_PRODUCT_ID);
        if (id == null) { finish(); return; }
        state.loading();
        buy.setEnabled(false);
        call(() -> ProductRepository.product(id), this::bind, e -> state.error(e.getMessage()));
    }

    private void bind(Product p) {
        product = p;
        state.content();
        buy.setEnabled(true);
        ImageView icon = findViewById(R.id.details_icon);
        ImageLoader.load(icon, p.imageUrl, p.isDiamond() ? R.drawable.ic_diamond : R.drawable.ic_ticket);
        ((TextView) findViewById(R.id.details_category)).setText(
                ((p.categoryName != null ? p.categoryName : "") + " · " + p.game).toUpperCase());
        ((TextView) findViewById(R.id.details_name)).setText(p.name);
        ((TextView) findViewById(R.id.details_price)).setText(Formatters.kz(p.priceKz));
        ((TextView) findViewById(R.id.details_description)).setText(
                p.description == null || p.description.isEmpty() ? getString(R.string.details_no_description) : p.description);
        View amounts = findViewById(R.id.details_amounts);
        if (p.isDiamond()) {
            amounts.setVisibility(View.VISIBLE);
            ((TextView) findViewById(R.id.details_base)).setText(Formatters.number(p.baseAmount));
            ((TextView) findViewById(R.id.details_bonus)).setText("+" + Formatters.number(p.bonusAmount));
            ((TextView) findViewById(R.id.details_total)).setText(Formatters.number(p.totalAmount));
        } else {
            amounts.setVisibility(View.GONE);
        }
        findViewById(R.id.details_on_demand).setVisibility(p.onDemand ? View.VISIBLE : View.GONE);
        buy.setText(p.onDemand ? R.string.details_buy_on_demand : R.string.details_buy);
        UiUtils.slideUp(icon);
    }
}
