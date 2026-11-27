package com.ketshop.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ListView;
import android.widget.PopupMenu;

import com.ketshop.R;
import com.ketshop.adapters.OrderAdapter;
import com.ketshop.repositories.NotificationRepository;
import com.ketshop.repositories.OrderRepository;
import com.ketshop.utils.BottomNav;
import com.ketshop.utils.StateView;

public class OrderHistoryActivity extends BaseActivity {

    private static final int[] CHIPS = {R.id.history_filter_all, R.id.history_filter_active,
            R.id.history_filter_completed, R.id.history_filter_cancelled};
    private static final int[] FILTERS = {OrderRepository.FILTER_ALL, OrderRepository.FILTER_ACTIVE,
            OrderRepository.FILTER_COMPLETED, OrderRepository.FILTER_CANCELLED};

    private OrderAdapter adapter;
    private ListView list;
    private StateView state;
    private int filter = OrderRepository.FILTER_ALL;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!requireSession()) return;
        setContentView(R.layout.activity_order_history);
        setupToolbar(getString(R.string.history_title), false);
        BottomNav.setup(this, BottomNav.ORDERS);
        toolbarAction(R.drawable.ic_more_vert, this::showFilterMenu);

        list = findViewById(R.id.history_list);
        adapter = new OrderAdapter(this);
        list.setAdapter(adapter);
        state = new StateView(this, list, this::load);
        list.setOnItemClickListener((p, v, pos, id) -> {
            Intent i = new Intent(this, OrderDetailsActivity.class);
            i.putExtra(OrderDetailsActivity.EXTRA_ORDER_ID, adapter.getItem(pos).id);
            startActivity(i);
        });
        for (int i = 0; i < CHIPS.length; i++) {
            final int f = FILTERS[i];
            findViewById(CHIPS[i]).setOnClickListener(v -> setFilter(f));
        }
        markChips();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (adapter == null) return;
        load();
        call(NotificationRepository::unreadCount, c -> BottomNav.setBadge(this, c), e -> { });
    }

    private void showFilterMenu(View anchor) {
        PopupMenu menu = new PopupMenu(this, anchor);
        menu.getMenuInflater().inflate(R.menu.menu_order_filter, menu.getMenu());
        menu.setOnMenuItemClickListener(item -> {
            int id = item.getItemId();
            if (id == R.id.filter_active) setFilter(OrderRepository.FILTER_ACTIVE);
            else if (id == R.id.filter_completed) setFilter(OrderRepository.FILTER_COMPLETED);
            else if (id == R.id.filter_cancelled) setFilter(OrderRepository.FILTER_CANCELLED);
            else setFilter(OrderRepository.FILTER_ALL);
            return true;
        });
        menu.show();
    }

    private void setFilter(int f) {
        filter = f;
        markChips();
        load();
    }

    private void markChips() {
        for (int i = 0; i < CHIPS.length; i++) findViewById(CHIPS[i]).setSelected(FILTERS[i] == filter);
    }

    private void load() {
        if (adapter.getCount() == 0) state.loading();
        call(() -> OrderRepository.myOrders(filter, 100), orders -> {
            adapter.setItems(orders);
            if (orders.isEmpty()) {
                state.empty(getString(filter == OrderRepository.FILTER_ALL ? R.string.history_empty : R.string.history_empty_filter));
            } else {
                state.content();
                list.scheduleLayoutAnimation();
            }
        }, e -> state.error(e.getMessage()));
    }
}
