package com.ketshop.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.models.Order;
import com.ketshop.utils.Formatters;
import com.ketshop.utils.UiUtils;

import java.util.ArrayList;
import java.util.List;

public class OrderAdapter extends BaseAdapter {

    private final LayoutInflater inflater;
    private final List<Order> items = new ArrayList<>();

    public OrderAdapter(Context c) {
        inflater = LayoutInflater.from(c);
    }

    public void setItems(List<Order> list) {
        items.clear();
        if (list != null) items.addAll(list);
        notifyDataSetChanged();
    }

    @Override public int getCount() { return items.size(); }
    @Override public Order getItem(int position) { return items.get(position); }
    @Override public long getItemId(int position) { return position; }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        Holder h;
        if (convertView == null) {
            convertView = inflater.inflate(R.layout.item_order, parent, false);
            h = new Holder();
            h.code = convertView.findViewById(R.id.item_order_code);
            h.product = convertView.findViewById(R.id.item_order_product);
            h.player = convertView.findViewById(R.id.item_order_player);
            h.total = convertView.findViewById(R.id.item_order_total);
            h.date = convertView.findViewById(R.id.item_order_date);
            h.status = convertView.findViewById(R.id.item_order_status);
            convertView.setTag(h);
        } else {
            h = (Holder) convertView.getTag();
        }
        Order o = getItem(position);
        h.code.setText(o.orderCode);
        h.product.setText(o.productTitle());
        h.player.setText("ID " + o.playerId);
        h.total.setText(Formatters.kz(o.totalKz));
        h.date.setText(Formatters.dateTime(o.createdAt));
        UiUtils.statusPill(h.status, o.status);
        return convertView;
    }

    static final class Holder {
        TextView code, product, player, total, date, status;
    }
}
