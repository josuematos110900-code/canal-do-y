package com.ketshop.utils;

import android.app.Activity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.ketshop.R;

/** Constrói linhas de resumo ("rótulo — valor") e linhas copiáveis. */
public final class Rows {

    private Rows() { }

    public static void summary(LinearLayout container, String label, String value) {
        if (value == null || value.isEmpty()) return;
        View row = LayoutInflater.from(container.getContext()).inflate(R.layout.item_summary_row, container, false);
        ((TextView) row.findViewById(R.id.summary_row_label)).setText(label);
        ((TextView) row.findViewById(R.id.summary_row_value)).setText(value);
        container.addView(row);
    }

    public static void copyable(final Activity a, LinearLayout container, final String label, final String value) {
        if (value == null || value.trim().isEmpty()) return;
        View row = LayoutInflater.from(a).inflate(R.layout.item_copy_row, container, false);
        ((TextView) row.findViewById(R.id.copy_row_label)).setText(label);
        ((TextView) row.findViewById(R.id.copy_row_value)).setText(value);
        row.findViewById(R.id.copy_row_button).setOnClickListener(v -> UiUtils.copy(a, label, value.replace(" ", "")));
        container.addView(row);
    }
}
