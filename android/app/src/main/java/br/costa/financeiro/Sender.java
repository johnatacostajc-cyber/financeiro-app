package br.costa.financeiro;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Manda as notificações para os Pré-lançamentos. O que falhar fica na fila e vai na próxima tentativa. */
final class Sender {
    private static final ExecutorService EXEC = Executors.newSingleThreadExecutor();
    private static final String CANAL = "prelancamentos";

    private Sender() {}

    static void enfileirar(Context ctx, String app, String titulo, String texto) {
        final Context c = ctx.getApplicationContext();
        EXEC.execute(() -> {
            try {
                JSONArray f = Config.fila(c);
                JSONObject o = new JSONObject();
                o.put("app", app);
                o.put("titulo", titulo);
                o.put("texto", texto);
                o.put("em", System.currentTimeMillis());
                f.put(o);
                while (f.length() > 200) f.remove(0);
                Config.gravarFila(c, f);
            } catch (Exception ignored) { }
            esvaziarFila(c);
        });
    }

    static void tentarDeNovo(Context ctx) {
        final Context c = ctx.getApplicationContext();
        EXEC.execute(() -> esvaziarFila(c));
    }

    private static void esvaziarFila(Context c) {
        String chave = Config.chave(c);
        if (chave.isEmpty()) { Config.status(c, "Falta colar a chave do app."); return; }
        JSONArray f = Config.fila(c);
        JSONArray resto = new JSONArray();
        String agora = new SimpleDateFormat("dd/MM HH:mm", Locale.getDefault()).format(new Date());
        for (int i = 0; i < f.length(); i++) {
            JSONObject o = f.optJSONObject(i);
            if (o == null) continue;
            // Notificações com mais de 7 dias na fila são descartadas.
            if (System.currentTimeMillis() - o.optLong("em") > 7L * 24 * 3600 * 1000) continue;
            try {
                JSONObject r = enviar(chave, Config.quem(c), o.optString("app"), o.optString("titulo"), o.optString("texto"));
                if (!r.optBoolean("ok")) {
                    String erro = r.optString("error", "erro desconhecido");
                    Config.status(c, agora + " • recusado: " + erro);
                    if (erro.toLowerCase().contains("chave")) { resto.put(o); }
                    continue;
                }
                if (r.optBoolean("ignorada") || r.optBoolean("duplicada")) continue;
                Config.status(c, agora + " • enviado: " + o.optString("app") + " – " + o.optString("titulo"));
                avisar(c, o.optString("app"), o.optString("titulo"), o.optString("texto"));
            } catch (Exception e) {
                resto.put(o);
                Config.status(c, agora + " • sem conexão, vai de novo depois (" + e.getClass().getSimpleName() + ")");
            }
        }
        Config.gravarFila(c, resto);
    }

    /** Mesmo pedido que o MacroDroid fazia: acao=notificacao com app, titulo e texto. */
    static JSONObject enviar(String chave, String quem, String app, String titulo, String texto) throws Exception {
        Uri.Builder b = Uri.parse(Config.BACKEND).buildUpon()
                .appendQueryParameter("k", chave)
                .appendQueryParameter("acao", "notificacao")
                .appendQueryParameter("app", app)
                .appendQueryParameter("titulo", titulo)
                .appendQueryParameter("texto", texto);
        if (quem != null && !quem.isEmpty()) b.appendQueryParameter("quem", quem);
        HttpURLConnection con = (HttpURLConnection) new URL(b.build().toString()).openConnection();
        con.setInstanceFollowRedirects(true);
        con.setConnectTimeout(20000);
        con.setReadTimeout(30000);
        int code = con.getResponseCode();
        // O Apps Script responde com um redirecionamento para outro domínio; segue à mão se preciso.
        for (int i = 0; i < 4 && code >= 300 && code < 400; i++) {
            String loc = con.getHeaderField("Location");
            con.disconnect();
            if (loc == null) break;
            con = (HttpURLConnection) new URL(loc).openConnection();
            con.setConnectTimeout(20000);
            con.setReadTimeout(30000);
            code = con.getResponseCode();
        }
        if (code != 200) throw new java.io.IOException("HTTP " + code);
        try (InputStream in = con.getInputStream()) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            String body = out.toString("UTF-8").trim();
            if (!body.startsWith("{")) throw new java.io.IOException("resposta inesperada");
            return new JSONObject(body);
        } finally {
            con.disconnect();
        }
    }

    /** Aviso no celular: "Novo pré-lançamento". Tocar abre o app. */
    private static void avisar(Context c, String app, String titulo, String texto) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(CANAL) == null) {
            NotificationChannel ch = new NotificationChannel(CANAL, "Novos pré-lançamentos", NotificationManager.IMPORTANCE_DEFAULT);
            ch.setDescription("Avisa quando uma notificação do banco vira pré-lançamento.");
            nm.createNotificationChannel(ch);
        }
        Intent abrir = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, 0, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new Notification.Builder(c, CANAL)
                .setSmallIcon(android.R.drawable.stat_notify_more)
                .setContentTitle("Novo pré-lançamento")
                .setContentText(app + " – " + titulo)
                .setStyle(new Notification.BigTextStyle().bigText(app + " – " + titulo + "\n" + texto))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build();
        try { nm.notify((int) (System.currentTimeMillis() & 0x7fffffff), n); } catch (SecurityException ignored) { }
    }
}
