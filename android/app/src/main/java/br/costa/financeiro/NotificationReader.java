package br.costa.financeiro;

import android.app.Notification;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.util.LinkedHashMap;
import java.util.Map;

/** Lê as notificações dos apps vigiados (bancos, cartões, corretoras) e manda para os Pré-lançamentos. */
public class NotificationReader extends NotificationListenerService {
    // Alguns bancos atualizam a mesma notificação várias vezes: guarda as últimas para não mandar repetido.
    private final Map<String, Long> recentes = new LinkedHashMap<String, Long>() {
        @Override protected boolean removeEldestEntry(Map.Entry<String, Long> e) { return size() > 100; }
    };

    @Override
    public void onListenerConnected() {
        Config.status(this, Config.prefs(this).getString("status", "Leitura de notificações ligada."));
        Sender.tentarDeNovo(this);
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || getPackageName().equals(sbn.getPackageName())) return;
        Notification n = sbn.getNotification();
        if (n == null || (n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        String app = nomeDoApp(sbn.getPackageName(), n);
        if (!Config.vigiado(this, app)) return;
        Bundle ex = n.extras;
        String titulo = texto(ex, Notification.EXTRA_TITLE);
        String corpo = texto(ex, Notification.EXTRA_BIG_TEXT);
        if (corpo.isEmpty()) corpo = texto(ex, Notification.EXTRA_TEXT);
        if (titulo.isEmpty() && corpo.isEmpty()) return;
        if (!(titulo + corpo).matches("(?s).*\\d.*")) return; // sem valor: não é compra
        String chave = sbn.getPackageName() + "|" + titulo + "|" + corpo;
        long agora = System.currentTimeMillis();
        synchronized (recentes) {
            Long antes = recentes.get(chave);
            if (antes != null && agora - antes < 10 * 60 * 1000) return;
            recentes.put(chave, agora);
        }
        Sender.enfileirar(this, app, titulo, corpo);
    }

    private String nomeDoApp(String pacote, Notification n) {
        PackageManager pm = getPackageManager();
        try {
            ApplicationInfo ai = n.extras != null ? n.extras.getParcelable("android.appInfo") : null;
            if (ai == null) ai = pm.getApplicationInfo(pacote, 0);
            CharSequence l = pm.getApplicationLabel(ai);
            if (l != null) return l.toString();
        } catch (Exception ignored) { }
        return pacote;
    }

    private static String texto(Bundle ex, String k) {
        if (ex == null) return "";
        CharSequence v = ex.getCharSequence(k);
        return v == null ? "" : v.toString().replaceAll("\\s+", " ").trim();
    }
}
