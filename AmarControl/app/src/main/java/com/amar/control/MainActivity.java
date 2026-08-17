package com.amar.control;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public class MainActivity extends Activity implements AppLog.Listener {
    private static final String AMAR_PACKAGE = "com.immomo.biz.ddoversea";
    private TextView status, log;

    @Override public void onCreate(Bundle b) {
        super.onCreate(b);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(32, 30, 32, 24);
        root.setBackgroundColor(Color.rgb(18, 18, 20));

        TextView title = text("AMAR CONTROL", 25, Color.WHITE);
        title.setGravity(Gravity.CENTER_HORIZONTAL);
        root.addView(title);

        TextView sub = text("Android 11 / Magisk · kayan menü test sürümü", 14, Color.LTGRAY);
        sub.setGravity(Gravity.CENTER_HORIZONTAL);
        root.addView(sub);

        status = text("Hazırlanıyor…", 15, Color.WHITE);
        status.setPadding(0, 22, 0, 18);
        root.addView(status);

        root.addView(button("1 · ROOT KONTROL", v -> checkRoot()));
        root.addView(button("2 · KAYAN MENÜYÜ AÇ", v -> startOverlay()));
        root.addView(button("3 · AMAR'I AÇ", v -> openAmar()));
        root.addView(button("SERVİSİ DURDUR", v -> {
            stopService(new Intent(this, OverlayService.class));
            AppLog.add("Arka plan servisi durduruldu");
        }));

        TextView tip = text(
                "Amar açıkken ekranda mavi A balonu kalır. Balona dokununca test menüsü açılır.",
                13, Color.LTGRAY);
        tip.setPadding(0, 14, 0, 4);
        root.addView(tip);

        TextView lt = text("Canlı log", 17, Color.WHITE);
        lt.setPadding(0, 22, 0, 8);
        root.addView(lt);

        log = text("", 12, Color.rgb(190, 230, 190));
        log.setTextIsSelectable(true);
        ScrollView sc = new ScrollView(this);
        sc.addView(log);
        root.addView(sc, new LinearLayout.LayoutParams(-1, 0, 1f));

        setContentView(root);
        AppLog.listen(this);
        AppLog.add("Panel açıldı · SDK " + Build.VERSION.SDK_INT);
        refreshStatus();
    }

    private TextView text(String s, int sp, int c) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(c);
        return t;
    }

    private Button button(String s, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(s);
        b.setAllCaps(false);
        b.setOnClickListener(l);
        return b;
    }

    private void checkRoot() {
        AppLog.add("Magisk root kontrolü yapılıyor…");
        new Thread(() -> {
            RootShell.Result r = RootShell.run("id", 5);
            AppLog.add(r.ok() && r.out.contains("uid=0")
                    ? "Magisk root: TAMAM · " + r.out
                    : "Root alınamadı; Magisk isteğini onayla · " + r.out);
            runOnUiThread(this::refreshStatus);
        }, "root-check").start();
    }

    private void refreshStatus() {
        new Thread(() -> {
            boolean rootOk = RootShell.hasRoot();
            boolean overlayOk = Settings.canDrawOverlays(this);
            RootShell.Result pid = RootShell.run("pidof " + AMAR_PACKAGE, 3);
            boolean amarOpen = pid.ok() && !pid.out.trim().isEmpty();

            runOnUiThread(() -> status.setText(
                    "Root: " + (rootOk ? "✓" : "✗") +
                    "    Kayan menü: " + (overlayOk ? "✓" : "✗") +
                    "    Amar: " + (amarOpen ? "AÇIK" : "KAPALI")));
        }, "status-refresh").start();
    }

    private void startOverlay() {
        if (!Settings.canDrawOverlays(this)) {
            AppLog.add("Ekran üstünde göster izni isteniyor. Android 11'de listeden Amar Control'ü seç.");
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
            // Android 11 package: verisini yok sayabilir; eski sürümlerde doğrudan uygulama ekranına gider.
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                i.setData(Uri.parse("package:" + getPackageName()));
            }
            startActivity(i);
            return;
        }

        Intent service = new Intent(this, OverlayService.class);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(service);
        else startService(service);
        AppLog.add("Kayan menü servisi başlatıldı");
    }

    private void openAmar() {
        Intent i = getPackageManager().getLaunchIntentForPackage(AMAR_PACKAGE);
        if (i == null) {
            AppLog.add("Amar paketi bulunamadı: " + AMAR_PACKAGE);
            return;
        }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(i);
        AppLog.add("Amar açıldı");
    }

    @Override protected void onResume() {
        super.onResume();
        refreshStatus();
    }

    @Override protected void onDestroy() {
        AppLog.unlisten(this);
        super.onDestroy();
    }

    @Override public void onChanged(String t) {
        if (log != null) {
            log.setText(t);
            final ScrollView s = (ScrollView) log.getParent();
            s.post(() -> s.fullScroll(View.FOCUS_DOWN));
        }
    }
}
