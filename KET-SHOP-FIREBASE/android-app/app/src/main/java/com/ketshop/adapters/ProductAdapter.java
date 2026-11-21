package com.ketshop.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.ImageView;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.models.Product;
import com.ketshop.utils.Formatters;
import com.ketshop.utils.ImageLoader;

import java.util.ArrayList;
import java.util.List;

/** Grelha de produtos (GridView) — sem RecyclerView para evitar AndroidX. */
public class ProductAdapter extends BaseAdapter {

    private final LayoutInflater inflater;
    private final List<Product> items = new ArrayList<>();

    public ProductAdapter(Context c) {
        inflater = LayoutInflater.from(c);
    }

    public void setItems(List<Product> list) {
        items.clear();
        if (list != null) items.addAll(list);
        notifyDataSetChanged();
    }

    @Override public int getCount() { return items.size(); }
    @Override public Product getItem(int position) { return items.get(position); }
    @Override public long getItemId(int position) { return position; }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        Holder h;
        if (convertView == null) {
            convertView = inflater.inflate(R.layout.item_product, parent, false);
            h = new Holder();
            h.icon = convertView.findViewById(R.id.item_product_icon);
            h.name = convertView.findViewById(R.id.item_product_name);
            h.detail = convertView.findViewById(R.id.item_product_detail);
            h.price = convertView.findViewById(R.id.item_product_price);
            h.badge = convertView.findViewById(R.id.item_product_badge);
            convertView.setTag(h);
        } else {
            h = (Holder) convertView.getTag();
        }
        Product p = getItem(position);
        h.name.setText(p.name);
        if (p.isDiamond()) {
            h.detail.setText(Formatters.number(p.baseAmount) + " + " + Formatters.number(p.bonusAmount) + " bónus");
            ImageLoader.load(h.icon, p.imageUrl, R.drawable.ic_diamond);
        } else {
            h.detail.setText(p.categoryName != null ? p.categoryName : p.game);
            ImageLoader.load(h.icon, p.imageUrl, R.drawable.ic_ticket);
        }
        h.price.setText(Formatters.kz(p.priceKz));
        if (p.onDemand) {
            h.badge.setVisibility(View.VISIBLE);
            h.badge.setText(R.string.badge_on_demand);
        } else if (p.featured) {
            h.badge.setVisibility(View.VISIBLE);
            h.badge.setText(R.string.badge_popular);
        } else {
            h.badge.setVisibility(View.GONE);
        }
        return convertView;
    }

    static final class Holder {
        ImageView icon;
        TextView name, detail, price, badge;
    }
}
