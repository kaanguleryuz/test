package com.amar.control;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.concurrent.TimeUnit;

public final class RootShell {
    public static final class Result {
        public final int code; public final String out;
        Result(int code, String out) { this.code = code; this.out = out; }
        public boolean ok() { return code == 0; }
    }
    private RootShell() {}

    public static Result run(String command, long timeoutSeconds) {
        Process p = null;
        try {
            p = new ProcessBuilder("su", "-c", command).redirectErrorStream(true).start();
            StringBuilder b = new StringBuilder();
            BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream()));
            long until = System.currentTimeMillis() + timeoutSeconds * 1000L;
            while (System.currentTimeMillis() < until) {
                while (r.ready()) { String s = r.readLine(); if (s != null) b.append(s).append('\n'); }
                try { if (p.exitValue() >= 0) break; } catch (IllegalThreadStateException ignored) {}
                Thread.sleep(40);
            }
            if (!p.waitFor(Math.max(1, timeoutSeconds), TimeUnit.SECONDS)) { p.destroyForcibly(); return new Result(124, b + "timeout"); }
            while (r.ready()) { String s = r.readLine(); if (s != null) b.append(s).append('\n'); }
            return new Result(p.exitValue(), b.toString().trim());
        } catch (Exception e) {
            if (p != null) p.destroy();
            return new Result(-1, e.toString());
        }
    }

    public static boolean hasRoot() {
        Result r = run("id", 4);
        return r.ok() && r.out.contains("uid=0");
    }
}
