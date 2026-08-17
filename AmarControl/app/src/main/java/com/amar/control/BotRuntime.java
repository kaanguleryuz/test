package com.amar.control;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONArray;
import org.tukaani.xz.XZInputStream;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;

public final class BotRuntime {
    public static final String AMAR_PACKAGE = "com.immomo.biz.ddoversea";
    public static final String FRIDA_VERSION = "17.17.0";
    private static volatile BotRuntime INSTANCE;

    private final Context context;
    private final LocalAiServer aiServer;
    private final AtomicBoolean wanted = new AtomicBoolean(false);
    private volatile String status = "Bot kapalı";
    private volatile Process injectProcess;
    private volatile long lastHeartbeat;
    private volatile boolean attached;
    private Thread worker;
    private Thread watchdog;

    private BotRuntime(Context context) {
        this.context = context.getApplicationContext();
        this.aiServer = new LocalAiServer(this.context);
    }

    public static BotRuntime get(Context context) {
        if (INSTANCE == null) synchronized (BotRuntime.class) {
            if (INSTANCE == null) INSTANCE = new BotRuntime(context);
        }
        return INSTANCE;
    }

    public boolean isWanted() { return wanted.get(); }
    public boolean isAttached() { return attached; }
    public String getStatus() { return status; }

    public synchronized void start() {
        if (wanted.get()) { AppLog.add("Bot zaten başlatılmış"); return; }
        wanted.set(true);
        attached = false;
        setStatus("Bot hazırlanıyor");
        worker = new Thread(this::runLoop, "amar-bot-runtime");
        worker.start();
        watchdog = new Thread(this::watchdogLoop, "amar-bot-watchdog");
        watchdog.start();
    }

    public synchronized void stop() {
        wanted.set(false);
        attached = false;
        setStatus("Bot durduruluyor");
        try { if (injectProcess != null) injectProcess.destroy(); } catch (Exception ignored) {}
        RootShell.run("pkill -f amar-frida-inject >/dev/null 2>&1 || true", 3);
        aiServer.stop();
        setStatus("Bot kapalı");
        AppLog.add("BOT DURDU");
    }

    public void syncConfigNow() {
        new Thread(() -> {
            try { syncConfig(); AppLog.add("ayarlar.json telefona güncellendi"); }
            catch (Exception e) { AppLog.add("Ayar senkron hata: " + e); }
        }, "config-sync").start();
    }

    private void runLoop() {
        if (!RootShell.hasRoot()) {
            setStatus("Root izni yok");
            AppLog.add("BOT HATA · Magisk root izni alınamadı");
            wanted.set(false);
            return;
        }
        try {
            aiServer.start();
            prepareStaticFiles();
            ensureFridaInject();
            restoreIdFile();
        } catch (Exception e) {
            AppLog.add("BOT hazırlık hata: " + e);
            setStatus("Hazırlık hatası");
            wanted.set(false);
            return;
        }

        while (wanted.get()) {
            try {
                ensureAmarOpen();
                String pid = firstPid();
                if (pid.isEmpty()) {
                    setStatus("Amar bekleniyor");
                    sleep(2500);
                    continue;
                }

                syncConfig();
                lastHeartbeat = System.currentTimeMillis();
                attached = false;
                setStatus("Frida bağlanıyor · PID " + pid);
                AppLog.add("Frida " + FRIDA_VERSION + " · Amar PID " + pid + " attach");

                String cmd = "cd /data/local/tmp && exec ./amar-frida-inject -p " + pid + " -s /data/local/tmp/amar-bot.js";
                Process p = RootShell.start(cmd);
                injectProcess = p;
                try (BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                    String line;
                    while (wanted.get() && (line = r.readLine()) != null) handleFridaLine(line);
                }
                try { p.waitFor(); } catch (Exception ignored) {}
                injectProcess = null;
                attached = false;
                if (wanted.get()) {
                    setStatus("Bağlantı koptu · yeniden deneniyor");
                    AppLog.add("Frida oturumu kapandı · tekrar bağlanacak");
                    sleep(3500);
                }
            } catch (Exception e) {
                attached = false;
                AppLog.add("Frida runtime hata: " + e);
                setStatus("Frida hata · tekrar deneniyor");
                sleep(4000);
            }
        }
    }

