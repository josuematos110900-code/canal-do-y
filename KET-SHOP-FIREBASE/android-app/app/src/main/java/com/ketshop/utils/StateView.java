package com.ketshop.utils;

import android.app.Activity;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;

import com.ketshop.R;

/**
 * Controla o bloco de estado (include layout/view_state.xml):
 * a carregar / vazio / erro com botão "Tentar novamente".
 */
public final class StateView {

    private final View container;
    private final ProgressBar progress;
    private final TextView message;
    private final Button retry;
    private final View content;

    public StateView(Activity a, View content, Runnable onRetry) {
        this.container = a.findViewById(R.id.state_container);
        this.progress = a.findViewById(R.id.state_progress);
        this.message = a.findViewById(R.id.state_message);
        this.retry = a.findViewById(R.id.state_retry);
        this.content = content;
        retry.setOnClickListener(v -> onRetry.run());
    }

    public void loading() {
        container.setVisibility(View.VISIBLE);
        progress.setVisibility(View.VISIBLE);
        message.setVisibility(View.GONE);
        retry.setVisibility(View.GONE);
        if (content != null) content.setVisibility(View.GONE);
    }

    public void content() {
        container.setVisibility(View.GONE);
        if (content != null) content.setVisibility(View.VISIBLE);
    }

    public void empty(String msg) {
        container.setVisibility(View.VISIBLE);
        progress.setVisibility(View.GONE);
        message.setVisibility(View.VISIBLE);
        message.setText(msg);
        retry.setVisibility(View.GONE);
        if (content != null) content.setVisibility(View.GONE);
    }

    public void error(String msg) {
        container.setVisibility(View.VISIBLE);
        progress.setVisibility(View.GONE);
        message.setVisibility(View.VISIBLE);
        message.setText(msg);
        retry.setVisibility(View.VISIBLE);
        if (content != null) content.setVisibility(View.GONE);
    }
}
