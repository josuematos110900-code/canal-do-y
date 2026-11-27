package com.ketshop.managers;

import android.app.job.JobParameters;
import android.app.job.JobService;

import com.ketshop.models.AppNotification;
import com.ketshop.network.Async;
import com.ketshop.network.SupabaseConfig;
import com.ketshop.repositories.NotificationRepository;

import java.util.List;

/**
 * Sincronização periódica de notificações em segundo plano (JobScheduler,
 * API 21+, sem bibliotecas). Alternativa ao Supabase Realtime, que exige
 * WebSockets (não disponíveis no SDK sem bibliotecas externas).
 */
public class NotificationSyncJobService extends JobService {

    private volatile boolean stopped;

    @Override
    public boolean onStartJob(final JobParameters params) {
        SessionManager.init(getApplicationContext());
        final PrefsManager prefs = new PrefsManager(getApplicationContext());
        if (!SupabaseConfig.isConfigured() || !SessionManager.get().isLoggedIn() || !prefs.isNotificationsEnabled()) {
            return false;
        }
        stopped = false;
        new Thread(() -> {
            try {
                String since = prefs.getLastNotificationTs();
                List<AppNotification> list = NotificationRepository.unreadSince(since, 5);
                String newest = since;
                for (AppNotification n : list) {
                    if (stopped) break;
                    NotificationHelper.show(getApplicationContext(), n);
                    if (newest == null || newest.isEmpty() || n.createdAt.compareTo(newest) > 0) newest = n.createdAt;
                }
                if (newest != null && !newest.isEmpty()) prefs.setLastNotificationTs(newest);
            } catch (Exception ignored) {
                // Sem rede ou sessão expirada: tenta novamente no próximo ciclo
            } finally {
                Async.main(() -> jobFinished(params, false));
            }
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        stopped = true;
        return true;
    }
}
