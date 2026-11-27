package com.ketshop.managers;

import android.os.Handler;
import android.os.Looper;

/**
 * Actualização periódica enquanto um ecrã está visível (estratégia
 * alternativa ao Realtime). Iniciar em onResume e parar em onPause.
 */
public final class PollingManager {

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable action;
    private final long intervalMs;
    private boolean running;

    private final Runnable loop = new Runnable() {
        @Override
        public void run() {
            if (!running) return;
            action.run();
            handler.postDelayed(this, intervalMs);
        }
    };

    public PollingManager(int intervalSeconds, Runnable action) {
        this.intervalMs = Math.max(10, intervalSeconds) * 1000L;
        this.action = action;
    }

    public void start() {
        if (running) return;
        running = true;
        handler.postDelayed(loop, intervalMs);
    }

    public void stop() {
        running = false;
        handler.removeCallbacks(loop);
    }
}
