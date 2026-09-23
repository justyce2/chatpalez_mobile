package chatpalez.app.webview;

import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "WebContentSurface")
public class WebContentSurfacePlugin extends Plugin {
    private WebView contentWebView;

    @Override
    public void load() {
        getActivity().runOnUiThread(this::ensureWebView);
    }

    private void ensureWebView() {
        if (contentWebView != null) return;

        ViewGroup host = getActivity().findViewById(android.R.id.content);
        if (host == null) return;

        contentWebView = new WebView(getContext());
        contentWebView.setBackgroundColor(Color.WHITE);
        contentWebView.setVisibility(View.GONE);

        WebSettings settings = contentWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(contentWebView, true);

        contentWebView.setWebViewClient(new WebViewClient());
        host.addView(contentWebView, new FrameLayout.LayoutParams(1, 1));
        contentWebView.bringToFront();
    }

    @PluginMethod
    public void open(PluginCall call) {
        String action = call.getString("action");
        String token = call.getString("token");
        String path = call.getString("path");
        if (action == null || token == null || path == null) {
            call.reject("Missing authenticated web transition.");
            return;
        }

        Uri actionUri = Uri.parse(action);
        if (!"https".equalsIgnoreCase(actionUri.getScheme())) {
            call.reject("ChatPalez web content requires HTTPS.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            ensureWebView();
            if (contentWebView == null) {
                call.reject("Unable to create ChatPalez web content surface.");
                return;
            }

            applyFrame(call);
            String body = "token=" + encode(token) + "&path=" + encode(path);
            contentWebView.setVisibility(View.VISIBLE);
            contentWebView.bringToFront();
            contentWebView.postUrl(action, body.getBytes(StandardCharsets.UTF_8));
            call.resolve();
        });
    }

    @PluginMethod
    public void show(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            ensureWebView();
            if (contentWebView != null) {
                contentWebView.setVisibility(View.VISIBLE);
                contentWebView.bringToFront();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void hide(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (contentWebView != null) contentWebView.setVisibility(View.GONE);
            call.resolve();
        });
    }

    @PluginMethod
    public void setFrame(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            ensureWebView();
            if (contentWebView == null) {
                call.reject("Unable to create ChatPalez web content surface.");
                return;
            }
            applyFrame(call);
            call.resolve();
        });
    }

    @PluginMethod
    public void canGoBack(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            JSObject result = new JSObject();
            result.put("value", contentWebView != null && contentWebView.canGoBack());
            call.resolve(result);
        });
    }

    @PluginMethod
    public void goBack(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (contentWebView != null && contentWebView.canGoBack()) contentWebView.goBack();
            call.resolve();
        });
    }

    @PluginMethod
    public void reload(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (contentWebView != null) contentWebView.reload();
            call.resolve();
        });
    }

    private void applyFrame(PluginCall call) {
        float density = getContext().getResources().getDisplayMetrics().density;
        int x = Math.round(call.getFloat("x", 0f) * density);
        int y = Math.round(call.getFloat("y", 0f) * density);
        int width = Math.max(1, Math.round(call.getFloat("width", 1f) * density));
        int height = Math.max(1, Math.round(call.getFloat("height", 1f) * density));

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(width, height);
        params.leftMargin = x;
        params.topMargin = y;
        contentWebView.setLayoutParams(params);
    }

    private static String encode(String value) {
        try {
            return URLEncoder.encode(value, StandardCharsets.UTF_8.name());
        } catch (Exception error) {
            throw new IllegalStateException("Unable to encode authenticated web transition.", error);
        }
    }
}
