package chatpalez.app.webview;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleChatPalezDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleChatPalezDeepLink(intent);
    }

    private void handleChatPalezDeepLink(Intent intent) {
        if (intent == null || intent.getData() == null || getBridge() == null) {
            return;
        }

        Uri data = intent.getData();
        if (!"chatpalez".equalsIgnoreCase(data.getScheme()) || !"open".equalsIgnoreCase(data.getHost())) {
            return;
        }

        String target = data.getQueryParameter("native");
        if (!isAllowedNativeTarget(target)) {
            return;
        }

        final String localUrl = "http://localhost/?native=" + Uri.encode(target);
        getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(localUrl));
    }

    private boolean isAllowedNativeTarget(String target) {
        return "feed".equals(target)
            || "messages".equals(target)
            || "notifications".equals(target)
            || "profile".equals(target);
    }
}
