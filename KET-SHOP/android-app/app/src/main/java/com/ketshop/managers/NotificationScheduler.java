package com.ketshop.managers;

import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;

/** Agenda/cancela a verificação periódica de notificações (mínimo do Android: 15 min). */
public final class NotificationScheduler {

    private static final int JOB_ID = 4201;
    private static final long INTERVAL_MS = 15L * 60L * 1000L;

    private NotificationScheduler() { }

    public static void schedule(Context context) {
        JobScheduler js = (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        JobInfo info = new JobInfo.Builder(JOB_ID, new ComponentName(context, NotificationSyncJobService.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(INTERVAL_MS)
                .setPersisted(true)
                .build();
        js.schedule(info);
    }

    public static void cancel(Context context) {
        JobScheduler js = (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js != null) js.cancel(JOB_ID);
    }
}
