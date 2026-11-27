package com.ketshop.utils;

import android.app.Activity;
import android.content.Intent;
import android.view.View;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.activities.HomeActivity;
import com.ketshop.activities.NotificationsActivity;
import com.ketshop.activities.OrderHistoryActivity;
import com.ketshop.activities.ProductsActivity;
import com.ketshop.activities.ProfileActivity;

/** Barra de navegação inferior (include layout/view_bottom_nav.xml). */
public final class BottomNav {

    public static final int HOME = R.id.nav_home;
    public static final int PRODUCTS = R.id.nav_products;
    public static final int ORDERS = R.id.nav_orders;
    public static final int NOTIFICATIONS = R.id.nav_notifications;
    public static final int PROFILE = R.id.nav_profile;

    private static final int[] IDS = {HOME, PRODUCTS, ORDERS, NOTIFICATIONS, PROFILE};

    private BottomNav() { }

    public static void setup(final Activity a, int selectedId) {
        for (int id : IDS) {
            View item = a.findViewById(id);
            if (item == null) continue;
            item.setSelected(id == selectedId);
            setChildrenSelected(item, id == selectedId);
            final int target = id;
            item.setOnClickListener(v -> {
                if (target == selectedId) return;
                Intent i = new Intent(a, classFor(target));
                i.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                a.startActivity(i);
                a.overridePendingTransition(R.anim.fade_in, R.anim.fade_out);
            });
        }
    }

    public static void setBadge(Activity a, int count) {
        TextView badge = a.findViewById(R.id.nav_badge);
        if (badge == null) return;
        if (count <= 0) {
            badge.setVisibility(View.GONE);
        } else {
            badge.setVisibility(View.VISIBLE);
            badge.setText(count > 99 ? "99+" : String.valueOf(count));
        }
    }

    private static void setChildrenSelected(View v, boolean sel) {
        if (v instanceof android.view.ViewGroup) {
            android.view.ViewGroup g = (android.view.ViewGroup) v;
            for (int i = 0; i < g.getChildCount(); i++) {
                g.getChildAt(i).setSelected(sel);
                setChildrenSelected(g.getChildAt(i), sel);
            }
        }
    }

    private static Class<?> classFor(int id) {
        if (id == PRODUCTS) return ProductsActivity.class;
        if (id == ORDERS) return OrderHistoryActivity.class;
        if (id == NOTIFICATIONS) return NotificationsActivity.class;
        if (id == PROFILE) return ProfileActivity.class;
        return HomeActivity.class;
    }
}
