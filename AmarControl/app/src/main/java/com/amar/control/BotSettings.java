package com.amar.control;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public final class BotSettings {
    private static final String PREF = "amar_control_settings";
    private static final String KEY_API = "deepinfra_api_key";
    private static final String KEY_OWN = "own_id";

    private BotSettings() {}

    public static JSONObject config(Context context) throws Exception {
        String raw = readAsset(context, "ayarlar.json");
        JSONObject o = new JSONObject(raw);
        o.remove("deepinfra_api_key");
        o.put("ai_http_port", "5555");
        o.put("ai_base_url", "http://127.0.0.1:5555");

        String own = prefs(context).getString(KEY_OWN, "");
        if (own != null && !own.trim().isEmpty()) o.put("own_id", own.trim());
        return o;
    }

    public static String getApiKey(Context context) {
        return prefs(context).getString(KEY_API, "");
    }

    public static String getOwnId(Context context) {
        String saved = prefs(context).getString(KEY_OWN, "");
        if (saved != null && !saved.trim().isEmpty()) return saved.trim();
        try { return config(context).optString("own_id", ""); }
        catch (Exception e) { return ""; }
    }

    public static void saveCredentials(Context context, String apiKey, String ownId) {
        prefs(context).edit()
                .putString(KEY_API, apiKey == null ? "" : apiKey.trim())
                .putString(KEY_OWN, ownId == null ? "" : ownId.trim())
                .apply();
    }

    public static boolean hasApiKey(Context context) {
        String s = getApiKey(context);
        return s != null && !s.trim().isEmpty();
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREF, Context.MODE_PRIVATE);
    }

    public static String readAsset(Context context, String name) throws Exception {
        try (InputStream in = context.getAssets().open(name);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }
}
