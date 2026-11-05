package br.costa.financeiro;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Abre o Controle Financeiro (o mesmo backend do app de hoje) e mostra um aviso se a leitura de notificações estiver desligada. */
public class MainActivity extends Activity {
    private static final int ESCOLHER_ARQUIVO = 7;
    private WebView web;
    private TextView aviso;
    private ValueCallback<Uri[]> arquivoCallback;
    private String chaveCarregada = "";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Config.chave(this).isEmpty()) {
            startActivity(new Intent(this, SettingsActivity.class));
        }
        LinearLayout raiz = new LinearLayout(this);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setBackgroundColor(Color.parseColor("#1F2024"));
        raiz.setFitsSystemWindows(true);

        aviso = new TextView(this);
        aviso.setText("Leitura das notificações dos bancos desligada. Toque para configurar.");
        aviso.setTextColor(Color.parseColor("#1F2024"));
        aviso.setBackgroundColor(Color.parseColor("#FACC15"));
        aviso.setPadding(32, 24, 32, 24);
        aviso.setGravity(Gravity.CENTER);
        aviso.setOnClickListener(v -> startActivity(new Intent(this, SettingsActivity.class)));
        raiz.addView(aviso, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportMultipleWindows(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String host = r.getUrl().getHost() == null ? "" : r.getUrl().getHost();
                if (host.endsWith("google.com") || host.endsWith("googleusercontent.com") || host.endsWith("gstatic.com")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, r.getUrl())); } catch (Exception ignored) { }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (arquivoCallback != null) arquivoCallback.onReceiveValue(null);
                arquivoCallback = cb;
                try {
                    startActivityForResult(p.createIntent(), ESCOLHER_ARQUIVO);
                } catch (Exception e) {
                    arquivoCallback = null;
                    return false;
                }
                return true;
            }
        });
        FrameLayout box = new FrameLayout(this);
        box.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        raiz.addView(box, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(raiz);
        carregar();
    }

    private void carregar() {
        String chave = Config.chave(this);
        if (chave.isEmpty() || chave.equals(chaveCarregada)) return;
        chaveCarregada = chave;
        web.loadUrl(Config.BACKEND + "?k=" + Uri.encode(chave));
    }

    @Override
    protected void onResume() {
        super.onResume();
        carregar();
        aviso.setVisibility(leituraLigada() ? View.GONE : View.VISIBLE);
        Sender.tentarDeNovo(this);
    }

    boolean leituraLigada() {
        String on = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        ComponentName eu = new ComponentName(this, NotificationReader.class);
        return on != null && on.contains(eu.flattenToString());
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == ESCOLHER_ARQUIVO && arquivoCallback != null) {
            arquivoCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            arquivoCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
}
