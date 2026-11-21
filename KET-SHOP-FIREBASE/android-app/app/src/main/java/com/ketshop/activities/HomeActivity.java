package com.ketshop.activities;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.adapters.ProductAdapter;
import com.ketshop.managers.PollingManager;
import com.ketshop.models.Order;
import com.ketshop.models.Product;
import com.ketshop.models.ProductCategory;
import com.ketshop.repositories.NotificationRepository;
import com.ketshop.repositories.OrderRepository;
import com.ketshop.repositories.ProductRepository;
import com.ketshop.repositories.ProfileRepository;
import com.ketshop.repositories.SettingsRepository;
import com.ketshop.utils.BottomNav;
import com.ketshop.utils.Formatters;
import com.ketshop.utils.StateView;
import com.ketshop.utils.UiUtils;

import java.util.List;
import java.util.Map;

public class HomeActivity extends BaseActivity {

    private static final int REQ_NOTIF = 501;

    private TextView greeting, name, announcement;
    private LinearLayout categories, featured, activeCard;
    private StateView state;
    private PollingManager poller;
    private Order activeOrder;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!requireSession()) return;
        setContentView(R.layout.activity_home);
        BottomNav.setup(this, BottomNav.HOME);

        greeting = findViewById(R.id.home_greeting);
        name = findViewById(R.id.home_name);
        announcement = findViewById(R.id.home_announcement);
        categories = findViewById(R.id.home_categories);
        featured = findViewById(R.id.home_featured);
        activeCard = findViewById(R.id.home_active_order);
        state = new StateView(this, featured, this::loadAll);

        greeting.setText(Formatters.greeting() + ",");
        name.setText(R.string.home_default_name);

        findViewById(R.id.home_refresh).setOnClickListener(v -> loadAll());
        findViewById(R.id.home_hero_cta).setOnClickListener(v -> startActivity(new Intent(this, ProductsActivity.class)));
        findViewById(R.id.home_see_all).setOnClickListener(v -> startActivity(new Intent(this, ProductsActivity.class)));
        findViewById(R.id.home_shortcut_orders).setOnClickListener(v -> startActivity(new Intent(this, OrderHistoryActivity.class)));
        findViewById(R.id.home_shortcut_support).setOnClickListener(v -> startActivity(new Intent(this, SupportActivity.class)));
        findViewById(R.id.home_active_track).setOnClickListener(v -> {
            if (activeOrder == null) return;
            Intent i = new Intent(this, OrderTrackingActivity.class);
            i.putExtra(OrderTrackingActivity.EXTRA_ORDER_ID, activeOrder.id);
            startActivity(i);
        });
        UiUtils.slideUp(findViewById(R.id.home_hero));
        poller = new PollingManager(Math.max(30, prefs.getPollSeconds()), this::refreshLight);
        askNotificationPermission();
        loadAll();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (poller != null) {
            refreshLight();
            poller.start();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (poller != null) poller.stop();
    }

    private void loadAll() {
        state.loading();
        call(ProfileRepository::getMyProfile, p -> name.setText(p.firstName()), e -> { });
        call(() -> SettingsRepository.publicSettings(false), this::applySettings, e -> { });
        call(ProductRepository::categories, this::showCategories, e -> { });
        call(() -> {
            List<Product> f = ProductRepository.featured();
            return f.isEmpty() ? ProductRepository.products(null) : f;
        }, list -> {
            if (list.isEmpty()) state.empty(getString(R.string.products_empty));
            else { state.content(); showFeatured(list); }
        }, e -> state.error(e.getMessage()));
        refreshLight();
    }

    /** Actualizações leves (encomenda activa + contador de notificações). */
    private void refreshLight() {
        call(OrderRepository::latestActive, this::showActive, e -> { });
        call(NotificationRepository::unreadCount, c -> BottomNav.setBadge(this, c), e -> { });
    }

    private void applySettings(Map<String, Object> s) {
        String text = SettingsRepository.getString(s, "announcement");
        if (SettingsRepository.getBool(s, "maintenance_mode")) {
            text = SettingsRepository.getString(s, "maintenance_message");
        }
        if (text.isEmpty()) {
            announcement.setVisibility(View.GONE);
        } else {
            announcement.setVisibility(View.VISIBLE);
            announcement.setText(text);
        }
    }

    private void showActive(Order o) {
        activeOrder = o;
        if (o == null) {
            activeCard.setVisibility(View.GONE);
            return;
        }
        activeCard.setVisibility(View.VISIBLE);
        ((TextView) findViewById(R.id.home_active_product)).setText(o.productTitle());
        ((TextView) findViewById(R.id.home_active_code)).setText(o.orderCode + " · " + Formatters.kz(o.totalKz));
        UiUtils.statusPill(findViewById(R.id.home_active_status), o.status);
    }

    private void showCategories(List<ProductCategory> list) {
        categories.removeAllViews();
        LayoutInflater inf = LayoutInflater.from(this);
        for (ProductCategory c : list) {
            TextView chip = (TextView) inf.inflate(R.layout.view_chip, categories, false);
            chip.setText(c.name);
            chip.setOnClickListener(v -> {
                Intent i = new Intent(this, ProductsActivity.class);
                i.putExtra(ProductsActivity.EXTRA_CATEGORY_ID, c.id);
                startActivity(i);
            });
            categories.addView(chip);
        }
    }

    private void showFeatured(List<Product> list) {
        featured.removeAllViews();
        ProductAdapter adapter = new ProductAdapter(this);
        adapter.setItems(list);
        int columns = getResources().getConfiguration().screenWidthDp >= 600 ? 3 : 2;
        LinearLayout row = null;
        for (int i = 0; i < Math.min(list.size(), columns * 2); i++) {
            if (i % columns == 0) {
                row = new LinearLayout(this);
                row.setOrientation(LinearLayout.HORIZONTAL);
                featured.addView(row, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT));
            }
            View card = adapter.getView(i, null, row);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            int m = UiUtils.dp(this, 5);
            lp.setMargins(m, m, m, m);
            final Product p = list.get(i);
            card.setOnClickListener(v -> ProductDetailsActivity.open(this, p));
            row.addView(card, lp);
            card.startAnimation(android.view.animation.AnimationUtils.loadAnimation(this, R.anim.slide_up));
        }
        // completa a última linha para manter as larguras
        if (row != null) {
            while (row.getChildCount() < columns) {
                View spacer = new View(this);
                row.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1f));
            }
        }
    }

    private void askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && !prefs.wasNotificationPermissionAsked()) {
            prefs.setNotificationPermissionAsked();
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQ_NOTIF);
        }
    }
}
