package com.ketshop.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ListView;
import android.widget.PopupMenu;

import com.ketshop.R;
import com.ketshop.adapters.NotificationAdapter;
import com.ketshop.managers.PollingManager;
import com.ketshop.models.AppNotification;
import com.ketshop.network.Async;
import com.ketshop.repositories.NotificationRepository;
import com.ketshop.utils.BottomNav;
import com.ketshop.utils.StateView;
import com.ketshop.utils.UiUtils;

import java.util.List;

public class NotificationsActivity extends BaseActivity {

    private NotificationAdapter adapter;
    private ListView list;
    private StateView state;
    private PollingManager poller;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!requireSession()) return;
        setContentView(R.layout.activity_notifications);
        setupToolbar(getString(R.string.notifications_title), false);
        BottomNav.setup(this, BottomNav.NOTIFICATIONS);
        toolbarAction(R.drawable.ic_more_vert, this::showMenu);

        list = findViewById(R.id.notifications_list);
        adapter = new NotificationAdapter(this);
        list.setAdapter(adapter);
        state = new StateView(this, list, this::load);
        poller = new PollingManager(prefs.getPollSeconds(), this::load);

        list.setOnItemClickListener((p, v, pos, id) -> open(adapter.getItem(pos)));
        list.setOnItemLongClickListener((p, v, pos, id) -> {
            final AppNotification n = adapter.getItem(pos);
            UiUtils.confirm(this, getString(R.string.notifications_delete_title), n.title,
                    getString(R.string.action_delete), () -> call(() -> {
                        NotificationRepository.delete(n.id);
                        return true;
                    }, ok -> load()));
            return true;
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
        if (adapter.getCount() == 0) state.loading();
        call(() -> NotificationRepository.list(100), this::show, e -> {
            if (adapter.getCount() == 0) state.error(e.getMessage());
        });
    }

    private void show(List<AppNotification> items) {
        boolean wasEmpty = adapter.getCount() == 0;
        adapter.setItems(items);
        int unread = 0;
        for (AppNotification n : items) if (!n.read) unread++;
        BottomNav.setBadge(this, unread);
        if (items.isEmpty()) state.empty(getString(R.string.notifications_empty));
        else {
            state.content();
            if (wasEmpty) list.scheduleLayoutAnimation();
            // Marca como "vistas" para o serviço de segundo plano não repetir
            String newest = items.get(0).createdAt;
            if (newest.compareTo(prefs.getLastNotificationTs()) > 0) prefs.setLastNotificationTs(newest);
        }
    }

    private void open(AppNotification n) {
        if (!n.read) {
            adapter.markRead(n.id);
            Async.run(() -> { NotificationRepository.markRead(n.id); return true; }, r -> { }, e -> { });
        }
        if (n.orderId != null) {
            Intent i = new Intent(this, OrderDetailsActivity.class);
            i.putExtra(OrderDetailsActivity.EXTRA_ORDER_ID, n.orderId);
            startActivity(i);
        } else {
            UiUtils.info(this, n.title, n.body);
        }
    }

    private void showMenu(View anchor) {
        PopupMenu menu = new PopupMenu(this, anchor);
        menu.getMenuInflater().inflate(R.menu.menu_notifications, menu.getMenu());
        menu.setOnMenuItemClickListener(item -> {
            if (item.getItemId() == R.id.action_mark_all_read) {
                call(() -> { NotificationRepository.markAllRead(); return true; }, ok -> {
                    adapter.markAllRead();
                    BottomNav.setBadge(this, 0);
                });
            } else {
                load();
            }
            return true;
        });
        menu.show();
    }
}
