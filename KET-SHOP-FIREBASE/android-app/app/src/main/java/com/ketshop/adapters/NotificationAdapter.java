package com.ketshop.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.ImageView;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.models.AppNotification;
import com.ketshop.utils.Formatters;

import java.util.ArrayList;
import java.util.List;

public class NotificationAdapter extends BaseAdapter {

    private final LayoutInflater inflater;
    private final List<AppNotification> items = new ArrayList<>();

    public NotificationAdapter(Context c) {
        inflater = LayoutInflater.from(c);
    }

    public void setItems(List<AppNotification> list) {
        items.clear();
        if (list != null) items.addAll(list);
        notifyDataSetChanged();
    }

    public void markRead(String id) {
        for (AppNotification n : items) if (n.id.equals(id)) n.read = true;
        notifyDataSetChanged();
    }

    public void markAllRead() {
        for (AppNotification n : items) n.read = true;
        notifyDataSetChanged();
    }

    @Override public int getCount() { return items.size(); }
    @Override public AppNotification getItem(int position) { return items.get(position); }
    @Override public long getItemId(int position) { return position; }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        Holder h;
        if (convertView == null) {
            convertView = inflater.inflate(R.layout.item_notification, parent, false);
            h = new Holder();
            h.icon = convertView.findViewById(R.id.item_notification_icon);
            h.title = convertView.findViewById(R.id.item_notification_title);
            h.body = convertView.findViewById(R.id.item_notification_body);
            h.time = convertView.findViewById(R.id.item_notification_time);
            h.dot = convertView.findViewById(R.id.item_notification_unread);
            convertView.setTag(h);
        } else {
            h = (Holder) convertView.getTag();
        }
        AppNotification n = getItem(position);
        h.title.setText(n.title);
        h.body.setText(n.body);
        h.time.setText(Formatters.relative(n.createdAt));
        h.dot.setVisibility(n.read ? View.INVISIBLE : View.VISIBLE);
        convertView.setAlpha(n.read ? 0.75f : 1f);
        h.icon.setImageResource(iconFor(n.type));
        return convertView;
    }

    private static int iconFor(String type) {
        if ("payment_approved".equals(type) || "order_completed".equals(type)) return R.drawable.ic_check_circle;
        if ("payment_rejected".equals(type)) return R.drawable.ic_warning;
        if ("proof_received".equals(type)) return R.drawable.ic_upload;
        if ("order_created".equals(type)) return R.drawable.ic_receipt;
        if ("order_status".equals(type)) return R.drawable.ic_time;
        return R.drawable.ic_bell;
    }

    static final class Holder {
        ImageView icon;
        TextView title, body, time;
        View dot;
    }
}
