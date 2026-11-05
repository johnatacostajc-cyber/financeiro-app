package br.costa.financeiro;

import android.Manifest;
import android.app.Activity;
import android.content.ClipboardManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONObject;

/** Configuração: colar a chave, escolher os apps vigiados e ligar a leitura de notificações. */
public class SettingsActivity extends Activity {
    private EditText campoChave, campoApps, campoQuem;
    private TextView estado;
    private Button botaoLeitura, botaoAvisos;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        ScrollView sv = new ScrollView(this);
        sv.setBackgroundColor(Color.parseColor("#1F2024"));
        sv.setFitsSystemWindows(true);
        LinearLayout l = new LinearLayout(this);
        l.setOrientation(LinearLayout.VERTICAL);
        l.setPadding(48, 48, 48, 48);
        sv.addView(l);

        titulo(l, "Configurar o Financeiro");
        texto(l, "1. Cole o endereço secreto do app. Ele aparece no app de hoje, em Pré-lançamentos › “Como ligar as notificações do celular”. Também serve o link de configuração que tem “chave=”.");
        campoChave = campo(l, "Endereço secreto ou chave", false);
        Button colar = botao(l, "Colar da área de transferência");
        colar.setOnClickListener(v -> {
            ClipboardManager cm = getSystemService(ClipboardManager.class);
            if (cm != null && cm.hasPrimaryClip() && cm.getPrimaryClip().getItemCount() > 0) {
                CharSequence t = cm.getPrimaryClip().getItemAt(0).coerceToText(this);
                campoChave.setText(t);
            }
        });

        texto(l, "2. Apps dos bancos que viram pré-lançamento (parte do nome, separados por vírgula):");
        campoApps = campo(l, Config.APPS_PADRAO, true);
        texto(l, "No celular da Jordana, escreva Jordana aqui (no seu, deixe em branco):");
        campoQuem = campo(l, "Quem usa este celular", true);

        Button salvar = botao(l, "Salvar");
        salvar.setOnClickListener(v -> salvar(true));

        texto(l, "3. Permita que o Financeiro leia as notificações:");
        botaoLeitura = botao(l, "");
        botaoLeitura.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
        texto(l, "4. Permita os avisos de “Novo pré-lançamento”:");
        botaoAvisos = botao(l, "");
        botaoAvisos.setOnClickListener(v -> {
            if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        });

        texto(l, "5. Teste: manda um pré-lançamento de exemplo (depois é só descartar no app).");
        Button teste = botao(l, "Enviar teste");
        teste.setOnClickListener(v -> testar());

        estado = new TextView(this);
        estado.setTextColor(Color.parseColor("#9CA3AF"));
        estado.setPadding(0, 32, 0, 32);
        l.addView(estado);

        Button abrir = botao(l, "Abrir o Financeiro");
        abrir.setOnClickListener(v -> { if (salvar(false)) finish(); });

        campoChave.setText(Config.chave(this).isEmpty() ? "" : "••••• (chave guardada)");
        campoApps.setText(Config.apps(this));
        campoQuem.setText(Config.quem(this));
        setContentView(sv);
    }

    private boolean salvar(boolean avisar) {
        String digitado = campoChave.getText().toString();
        String chave = digitado.startsWith("•") ? Config.chave(this) : Config.extrairChave(digitado);
        if (chave.isEmpty()) { Toast.makeText(this, "Cole o endereço secreto primeiro.", Toast.LENGTH_LONG).show(); return false; }
        Config.salvar(this, chave, campoApps.getText().toString(), campoQuem.getText().toString());
        campoChave.setText("••••• (chave guardada)");
        if (avisar) Toast.makeText(this, "Salvo.", Toast.LENGTH_SHORT).show();
        atualizar();
        return true;
    }

    private void testar() {
        if (!salvar(false)) return;
        estado.setText("Enviando teste…");
        final String chave = Config.chave(this), quem = Config.quem(this);
        new Thread(() -> {
            String msg;
            try {
                JSONObject r = Sender.enviar(chave, quem, "Teste do app Financeiro", "Compra aprovada (teste)",
                        "Teste: compra de R$ 1,00 em TESTE DO APP. Pode descartar.");
                msg = r.optBoolean("ok") ? "Teste chegou! Veja em Pré-lançamentos e descarte." : "Recusado: " + r.optString("error");
            } catch (Exception e) {
                msg = "Não consegui enviar: " + e.getMessage();
            }
            final String m = msg;
            runOnUiThread(() -> estado.setText(m));
        }).start();
    }

    @Override
    protected void onResume() {
        super.onResume();
        atualizar();
    }

    private void atualizar() {
        String on = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        boolean leitura = on != null && on.contains(new ComponentName(this, NotificationReader.class).flattenToString());
        botaoLeitura.setText(leitura ? "✓ Leitura de notificações ligada" : "Ligar leitura de notificações");
        boolean avisos = Build.VERSION.SDK_INT < 33 || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        botaoAvisos.setText(avisos ? "✓ Avisos permitidos" : "Permitir avisos");
        String st = Config.prefs(this).getString("status", "");
        int fila = Config.fila(this).length();
        estado.setText((st.isEmpty() ? "Nenhuma notificação enviada ainda." : "Último envio: " + st) + (fila > 0 ? "\nNa fila para reenviar: " + fila : ""));
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] p, int[] g) { atualizar(); }

    private void titulo(LinearLayout l, String t) {
        TextView v = new TextView(this);
        v.setText(t);
        v.setTextSize(22);
        v.setTextColor(Color.WHITE);
        v.setPadding(0, 0, 0, 24);
        l.addView(v);
    }

    private void texto(LinearLayout l, String t) {
        TextView v = new TextView(this);
        v.setText(t);
        v.setTextSize(15);
        v.setTextColor(Color.parseColor("#E5E7EB"));
        v.setPadding(0, 32, 0, 12);
        l.addView(v);
    }

    private EditText campo(LinearLayout l, String dica, boolean visivel) {
        EditText e = new EditText(this);
        e.setHint(dica);
        e.setTextColor(Color.WHITE);
        e.setHintTextColor(Color.parseColor("#6B7280"));
        e.setSingleLine(true);
        e.setInputType(InputType.TYPE_CLASS_TEXT | (visivel ? 0 : InputType.TYPE_TEXT_VARIATION_URI));
        l.addView(e, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return e;
    }

    private Button botao(LinearLayout l, String t) {
        Button btn = new Button(this);
        btn.setText(t);
        btn.setAllCaps(false);
        l.addView(btn, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return btn;
    }
}
