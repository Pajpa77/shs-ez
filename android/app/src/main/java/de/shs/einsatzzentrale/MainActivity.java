package de.shs.einsatzzentrale;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppInstallerPlugin.class);
        super.onCreate(savedInstanceState);

        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().setWebViewClient(new BridgeWebViewClient(this.bridge) {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                        if (request != null && request.getUrl() != null) {
                            Uri url = request.getUrl();
                            String scheme = url.getScheme();
                            String host = url.getHost();

                            boolean isLocal = host != null && (host.equals("localhost") || host.equals("10.0.2.2") || host.equals("127.0.0.1"));
                            if (scheme != null && (scheme.equals("http") || scheme.equals("https")) && !isLocal) {
                                Intent intent = new Intent(Intent.ACTION_VIEW, url);
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(intent);
                                return true; // Keep app running in background without unloading or logging out!
                            }
                        }
                        return super.shouldOverrideUrlLoading(view, request);
                    }
                });
            }
        } catch (Exception ignored) {}
    }
}
