package com.ketshop;

import android.app.Application;

import com.ketshop.managers.NotificationHelper;
import com.ketshop.managers.SessionManager;

public class KetShopApp extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        SessionManager.init(this);
        NotificationHelper.createChannels(this);
    }
}
