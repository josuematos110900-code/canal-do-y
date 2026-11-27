package com.ketshop.activities;

import android.content.Intent;
import android.os.Bundle;
import android.view.GestureDetector;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.ViewFlipper;

import com.ketshop.R;
import com.ketshop.utils.UiUtils;

public class OnboardingActivity extends BaseActivity {

    private static final int[] ICONS = {R.drawable.ic_diamond, R.drawable.ic_upload, R.drawable.ic_time};
    private static final int[] TITLES = {R.string.onb_title_1, R.string.onb_title_2, R.string.onb_title_3};
    private static final int[] TEXTS = {R.string.onb_text_1, R.string.onb_text_2, R.string.onb_text_3};

    private ViewFlipper flipper;
    private LinearLayout dots;
    private Button next;
    private GestureDetector gestures;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_onboarding);
        flipper = findViewById(R.id.onboarding_flipper);
        dots = findViewById(R.id.onboarding_dots);
        next = findViewById(R.id.onboarding_next);

        LayoutInflater inf = LayoutInflater.from(this);
        for (int i = 0; i < ICONS.length; i++) {
            View page = inf.inflate(R.layout.item_onboarding_page, flipper, false);
            ((ImageView) page.findViewById(R.id.onboarding_page_icon)).setImageResource(ICONS[i]);
            ((TextView) page.findViewById(R.id.onboarding_page_title)).setText(TITLES[i]);
            ((TextView) page.findViewById(R.id.onboarding_page_text)).setText(TEXTS[i]);
            flipper.addView(page);
            View dot = new View(this);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(UiUtils.dp(this, 8), UiUtils.dp(this, 8));
            lp.setMargins(UiUtils.dp(this, 4), 0, UiUtils.dp(this, 4), 0);
            dots.addView(dot, lp);
        }
        updateDots();

        next.setOnClickListener(v -> {
            if (flipper.getDisplayedChild() < flipper.getChildCount() - 1) goTo(true);
            else finishOnboarding();
        });
        findViewById(R.id.onboarding_skip).setOnClickListener(v -> finishOnboarding());

        gestures = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override
            public boolean onDown(MotionEvent e) { return true; }

            @Override
            public boolean onFling(MotionEvent e1, MotionEvent e2, float vx, float vy) {
                if (e1 == null || e2 == null) return false;
                float dx = e2.getX() - e1.getX();
                if (Math.abs(dx) < UiUtils.dp(OnboardingActivity.this, 60)) return false;
                if (dx < 0 && flipper.getDisplayedChild() < flipper.getChildCount() - 1) goTo(true);
                else if (dx > 0 && flipper.getDisplayedChild() > 0) goTo(false);
                return true;
            }
        });
        flipper.setOnTouchListener((v, ev) -> gestures.onTouchEvent(ev));
    }

    private void goTo(boolean forward) {
        flipper.setInAnimation(this, forward ? R.anim.slide_in_right : R.anim.fade_in);
        flipper.setOutAnimation(this, R.anim.fade_out);
        if (forward) flipper.showNext(); else flipper.showPrevious();
        updateDots();
    }

    private void updateDots() {
        int current = flipper.getDisplayedChild();
        for (int i = 0; i < dots.getChildCount(); i++) {
            View d = dots.getChildAt(i);
            d.setBackgroundResource(i == current ? R.drawable.bg_dot_active : R.drawable.bg_dot);
            LinearLayout.LayoutParams lp = (LinearLayout.LayoutParams) d.getLayoutParams();
            lp.width = UiUtils.dp(this, i == current ? 26 : 8);
            d.setLayoutParams(lp);
        }
        next.setText(current == flipper.getChildCount() - 1 ? R.string.action_start : R.string.action_next);
    }

    private void finishOnboarding() {
        prefs.setOnboardingDone();
        startActivity(new Intent(this, LoginActivity.class));
        finish();
    }
}
