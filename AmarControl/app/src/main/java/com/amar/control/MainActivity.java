package com.amar.control;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

public class MainActivity extends Activity implements AppLog.Listener {
    private TextView status, log;
    private BotRuntime bot;

    @Override public void onCreate(Bundle b) {
        super.onCreate(b);
        bot = BotRuntime.get(this);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(32, 26, 32, 22);
        root.setBackgroundColor(Color.rgb(18, 18, 20));

        TextView title = text("AMAR CONTROL", 25, Color.WHITE);
        title.setGravity(Gravity.CENTER_HORIZONTAL);
        root.addView(title);

        TextView sub = text("Magisk · Frida · arka plan bot v0.3.1", 14, Color.LTGRAY);
        sub.setGravity(Gravity.CENTER_HORIZONTAL);
        root.addView(sub);

        status = text("Hazırlanıyor…", 15, Color.WHITE);
        status.setPadding(0, 18, 0, 14);
        root.addView(status);

        root.addView(button("1 · ROOT KONTROL", v -> checkRoot()));
        root.addView(button("2 · KAYAN MENÜYÜ AÇ", v -> startOverlay()));
        root.addView(button("3 · BOTU BAŞLAT", v -> { ensureOverlayThen(() -> bot.start()); }));
        root.addView(button("4 · BOTU DURDUR", v -> bot.stop()));
        root.addView(button("5 · AI / KENDİ ID AYARLARI", v -> showAiSettings()));
        root.addView(button("6 · AMAR'I AÇ", v -> openAmar()));
        root.addView(button("AYARLARI TELEFONA UYGULA", v -> bot.syncConfigNow()));
        root.addView(button("SERVİSİ DURDUR", v -> {
            bot.stop();
            stopService(new Intent(this, OverlayService.class));
            AppLog.add("Arka plan servisi durduruldu");
        }));

        TextView tip = text(
                "İlk BOTU BAŞLAT kullanımında Frida telefona indirilir. Amar öndeyken mavi A balonu kalır; bot foreground service içinde çalışır.",
                13, Color.LTGRAY);
        tip.setPadding(0, 12, 0, 4);
        root.addView(tip);

        TextView lt = text("Canlı log", 17, Color.WHITE);
        lt.setPadding(0, 18, 0, 8);
        root.addView(lt);

        log = text("", 12, Color.rgb(190, 230, 190));
        log.setTextIsSelectable(true);
        ScrollView sc = new ScrollView(this);
        sc.addView(log);
        root.addView(sc, new LinearLayout.LayoutParams(-1, 0, 1f));

        setContentView(root);
        AppLog.listen(this);
        AppLog.add("Panel v0.3.1 açıldı · SDK " + Build.VERSION.SDK_INT);
        refreshStatus();
    }

    private TextView text(String s, int sp, int c) {
        TextView t = new TextView(this);
        t.setText(s); t.setTextSize(sp); t.setTextColor(c);
        return t;
    }

    private Button button(String s, View.OnClickListener l) {
        Button b = new Button(this);
        b.setText(s); b.setAllCaps(false); b.setOnClickListener(l);
        return b;
    }

    private void checkRoot() {
        AppLog.add("Magisk root kontrolü yapılıyor…");
        new Thread(() -> {
            RootShell.Result r = RootShell.run("id", 5);
            AppLog.add(r.ok() && r.out.contains("uid=0") ? "Magisk root: TAMAM · " + r.out : "Root alınamadı · " + r.out);
            runOnUiThread(this::refreshStatus);
        }, "root-check").start();
    }

    private void refreshStatus() {
        new Thread(() -> {
            boolean rootOk = RootShell.hasRoot();
            boolean overlayOk = Settings.canDrawOverlays(this);
            RootShell.Result pid = RootShell.run("pidof " + BotRuntime.AMAR_PACKAGE, 3);
            boolean amarOpen = pid.ok() && !pid.out.trim().isEmpty();
            String botStatus = bot.getStatus();
            boolean api = BotSettings.hasApiKey(this);
            runOnUiThread(() -> status.setText(
                    "Root " + (rootOk ? "✓" : "✗") +
                    "   Menü " + (overlayOk ? "✓" : "✗") +
                    "   Amar " + (amarOpen ? "AÇIK" : "KAPALI") +
                    "\nBot: " + botStatus + "   AI key " + (api ? "✓" : "✗")));
        }, "status-refresh").start();
    }

    private void ensureOverlayThen(Runnable action) {
        if (!Settings.canDrawOverlays(this)) {
            AppLog.add("Önce ekran üstünde göster iznini aç");
            startOverlay();
            return;
        }
        Intent service = new Intent(this, OverlayService.class);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(service); else startService(service);
        action.run();
    }

    private void startOverlay() {
        if (!Settings.canDrawOverlays(this)) {
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) i.setData(Uri.parse("package:" + getPackageName()));
            startActivity(i);
            return;
        }
        Intent service = new Intent(this, OverlayService.class);
        if (Build.VERSION.SDK_INT >= 26) startForegroundService(service); else startService(service);
        AppLog.add("Kayan menü servisi başlatıldı");
    }

    private void showAiSettings() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        int p = 36; box.setPadding(p, 12, p, 0);

        EditText own = new EditText(this);
        own.setHint("Kendi Amar ID (own_id)");
        own.setInputType(InputType.TYPE_CLASS_NUMBER);
        own.setText(BotSettings.getOwnId(this));
        box.addView(own);

        EditText api = new EditText(this);
        api.setHint("DeepInfra API key");
        api.setSingleLine(true);
        api.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        String saved = BotSettings.getApiKey(this);
        api.setText(saved);
        box.addView(api);

        new AlertDialog.Builder(this)
                .setTitle("AI ve hesap ayarları")
                .setMessage("API anahtarı yalnızca bu APK'nın özel depolamasında tutulur; GitHub/reposuna yazılmaz.")
                .setView(box)
                .setPositiveButton("KAYDET", (d, w) -> {
                    BotSettings.saveCredentials(this, api.getText().toString(), own.getText().toString());
                    AppLog.add("AI / own_id ayarları kaydedildi");
                    bot.syncConfigNow();
                    refreshStatus();
                })
                .setNegativeButton("İPTAL", null)
                .show();
    }

    private void openAmar() {
        Intent i = getPackageManager().getLaunchIntentForPackage(BotRuntime.AMAR_PACKAGE);
        if (i == null) { AppLog.add("Amar paketi bulunamadı: " + BotRuntime.AMAR_PACKAGE); return; }
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(i);
        AppLog.add("Amar açıldı");
    }

    @Override protected void onResume() { super.onResume(); refreshStatus(); }
    @Override protected void onDestroy() { AppLog.unlisten(this); super.onDestroy(); }
    @Override public void onChanged(String t) {
        if (log != null) {
            log.setText(t);
            final ScrollView s = (ScrollView) log.getParent();
            s.post(() -> s.fullScroll(View.FOCUS_DOWN));
        }
    }
}
