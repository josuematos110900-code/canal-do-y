package com.ketshop.adapters;

import android.content.Context;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.ketshop.R;
import com.ketshop.models.StatusHistoryEntry;
import com.ketshop.utils.Formatters;

import java.util.List;

/**
 * Preenche um LinearLayout com o histórico de estados (usado dentro de
 * ScrollView, onde ListView não é adequado).
 */
public final class StatusHistoryAdapter {

    private StatusHistoryAdapter() { }

    public static void bind(Context c, LinearLayout container, List<StatusHistoryEntry> entries) {
        container.removeAllViews();
        LayoutInflater inf = LayoutInflater.from(c);
        for (int i = entries.size() - 1; i >= 0; i--) {
            StatusHistoryEntry e = entries.get(i);
            View row = inf.inflate(R.layout.item_status_history, container, false);
            ((TextView) row.findViewById(R.id.item_history_status)).setText(e.newStatus.label);
            ((TextView) row.findViewById(R.id.item_history_date)).setText(Formatters.dateTime(e.createdAt));
            TextView note = row.findViewById(R.id.item_history_note);
            if (e.note != null && !e.note.isEmpty()) {
                note.setVisibility(View.VISIBLE);
                note.setText(e.note);
            } else {
                note.setVisibility(View.GONE);
            }
            View dot = row.findViewById(R.id.item_history_dot);
            dot.setBackgroundResource(i == entries.size() - 1 ? R.drawable.bg_timeline_current : R.drawable.bg_timeline_done);
            container.addView(row);
        }
    }
}
