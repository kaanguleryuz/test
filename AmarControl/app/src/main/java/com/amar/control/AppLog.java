package com.amar.control;

import android.os.Handler;
import android.os.Looper;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;

public final class AppLog {
    public interface Listener { void onChanged(String text); }
    private static final List<String> lines = new ArrayList<>();
    private static final CopyOnWriteArrayList<Listener> listeners = new CopyOnWriteArrayList<>();
    private static final Handler main = new Handler(Looper.getMainLooper());
    private AppLog() {}

    public static synchronized void add(String s) {
        String ts = new SimpleDateFormat("HH:mm:ss", Locale.US).format(new Date());
        lines.add(ts + "  " + s);
        while (lines.size() > 250) lines.remove(0);
        final String all = get();
        main.post(() -> { for (Listener l : listeners) l.onChanged(all); });
    }
    public static synchronized String get() { return android.text.TextUtils.join("\n", lines); }
    public static void listen(Listener l) { listeners.addIfAbsent(l); l.onChanged(get()); }
    public static void unlisten(Listener l) { listeners.remove(l); }
}
