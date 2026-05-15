package com.fabrica30.app;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PdfSaverPlugin.class);
        super.onCreate(savedInstanceState);

        WebView webView = this.bridge.getWebView();
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                if (url != null && url.startsWith("blob:")) {
                    Toast.makeText(this, "Use o botao Exportar PDF do aplicativo.", Toast.LENGTH_LONG).show();
                    return;
                }
                String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimeType);
                request.addRequestHeader("User-Agent", userAgent);
                request.addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url));
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setTitle(fileName);
                request.setDescription("Baixando PDF gerado");
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                request.setAllowedOverMetered(true);
                request.setAllowedOverRoaming(true);

                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                dm.enqueue(request);
                Toast.makeText(this, "Download iniciado em Downloads", Toast.LENGTH_LONG).show();
            } catch (Exception e) {
                Toast.makeText(this, "Falha ao baixar arquivo: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }
}