    private void watchdogLoop() {
        while (wanted.get()) {
            sleep(5000);
            if (!wanted.get()) break;
            if (attached && System.currentTimeMillis() - lastHeartbeat > 70000) {
                AppLog.add("HEARTBEAT zaman aşımı · Frida yeniden bağlanıyor");
                attached = false;
                try { if (injectProcess != null) injectProcess.destroy(); } catch (Exception ignored) {}
                RootShell.run("pkill -f amar-frida-inject >/dev/null 2>&1 || true", 3);
            }
        }
    }

    private void handleFridaLine(String raw) {
        String line = raw == null ? "" : raw.trim();
        if (line.isEmpty()) return;
        if (line.contains("[HEARTBEAT]")) {
            lastHeartbeat = System.currentTimeMillis();
            return;
        }
        if (line.contains("[IDFILE_DATA]")) {
            persistIdFile(line);
            return;
        }
        if (line.contains("Mesaj dinleme aktif") || line.contains("Ayarlar yüklendi")) {
            attached = true;
            lastHeartbeat = System.currentTimeMillis();
            setStatus("BOT AKTİF ✓");
        }
        if (line.contains("FATAL HATA")) {
            AppLog.add("FRIDA FATAL · Amar yeniden başlatılacak");
            RootShell.run("am force-stop " + AMAR_PACKAGE, 4);
        }
        String cleaned = line.replaceFirst("^\\[[^\\]]+::Amar\\s*\\]\\->\\s*", "").trim();
        if (!cleaned.isEmpty()) AppLog.add("F · " + clip(cleaned, 240));
    }

    private void persistIdFile(String line) {
        try {
            String raw = line.substring(line.indexOf("[IDFILE_DATA]") + "[IDFILE_DATA]".length()).trim();
            JSONArray a = new JSONArray(raw);
            JSONArray last = new JSONArray();
            int start = Math.max(0, a.length() - 10);
            for (int i = start; i < a.length(); i++) last.put(String.valueOf(a.opt(i)));
            File dir = new File(context.getFilesDir(), "bot"); dir.mkdirs();
            File local = new File(dir, "id.json");
            write(local, last.toString(2));
            RootShell.run("cp " + sh(local.getAbsolutePath()) + " /data/local/tmp/id.json && chmod 644 /data/local/tmp/id.json", 5);
        } catch (Exception e) {
            AppLog.add("IDFILE hata: " + e.getMessage());
        }
    }

    private void restoreIdFile() {
        File local = new File(new File(context.getFilesDir(), "bot"), "id.json");
        if (local.exists()) RootShell.run("cp " + sh(local.getAbsolutePath()) + " /data/local/tmp/id.json && chmod 644 /data/local/tmp/id.json", 5);
        else RootShell.run("printf '[]' > /data/local/tmp/id.json && chmod 644 /data/local/tmp/id.json", 4);
    }

    private void prepareStaticFiles() throws Exception {
        File dir = new File(context.getFilesDir(), "bot"); if (!dir.exists() && !dir.mkdirs()) throw new Exception("bot klasörü oluşturulamadı");
        File js = new File(dir, "amar-bot.js");
        write(js, BotSettings.readAsset(context, "amar-bot.js"));
        RootShell.Result r = RootShell.run("cp " + sh(js.getAbsolutePath()) + " /data/local/tmp/amar-bot.js && chmod 644 /data/local/tmp/amar-bot.js", 8);
        if (!r.ok()) throw new Exception("JS kopyalama: " + r.out);
        syncConfig();
    }

    private void syncConfig() throws Exception {
        File dir = new File(context.getFilesDir(), "bot"); dir.mkdirs();
        File cfg = new File(dir, "ayarlar.json");
        write(cfg, BotSettings.config(context).toString(2));
        RootShell.Result r = RootShell.run("cp " + sh(cfg.getAbsolutePath()) + " /data/local/tmp/ayarlar.json.tmp && chmod 644 /data/local/tmp/ayarlar.json.tmp && mv /data/local/tmp/ayarlar.json.tmp /data/local/tmp/ayarlar.json", 8);
        if (!r.ok()) throw new Exception("ayarlar kopyalama: " + r.out);
    }

