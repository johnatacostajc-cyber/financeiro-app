package br.costa.financeiro;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;

import org.json.JSONArray;

/** Preferências do app: chave do backend, apps vigiados, nome de quem usa e fila de envio. */
final class Config {
    /** Backend do app (mesma planilha, protegido pela chave). O endereço não é secreto; a chave é. */
    static final String BACKEND = "https://script.google.com/macros/s/AKfycbzR_kKvKVMK1V1h-Y-e3MvbT8T9D8an8e0Il-LFXRyQOGvnb7y23PyVMdClrrvzve8x/exec";
    static final String APPS_PADRAO = "C6, Nubank, Bradesco, Binance, Avenue";

    private Config() {}

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("financeiro", Context.MODE_PRIVATE);
    }

    static String chave(Context c) { return prefs(c).getString("chave", ""); }
    static String apps(Context c) { return prefs(c).getString("apps", APPS_PADRAO); }
    static String quem(Context c) { return prefs(c).getString("quem", ""); }

    /** Aceita a chave pura, o link de configuração (?chave=) ou o endereço do MacroDroid (?k=). */
    static String extrairChave(String entrada) {
        String s = entrada == null ? "" : entrada.trim();
        if (s.isEmpty()) return "";
        if (s.contains("://")) {
            Uri u = Uri.parse(s);
            String k = u.getQueryParameter("k");
            if (k == null || k.isEmpty()) k = u.getQueryParameter("chave");
            if (k == null && u.getFragment() != null) {
                Uri f = Uri.parse("x://y/?" + u.getFragment());
                k = f.getQueryParameter("chave");
            }
            return k == null ? "" : k.trim();
        }
        return s;
    }

    static void salvar(Context c, String chave, String apps, String quem) {
        prefs(c).edit()
                .putString("chave", chave)
                .putString("apps", apps == null || apps.trim().isEmpty() ? APPS_PADRAO : apps.trim())
                .putString("quem", quem == null ? "" : quem.trim())
                .apply();
    }

    /** O app da notificação é vigiado se o nome dele contém alguma das palavras da lista. */
    static boolean vigiado(Context c, String nomeApp) {
        String n = nomeApp == null ? "" : nomeApp.toLowerCase();
        for (String p : apps(c).split("[,;\\n]")) {
            String w = p.trim().toLowerCase();
            if (!w.isEmpty() && n.contains(w)) return true;
        }
        return false;
    }

    static synchronized JSONArray fila(Context c) {
        try { return new JSONArray(prefs(c).getString("fila", "[]")); }
        catch (Exception e) { return new JSONArray(); }
    }

    static synchronized void gravarFila(Context c, JSONArray fila) {
        prefs(c).edit().putString("fila", fila.toString()).apply();
    }

    static void status(Context c, String texto) {
        prefs(c).edit().putString("status", texto).putLong("statusEm", System.currentTimeMillis()).apply();
    }
}
