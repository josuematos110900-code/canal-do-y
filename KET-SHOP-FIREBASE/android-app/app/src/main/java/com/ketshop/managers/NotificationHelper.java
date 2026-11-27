package com.ketshop.managers;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import com.ketshop.R;
import com.ketshop.activities.NotificationsActivity;
import com.ketshop.activities.OrderDetailsActivity;
import com.ketshop.models.AppNotification;

/** Mostra notificações do sistema (sem bibliotecas externas). */
public final class NotificationHelper {

    public static final String CHANNEL_ORDERS = "ketshop_orders";

    private NotificationHelper() { }

    public static void createChannels(Context context) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel ch = new NotificationChannel(CHANNEL_ORDERS,
                    context.getString(R.string.notif_channel_name), NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription(context.getString(R.string.notif_channel_desc));
            ch.enableLights(true);
            ch.setLightColor(0xFFB44CFF);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    public static boolean canPost(Context context) {
        if (Build.VERSION.SDK_INT >= 33) {
            return context.checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    @SuppressWarnings("deprecation")
    public static void show(Context context, AppNotification n) {
        if (!canPost(context)) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        Intent intent;
        if (n.orderId != null && !n.orderId.isEmpty()) {
            intent = new Intent(context, OrderDetailsActivity.class);
            intent.putExtra(OrderDetailsActivity.EXTRA_ORDER_ID, n.orderId);
        } else {
            intent = new Intent(context, NotificationsActivity.class);
        }
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(context, n.id.hashCode(), intent, flags);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(context, CHANNEL_ORDERS)
                : new Notification.Builder(context);
        b.setSmallIcon(R.drawable.ic_diamond)
                .setColor(0xFFB44CFF)
                .setContentTitle(n.title)
                .setContentText(n.body)
                .setStyle(new Notification.BigTextStyle().bigText(n.body))
                .setAutoCancel(true)
                .setContentIntent(pi);
        if (Build.VERSION.SDK_INT < 26) {
            b.setPriority(Notification.PRIORITY_HIGH);
            b.setDefaults(Notification.DEFAULT_ALL);
        }
        nm.notify(n.id.hashCode(), b.build());
    }
}