    private void ensureFridaInject() throws Exception {
        String arch = fridaArch();
        File dir = new File(context.getFilesDir(), "frida"); if (!dir.exists()) dir.mkdirs();
        File bin = new File(dir, "frida-inject-" + FRIDA_VERSION + "-" + arch);
        if (!bin.exists() || bin.length() < 1024 * 1024) {
            setStatus("Frida indiriliyor · " + arch);
            AppLog.add("Frida-inject " + FRIDA_VERSION + " indiriliyor · " + arch);
            String base = "https://github.com/frida/frida/releases/download/" + FRIDA_VERSION + "/";
            String name = "frida-inject-" + FRIDA_VERSION + "-android-" + arch + ".xz";
            File xz = new File(dir, name);
            download(base + name, xz);
            try (XZInputStream in = new XZInputStream(new FileInputStream(xz));
                 FileOutputStream out = new FileOutputStream(bin)) {
                byte[] buf = new byte[65536]; int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
            //noinspection ResultOfMethodCallIgnored
            xz.delete();
            AppLog.add("Frida-inject hazır · " + (bin.length() / 1024 / 1024) + " MB");
        }
        RootShell.Result cp = RootShell.run("cp " + sh(bin.getAbsolutePath()) + " /data/local/tmp/amar-frida-inject && chmod 755 /data/local/tmp/amar-frida-inject", 15);
        if (!cp.ok()) throw new Exception("Frida kopyalama: " + cp.out);
    }

    private String fridaArch() throws Exception {
        RootShell.Result r = RootShell.run("getprop ro.product.cpu.abi", 3);
        String abi = r.out.trim();
        if (abi.isEmpty() && Build.SUPPORTED_ABIS.length > 0) abi = Build.SUPPORTED_ABIS[0];
        if (abi.contains("arm64")) return "arm64";
        if (abi.contains("armeabi") || abi.equals("arm")) return "arm";
        if (abi.contains("x86_64")) return "x86_64";
        if (abi.contains("x86")) return "x86";
        throw new Exception("Desteklenmeyen ABI: " + abi);
    }

    private void download(String url, File dest) throws Exception {
        URL u = new URL(url);
        for (int redirects = 0; redirects < 6; redirects++) {
            HttpURLConnection c = (HttpURLConnection) u.openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(20000); c.setReadTimeout(120000);
            c.setRequestProperty("User-Agent", "AmarControl-Android/0.3");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) {
                String loc = c.getHeaderField("Location"); c.disconnect();
                if (loc == null) throw new Exception("Frida redirect konumu yok");
                u = new URL(u, loc); continue;
            }
            if (code < 200 || code >= 300) { c.disconnect(); throw new Exception("Frida HTTP " + code); }
            try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(dest)) {
                byte[] buf = new byte[65536]; int n; long total = 0, lastLog = 0;
                while ((n = in.read(buf)) > 0) {
                    out.write(buf, 0, n); total += n;
                    if (total - lastLog > 5L * 1024 * 1024) { AppLog.add("Frida indirme · " + (total / 1024 / 1024) + " MB"); lastLog = total; }
                }
            } finally { c.disconnect(); }
            return;
        }
        throw new Exception("Çok fazla yönlendirme");
    }

    private String firstPid() {
        RootShell.Result r = RootShell.run("pidof " + AMAR_PACKAGE, 4);
        if (!r.ok()) return "";
        String s = r.out.trim(); if (s.isEmpty()) return "";
        return s.split("\\s+")[0];
    }

    private void ensureAmarOpen() {
        if (!firstPid().isEmpty()) return;
        Intent i = context.getPackageManager().getLaunchIntentForPackage(AMAR_PACKAGE);
        if (i != null) {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(i);
            AppLog.add("Amar açılıyor");
            sleep(2500);
        } else {
            RootShell.run("monkey -p " + AMAR_PACKAGE + " -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1", 6);
            sleep(2500);
        }
    }

    private void setStatus(String s) { status = s; AppLog.add("BOT · " + s); }
    private static void write(File f, String s) throws Exception { try (FileOutputStream out = new FileOutputStream(f)) { out.write(s.getBytes(StandardCharsets.UTF_8)); } }
    private static String sh(String s) { return "'" + s.replace("'", "'\\''") + "'"; }
    private static void sleep(long ms) { try { Thread.sleep(ms); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); } }
    private static String clip(String s, int n) { s = s == null ? "" : s.replaceAll("\\s+", " ").trim(); return s.length() <= n ? s : s.substring(0, Math.max(0, n - 1)) + "…"; }
}
