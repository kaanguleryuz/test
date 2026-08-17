package com.amar.control;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.net.ssl.HttpsURLConnection;

public final class LocalAiServer {
    private final Context context;
    private ExecutorService clients = Executors.newCachedThreadPool();
    private final Map<String, Deque<Msg>> history = new ConcurrentHashMap<>();
    private final Random random = new Random();
    private volatile boolean running;
    private volatile ServerSocket server;
    private Thread acceptThread;

    private static final class Msg {
        final String role, content;
        Msg(String role, String content) { this.role = role; this.content = content; }
    }

    public LocalAiServer(Context context) {
        this.context = context.getApplicationContext();
    }

    public synchronized int start() throws Exception {
        if (running && server != null && !server.isClosed()) return server.getLocalPort();
        if (clients == null || clients.isShutdown()) clients = Executors.newCachedThreadPool();

        ServerSocket chosen = null;
        int preferred = BotSettings.getAiPort(context);
        int[] ports = new int[11];
        ports[0] = preferred;
        int idx = 1;
        for (int p = 5555; p <= 5565; p++) {
            if (p != preferred) ports[idx++] = p;
        }

        Exception last = null;
        for (int i = 0; i < idx; i++) {
            int port = ports[i];
            try {
                ServerSocket s = new ServerSocket();
                s.setReuseAddress(true);
                s.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), port), 16);
                chosen = s;
                break;
            } catch (Exception e) {
                last = e;
            }
        }
        if (chosen == null) throw new IllegalStateException("5555-5565 arasında boş AI portu yok", last);

        server = chosen;
        running = true;
        int activePort = chosen.getLocalPort();
        BotSettings.setAiPort(context, activePort);
        AppLog.add("AI servis: http://127.0.0.1:" + activePort + "/chat");
        if (activePort != 5555) AppLog.add("AI port 5555 dolu · otomatik " + activePort + " seçildi");
        AppLog.add(BotSettings.hasApiKey(context)
                ? "DeepInfra anahtarı hazır"
                : "DeepInfra anahtarı yok · normal mesajlarda fallback kullanılacak");
        acceptThread = new Thread(this::acceptLoop, "amar-ai-server");
        acceptThread.start();
        return activePort;
    }

    public synchronized void stop() {
        running = false;
        try { if (server != null) server.close(); } catch (Exception ignored) {}
        server = null;
        clients.shutdownNow();
        history.clear();
    }

    private void acceptLoop() {
        try {
            ServerSocket s = server;
            if (s == null) throw new IllegalStateException("AI socket hazırlanmadı");
            while (running) {
                Socket c = s.accept();
                clients.submit(() -> handle(c));
            }
        } catch (Exception e) {
            if (running) AppLog.add("AI servis hata: " + e);
        }
    }

    private void handle(Socket socket) {
        try (Socket s = socket;
             BufferedInputStream in = new BufferedInputStream(s.getInputStream());
             BufferedOutputStream out = new BufferedOutputStream(s.getOutputStream())) {
            String requestLine = readLine(in);
            if (requestLine == null) return;
            int contentLength = 0;
            String line;
            while ((line = readLine(in)) != null && !line.isEmpty()) {
                int k = line.indexOf(':');
                if (k > 0 && line.substring(0, k).trim().equalsIgnoreCase("Content-Length")) {
                    try { contentLength = Integer.parseInt(line.substring(k + 1).trim()); } catch (Exception ignored) {}
                }
            }
            byte[] body = readExactly(in, Math.max(0, contentLength));
            if (!requestLine.startsWith("POST /chat ")) {
                send(out, 404, new JSONObject().put("error", "not_found"));
                return;
            }

            JSONObject req = new JSONObject(new String(body, StandardCharsets.UTF_8));
            String accountId = req.optString("account_id", "");
            String userId = req.optString("user_id", "default");
            String message = req.optString("message", "").trim();
            if (message.isEmpty()) {
                send(out, 200, new JSONObject().put("answer", ""));
                return;
            }

            Answer a = answer(accountId, userId, message);
            JSONObject resp = new JSONObject();
            resp.put("answer", a.text);
            resp.put("provider", a.provider);
            resp.put("memory", "ram_only");
            send(out, 200, resp);
        } catch (Exception e) {
            AppLog.add("AI istek hata: " + e.getClass().getSimpleName() + " · " + e.getMessage());
        }
    }

    private static final class Answer {
        final String text, provider;
        Answer(String text, String provider) { this.text = text; this.provider = provider; }
    }

    private Answer answer(String accountId, String userId, String userMsg) {
        try {
            JSONObject cfg = BotSettings.config(context);
            int pairs = clamp(cfg.optInt("ai_hafiza_konusma_sayisi", 25), 1, 50);
            String key = (accountId == null || accountId.trim().isEmpty() ? "" : accountId.trim() + ":") + userId;
            Deque<Msg> q = history.computeIfAbsent(key, x -> new ArrayDeque<>());
            List<Msg> snapshot;
            synchronized (q) { snapshot = new ArrayList<>(q); }

            String apiKey = BotSettings.getApiKey(context);
            String chosen = "";
            String provider = "ai_fallback";
            if (apiKey != null && !apiKey.trim().isEmpty()) {
                int attempts = clamp(cfg.optInt("ai_tekrar_deneme", 1), 1, 5);
                boolean repeatGuard = cfg.optBoolean("ai_tekrar_engelle", true);
                double threshold = cfg.optDouble("ai_tekrar_benzerlik", 0.88);
                for (int i = 0; i < attempts; i++) {
                    String candidate = deepInfra(cfg, apiKey.trim(), snapshot, userMsg, i > 0);
                    candidate = safe(candidate);
                    if (!candidate.isEmpty() && (!repeatGuard || !isRepeated(candidate, snapshot, threshold))) {
                        chosen = candidate;
                        provider = "deepinfra";
                        break;
                    }
                }
            }
            if (chosen.isEmpty()) chosen = fallback(cfg, snapshot);

            synchronized (q) {
                q.addLast(new Msg("user", userMsg));
                q.addLast(new Msg("assistant", chosen));
                while (q.size() > pairs * 2) q.removeFirst();
            }
            AppLog.add("AI · " + userId + " · " + provider + " · " + clip(chosen, 80));
            return new Answer(chosen, provider);
        } catch (Exception e) {
            AppLog.add("DeepInfra hata: " + e.getClass().getSimpleName() + " · " + e.getMessage());
            try {
                JSONObject cfg = BotSettings.config(context);
                return new Answer(fallback(cfg, new ArrayList<>()), "ai_fallback");
            } catch (Exception ignored) {
                return new Answer("seni anlayamadım canım", "ai_fallback");
            }
        }
    }

    private String deepInfra(JSONObject cfg, String apiKey, List<Msg> hist, String userMsg, boolean retry) throws Exception {
        String base = cfg.optString("deepinfra_base_url", "https://api.deepinfra.com/v1/openai");
        while (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        String model = cfg.optString("deepinfra_model", "deepseek-ai/DeepSeek-V3");

        JSONArray messages = new JSONArray();
        String system = cfg.optString("systemPrompt", "Türkçe kısa ve doğal cevap ver.");
        system += "\n\nAI HAFIZA KURALI: Önceki user ve assistant mesajları aynı kullanıcıyla gerçek konuşmandır. Cevabı verilmiş soruyu tekrar sorma ve konuşmanın kaldığı yeri geçmişten takip et.";
        if (retry) system += "\nBu cevap önceki cevabına fazla benzemesin; farklı ve doğal cevap üret.";
        messages.put(new JSONObject().put("role", "system").put("content", system));
        for (Msg m : hist) messages.put(new JSONObject().put("role", m.role).put("content", m.content));
        messages.put(new JSONObject().put("role", "user").put("content", userMsg));

        JSONObject payload = new JSONObject();
        payload.put("model", model);
        payload.put("messages", messages);
        payload.put("stream", false);
        payload.put("temperature", cfg.optDouble("temperature", 0.8));
        payload.put("top_p", cfg.optDouble("top_p", 0.9));
        payload.put("max_tokens", cfg.optInt("max_tokens", 25));

        HttpsURLConnection c = (HttpsURLConnection) new URL(base + "/chat/completions").openConnection();
        c.setConnectTimeout(20000);
        c.setReadTimeout(90000);
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        c.setRequestProperty("Accept", "application/json");
        c.setRequestProperty("Authorization", "Bearer " + apiKey);
        c.setRequestProperty("User-Agent", "AmarControl-Android/0.3");
        byte[] bytes = payload.toString().getBytes(StandardCharsets.UTF_8);
        c.setFixedLengthStreamingMode(bytes.length);
        try (OutputStream os = c.getOutputStream()) { os.write(bytes); }
        int code = c.getResponseCode();
        InputStream response = code >= 200 && code < 300 ? c.getInputStream() : c.getErrorStream();
        String raw = readAll(response);
        c.disconnect();
        if (code < 200 || code >= 300) throw new IllegalStateException("HTTP " + code + " " + clip(raw, 180));
        JSONObject parsed = new JSONObject(raw);
        JSONArray choices = parsed.optJSONArray("choices");
        if (choices == null || choices.length() == 0) return "";
        JSONObject msg = choices.getJSONObject(0).optJSONObject("message");
        return msg == null ? "" : msg.optString("content", "");
    }

    private String fallback(JSONObject cfg, List<Msg> hist) {
        List<String> pool = new ArrayList<>();
        JSONArray a = cfg.optJSONArray("aiFallbackMesajlari");
        if (a != null) for (int i = 0; i < a.length(); i++) {
            String s = a.optString(i, "").trim(); if (!s.isEmpty()) pool.add(s);
        }
        String one = cfg.optString("aiFallbackMesaji", "").trim();
        if (!one.isEmpty()) pool.add(one);
        if (pool.isEmpty()) pool.add("seni anlayamadım canım");
        double threshold = cfg.optDouble("ai_tekrar_benzerlik", 0.88);
        for (int tries = 0; tries < pool.size() * 2; tries++) {
            String s = pool.get(random.nextInt(pool.size()));
            if (!isRepeated(s, hist, threshold)) return s;
        }
        return pool.get(random.nextInt(pool.size()));
    }

    private static boolean isRepeated(String candidate, List<Msg> hist, double threshold) {
        String c = norm(candidate);
        if (c.isEmpty()) return true;
        for (Msg m : hist) if ("assistant".equals(m.role)) {
            String o = norm(m.content);
            if (c.equals(o)) return true;
            int max = Math.max(c.length(), o.length());
            if (max >= 12 && max > 0) {
                double sim = 1.0 - ((double) levenshtein(c, o) / (double) max);
                if (sim >= threshold) return true;
            }
        }
        return false;
    }

    private static String norm(String s) {
        String x = Normalizer.normalize(s == null ? "" : s.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").replace('ı', 'i')
                .replaceAll("[^a-z0-9çğıöşü\\s]", " ").replaceAll("\\s+", " ").trim();
        return x;
    }

    private static int levenshtein(String a, String b) {
        int[] prev = new int[b.length() + 1], cur = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) prev[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            cur[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
            }
            int[] t = prev; prev = cur; cur = t;
        }
        return prev[b.length()];
    }

    private static void send(OutputStream out, int code, JSONObject body) throws Exception {
        byte[] data = body.toString().getBytes(StandardCharsets.UTF_8);
        String head = "HTTP/1.1 " + code + (code == 200 ? " OK" : " Not Found") + "\r\n" +
                "Content-Type: application/json; charset=utf-8\r\n" +
                "Content-Length: " + data.length + "\r\n" +
                "Connection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.US_ASCII));
        out.write(data);
        out.flush();
    }

    private static String readLine(InputStream in) throws Exception {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        int c;
        boolean got = false;
        while ((c = in.read()) != -1) {
            got = true;
            if (c == '\n') break;
            if (c != '\r') b.write(c);
        }
        if (!got && b.size() == 0) return null;
        return b.toString(StandardCharsets.ISO_8859_1.name());
    }

    private static byte[] readExactly(InputStream in, int n) throws Exception {
        byte[] b = new byte[n]; int off = 0;
        while (off < n) { int r = in.read(b, off, n - off); if (r < 0) break; off += r; }
        if (off == n) return b;
        byte[] shortB = new byte[off]; System.arraycopy(b, 0, shortB, 0, off); return shortB;
    }

    private static String readAll(InputStream in) throws Exception {
        if (in == null) return "";
        try (InputStream x = in; ByteArrayOutputStream b = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192]; int n;
            while ((n = x.read(buf)) > 0) b.write(buf, 0, n);
            return b.toString(StandardCharsets.UTF_8.name());
        }
    }

    private static String safe(String s) { if (s == null) return ""; s = s.replace('\r', ' ').trim(); return s.length() > 600 ? s.substring(0, 600) : s; }
    private static int clamp(int x, int a, int b) { return Math.max(a, Math.min(b, x)); }
    private static String clip(String s, int n) { if (s == null) return ""; s = s.replaceAll("\\s+", " ").trim(); return s.length() <= n ? s : s.substring(0, Math.max(0, n - 1)) + "…"; }
}
