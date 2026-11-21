package com.ketshop.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.ImageView;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.models.PaymentMethod;

import java.util.ArrayList;
import java.util.List;

public class PaymentMethodAdapter extends BaseAdapter {

    private final LayoutInflater inflater;
    private final List<PaymentMethod> items = new ArrayList<>();
    private int selected = -1;

    public PaymentMethodAdapter(Context c) {
        inflater = LayoutInflater.from(c);
    }

    public void setItems(List<PaymentMethod> list) {
        items.clear();
        if (list != null) items.addAll(list);
        notifyDataSetChanged();
    }

    public void select(int position) {
        selected = position;
        notifyDataSetChanged();
    }

    public void selectById(String id) {
        for (int i = 0; i < items.size(); i++) {
            if (items.get(i).id.equals(id)) { select(i); return; }
        }
    }

    public PaymentMethod getSelected() {
        return selected >= 0 && selected < items.size() ? items.get(selected) : null;
    }

    @Override public int getCount() { return items.size(); }
    @Override public PaymentMethod getItem(int position) { return items.get(position); }
    @Override public long getItemId(int position) { return position; }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        if (convertView == null) convertView = inflater.inflate(R.layout.item_payment_method, parent, false);
        PaymentMethod m = getItem(position);
        ImageView icon = convertView.findViewById(R.id.item_payment_icon);
        TextView name = convertView.findViewById(R.id.item_payment_name);
        TextView desc = convertView.findViewById(R.id.item_payment_desc);
        ImageView check = convertView.findViewById(R.id.item_payment_check);
        name.setText(m.name);
        desc.setText(m.description == null || m.description.isEmpty() ? m.typeLabel() : m.description);
        icon.setImageResource(iconFor(m.type));
        boolean sel = position == selected;
        convertView.setSelected(sel);
        check.setVisibility(sel ? View.VISIBLE : View.INVISIBLE);
        return convertView;
    }

    public static int iconFor(String type) {
        if ("bank_transfer".equals(type)) return R.drawable.ic_bank;
        if ("multicaixa_express".equals(type)) return R.drawable.ic_flash;
        if ("paypay".equals(type)) return R.drawable.ic_phone;
        return R.drawable.ic_payment;
    }
}
