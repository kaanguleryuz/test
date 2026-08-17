package com.amar.control;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class OverlayService extends Service {
    private static final int NOTIF = 70;
    private static final String AMAR_PACKAGE = "com.immomo.biz.ddoversea";

    private WindowManager wm;
    private View bubble;
    private LinearLayout panel;
    private WindowManager.LayoutParams bubbleParams, panelParams;
    private TextView stateText;
    private volatile boolean testWorker;
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override public void onCreate() {
        super.onCreate();
        createChannel();
        startForeground(NOTIF, notification("Hazır"));

        if (!Settings.canDrawOverlays(this)) {
            AppLog.add("Kayan menü izni yok");
            stopSelf();
            return;
        }

        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        makeBubble();
        makePanel();
        AppLog.add("Arka plan servisi aktif");
        updateState("Hazır");
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel c = new NotificationChannel(
                    "amar_control", "Amar Control", NotificationManager.IMPORTANCE_LOW);
            c.setDescription("Amar Control arka plan durumu");
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(c);
        }
    }

    private Notification notification(String status) {
        Intent i = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(
                this, 0, i,
                Build.VERSION.SDK_INT >= 23
                        ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                        : PendingIntent.FLAG_UPDATE_CURRENT);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, "amar_control")
                : new Notification.Builder(this);

        return b.setContentTitle("Amar Control çalışıyor")
                .setContentText(status)
                .setSmallIcon(android.R.drawable.stat_notify_chat)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
    }

    private void updateNotification(String status) {
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(NOTIF, notification(status));
    }

    private int overlayType() {
        return Build.VERSION.SDK_INT >= 26
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
    }

    private GradientDrawable bg(int color, float radius) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(color);
        d.setCornerRadius(radius);
        return d;
    }

    private void makeBubble() {
        TextView v = new TextView(this);
        v.setText("A");
        v.setTextColor(Color.WHITE);
        v.setTextSize(22);
        v.setGravity(Gravity.CENTER);
        v.setBackground(bg(Color.rgb(37, 115, 255), 60));
        v.setElevation(12);

        bubbleParams = new WindowManager.LayoutParams(
                112, 112, overlayType(),
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT);
        bubbleParams.gravity = Gravity.TOP | Gravity.START;
        bubbleParams.x = 20;
        bubbleParams.y = 330;

        v.setOnTouchListener(new View.OnTouchListener() {
            float dx, dy, downX, downY;
            boolean moved;

            @Override public boolean onTouch(View view, MotionEvent e) {
                switch (e.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        downX = e.getRawX();
                        downY = e.getRawY();
                        dx = bubbleParams.x - downX;
                        dy = bubbleParams.y - downY;
                        moved = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        if (Math.abs(e.getRawX() - downX) > 8 || Math.abs(e.getRawY() - downY) > 8) {
                            moved = true;
                        }
                        bubbleParams.x = (int) (e.getRawX() + dx);
                        bubbleParams.y = (int) (e.getRawY() + dy);
                        try { wm.updateViewLayout(bubble, bubbleParams); } catch (Exception ignored) {}
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (!moved) togglePanel();
                        return true;
                    default:
                        return false;
                }
            }
        });

        bubble = v;
        wm.addView(bubble, bubbleParams);
    }

    private void makePanel() {
        panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        panel.setPadding(18, 18, 18, 18);
        panel.setBackground(bg(Color.argb(245, 24, 24, 28), 24));
        panel.setVisibility(View.GONE);

        TextView h = new TextView(this);
        h.setText("AMAR CONTROL");
        h.setTextColor(Color.WHITE);
        h.setTextSize(16);
        h.setGravity(Gravity.CENTER_HORIZONTAL);
        panel.addView(h);

        stateText = new TextView(this);
        stateText.setText("Hazır");
        stateText.setTextColor(Color.LTGRAY);
        stateText.setTextSize(13);
        stateText.setPadding(8, 10, 8, 12);
        stateText.setGravity(Gravity.CENTER_HORIZONTAL);
        panel.addView(stateText);

        panel.addView(btn("ARKA PLAN TESTİNİ BAŞLAT", v -> startTest()));
        panel.addView(btn("TESTİ DURDUR", v -> stopTest()));
        panel.addView(btn("AMAR'I AÇ", v -> openAmar()));
        panel.addView(btn("ROOT DURUMU", v -> rootStatus()));
        panel.addView(btn("CANLI LOGLAR", v -> openMainPanel()));
        panel.addView(btn("MENÜYÜ GİZLE", v -> togglePanel()));
        panel.addView(btn("SERVİSİ KAPAT", v -> stopSelf()));

        panelParams = new WindowManager.LayoutParams(
                460, WindowManager.LayoutParams.WRAP_CONTENT, overlayType(),
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT);
        panelParams.gravity = Gravity.TOP | Gravity.START;
        panelParams.x = 145;
        panelParams.y = 265;
        wm.addView(panel, panelParams);
    }

    private Button btn(String s, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setOnClickListener(l);
        return b;
    }

    private void togglePanel() {
        if (panel != null) {
            panel.setVisibility(panel.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE);
        }
    }

    private void updateState(String s) {
        main.post(() -> {
            if (stateText != null) stateText.setText(s);
            updateNotification(s);
        });
    }

    private void rootStatus() {
        new Thread(() -> {
            RootShell.Result r = RootShell.run("id", 4);
            String msg = r.ok() && r.out.contains("uid=0")
                    ? "Root TAMAM · " + r.out
                    : "Root HATA · " + r.out;
            AppLog.add(msg);
            updateState(r.ok() ? "Root ✓" : "Root ✗");
        }, "root-check").start();
    }

    private void startTest() {
        if (testWorker) {
            AppLog.add("Arka plan testi zaten aktif");
            return;
        }
        testWorker = true;
        AppLog.add("Arka plan test worker başladı");
        updateState("Test aktif");

        new Thread(() -> {
            boolean first = true;
            while (testWorker) {
                RootShell.Result root = RootShell.run("id", 4);
                boolean rootOk = root.ok() && root.out.contains("uid=0");

                RootShell.Result pid = RootShell.run("pidof " + AMAR_PACKAGE, 3);
                boolean amarOpen = pid.ok() && !pid.out.trim().isEmpty();

                String state = "Root " + (rootOk ? "✓" : "✗") + "  ·  Amar " + (amarOpen ? "AÇIK" : "KAPALI");
                updateState(state);
                AppLog.add(state + (amarOpen ? " · pid " + pid.out.trim() : ""));

                if (first) {
                    RootShell.Result abi = RootShell.run("getprop ro.product.cpu.abi", 3);
                    RootShell.Result android = RootShell.run("getprop ro.build.version.release", 3);
                    AppLog.add("Telefon: Android " + android.out.trim() + " · ABI " + abi.out.trim());
                    first = false;
                }

                try { Thread.sleep(5000); } catch (InterruptedException ignored) { break; }
            }
        }, "amar-test-worker").start();
    }

    private void stopTest() {
        testWorker = false;
        updateState("Test durdu");
        AppLog.add("Arka plan test worker durdu");
    }

    private void openAmar() {
        Intent i = getPackageManager().getLaunchIntentForPackage(AMAR_PACKAGE);
        if (i == null) {
            AppLog.add("Amar bulunamadı: " + AMAR_PACKAGE);
            updateState("Amar bulunamadı");
            return;
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(i);
        AppLog.add("Amar öne getirildi");
    }

    private void openMainPanel() {
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(i);
    }

    @Override public int onStartCommand(Intent i, int flags, int startId) {
        return START_STICKY;
    }

    @Override public void onDestroy() {
        testWorker = false;
        if (wm != null) {
            try { if (bubble != null) wm.removeView(bubble); } catch (Exception ignored) {}
            try { if (panel != null) wm.removeView(panel); } catch (Exception ignored) {}
        }
        AppLog.add("Kayan menü kapandı");
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent i) { return null; }
}
