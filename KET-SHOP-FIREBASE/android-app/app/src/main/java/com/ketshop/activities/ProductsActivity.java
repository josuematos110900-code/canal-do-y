package com.ketshop.activities;

import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.widget.EditText;
import android.widget.GridView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.adapters.ProductAdapter;
import com.ketshop.models.Product;
import com.ketshop.models.ProductCategory;
import com.ketshop.repositories.NotificationRepository;
import com.ketshop.repositories.ProductRepository;
import com.ketshop.utils.BottomNav;
import com.ketshop.utils.StateView;

import java.util.ArrayList;
import java.util.List;

public class ProductsActivity extends BaseActivity {

    public static final String EXTRA_CATEGORY_ID = "category_id";

    private ProductAdapter adapter;
    private GridView grid;
    private LinearLayout chips;
    private EditText search;
    private StateView state;
    private final List<Product> all = new ArrayList<>();
    private String categoryId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (!requireSession()) return;
        setContentView(R.layout.activity_products);
        setupToolbar(getString(R.string.products_title), false);
        BottomNav.setup(this, BottomNav.PRODUCTS);
        toolbarAction(R.drawable.ic_refresh, v -> load());

        categoryId = getIntent().getStringExtra(EXTRA_CATEGORY_ID);
        grid = findViewById(R.id.products_grid);
        chips = findViewById(R.id.products_categories);
        search = findViewById(R.id.products_search);
        adapter = new ProductAdapter(this);
        grid.setAdapter(adapter);
        state = new StateView(this, grid, this::load);

        grid.setOnItemClickListener((parent, view, position, id) ->
                ProductDetailsActivity.open(this, adapter.getItem(position)));
        search.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) { }
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) { applyFilter(); }
            @Override public void afterTextChanged(Editable s) { }
        });
        loadCategories();
        load();
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        String c = intent.getStringExtra(EXTRA_CATEGORY_ID);
        if (c != null) {
            categoryId = c;
            loadCategories();
            applyFilter();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        call(NotificationRepository::unreadCount, c -> BottomNav.setBadge(this, c), e -> { });
    }

    private void loadCategories() {
        call(ProductRepository::categories, this::showChips, e -> { });
    }

    private void showChips(List<ProductCategory> list) {
        chips.removeAllViews();
        LayoutInflater inf = LayoutInflater.from(this);
        TextView allChip = (TextView) inf.inflate(R.layout.view_chip, chips, false);
        allChip.setText(R.string.filter_all);
        allChip.setSelected(categoryId == null);
        allChip.setOnClickListener(v -> selectCategory(null));
        chips.addView(allChip);
        for (ProductCategory c : list) {
            TextView chip = (TextView) inf.inflate(R.layout.view_chip, chips, false);
            chip.setText(c.name);
            chip.setTag(c.id);
            chip.setSelected(c.id.equals(categoryId));
            chip.setOnClickListener(v -> selectCategory(c.id));
            chips.addView(chip);
        }
    }

    private void selectCategory(String id) {
        categoryId = id;
        for (int i = 0; i < chips.getChildCount(); i++) {
            Object tag = chips.getChildAt(i).getTag();
            chips.getChildAt(i).setSelected(id == null ? tag == null : id.equals(tag));
        }
        applyFilter();
    }

    private void load() {
        state.loading();
        call(() -> ProductRepository.products(null), list -> {
            all.clear();
            all.addAll(list);
            applyFilter();
        }, e -> state.error(e.getMessage()));
    }

    private void applyFilter() {
        String q = search.getText().toString().trim().toLowerCase();
        List<Product> out = new ArrayList<>();
        for (Product p : all) {
            if (categoryId != null && !categoryId.equals(p.categoryId)) continue;
            if (!q.isEmpty() && !(p.name.toLowerCase().contains(q)
                    || (p.description != null && p.description.toLowerCase().contains(q)))) continue;
            out.add(p);
        }
        adapter.setItems(out);
        if (all.isEmpty()) state.empty(getString(R.string.products_empty));
        else if (out.isEmpty()) state.empty(getString(R.string.products_no_results));
        else {
            state.content();
            grid.scheduleLayoutAnimation();
        }
    }
}
