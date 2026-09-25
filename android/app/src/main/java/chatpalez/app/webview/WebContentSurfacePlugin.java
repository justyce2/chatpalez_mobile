package chatpalez.app.webview;

import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebResourceResponse;
import android.content.Intent;
import android.widget.FrameLayout;
import android.app.Dialog;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.Window;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.ProgressBar;
import android.widget.Button;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.AbsoluteSizeSpan;
import android.text.style.ForegroundColorSpan;
import android.text.style.StyleSpan;

import com.getcapacitor.JSObject;
import org.json.JSONObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "WebContentSurface")
public class WebContentSurfacePlugin extends Plugin {
    private WebView contentWebView;
    private FrameLayout feedLoadingView;
    private boolean feedLoading;
    private int feedLoadGeneration;
    private boolean chatSoundEnabled = true;
    private boolean surfaceVisible;
    private String allowedOrigin;

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
        // This secondary WebView does not inherit Capacitor's appendUserAgent.
        // Keep the backend's existing first-party mobile-session guard intact
        // by applying the same app marker used by the primary Capacitor WebView.
        String userAgent = settings.getUserAgentString();
        if (userAgent == null) userAgent = "";
        if (!userAgent.contains("ChatPalezMobile/1.0")) {
            settings.setUserAgentString(userAgent + " ChatPalezMobile/1.0");
        }
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(contentWebView, true);

        contentWebView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void postMessage(String raw) {
                getActivity().runOnUiThread(() -> emitCommand(raw));
            }
        }, "ChatPalezNativeSurface");

        contentWebView.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) finishFeedLoading();
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame()) finishFeedLoading();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isAllowed(uri)) return false;
                if ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())) {
                    try {
                        getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {
                    }
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                JSObject data = new JSObject();
                data.put("url", url);
                notifyListeners("loadStarted", data);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                emitRouteChanged(url);
                Uri uri = Uri.parse(url);
                if (isAllowed(uri)) {
                    if (!"/mobile-session.php".equals(uri.getPath())) finishFeedLoading();
                    syncChatSound();
                    JSObject data = new JSObject();
                    data.put("url", url);
                    notifyListeners("loadFinished", data);
                }
            }
        });
        host.addView(contentWebView, new FrameLayout.LayoutParams(1, 1));
        contentWebView.bringToFront();

        feedLoadingView = new FrameLayout(getContext());
        feedLoadingView.setBackgroundColor(Color.WHITE);
        feedLoadingView.setVisibility(View.GONE);
        LinearLayout loadingContent = new LinearLayout(getContext());
        loadingContent.setOrientation(LinearLayout.VERTICAL);
        loadingContent.setGravity(Gravity.CENTER);
        int spacing = Math.round(16 * getContext().getResources().getDisplayMetrics().density);
        ProgressBar progress = new ProgressBar(getContext());
        loadingContent.addView(progress);
        TextView label = new TextView(getContext());
        label.setText("Loading your feed…");
        label.setTextColor(Color.rgb(18, 50, 77));
        label.setTextSize(16);
        LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        labelParams.topMargin = spacing;
        loadingContent.addView(label, labelParams);
        feedLoadingView.addView(loadingContent, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER));
        host.addView(feedLoadingView, new FrameLayout.LayoutParams(1, 1));
    }

    @PluginMethod
    public void open(PluginCall call) {
        String action = call.getString("action");
        String token = call.getString("token");
        String path = call.getString("path");
        String requestedOrigin = call.getString("allowedOrigin");
        if (action == null || token == null || path == null || requestedOrigin == null) {
            call.reject("Missing authenticated web transition.");
            return;
        }

        Uri actionUri = Uri.parse(action);
        Uri originUri = Uri.parse(requestedOrigin);
        if (!"https".equalsIgnoreCase(actionUri.getScheme()) || !"https".equalsIgnoreCase(originUri.getScheme())
                || actionUri.getHost() == null || !actionUri.getHost().equalsIgnoreCase(originUri.getHost())) {
            call.reject("ChatPalez web content requires HTTPS.");
            return;
        }

        getActivity().runOnUiThread(() -> {
            ensureWebView();
            if (contentWebView == null) {
                call.reject("Unable to create ChatPalez web content surface.");
                return;
            }

            allowedOrigin = requestedOrigin;
            applyFrame(call);
            final int generation = ++feedLoadGeneration;
            feedLoading = "/".equals(path);
            feedLoadingView.setVisibility(feedLoading ? View.VISIBLE : View.GONE);
            String body = "token=" + encode(token) + "&path=" + encode(path);
            contentWebView.setVisibility(View.VISIBLE);
            surfaceVisible = true;
            contentWebView.bringToFront();
            if (feedLoading) feedLoadingView.bringToFront();
            contentWebView.postUrl(action, body.getBytes(StandardCharsets.UTF_8));
            if (feedLoading) contentWebView.postDelayed(() -> {
                if (feedLoadGeneration == generation) finishFeedLoading();
            }, 15000);
            call.resolve();
        });
    }

    @PluginMethod
    public void show(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            ensureWebView();
            if (contentWebView != null) {
                contentWebView.setVisibility(View.VISIBLE);
                surfaceVisible = true;
                syncChatSound();
                contentWebView.bringToFront();
                if (feedLoading) {
                    feedLoadingView.setVisibility(View.VISIBLE);
                    feedLoadingView.bringToFront();
                }
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void hide(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (contentWebView != null) contentWebView.setVisibility(View.GONE);
            surfaceVisible = false;
            syncChatSound();
            if (feedLoadingView != null) feedLoadingView.setVisibility(View.GONE);
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
    public void showCreateActions(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            final Dialog dialog = new Dialog(getActivity());
            dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

            LinearLayout panel = new LinearLayout(getActivity());
            panel.setOrientation(LinearLayout.VERTICAL);
            int side = dp(18);
            panel.setPadding(side, dp(12), side, dp(16));

            GradientDrawable background = new GradientDrawable();
            background.setColor(Color.WHITE);
            background.setCornerRadii(new float[] { dp(24), dp(24), dp(24), dp(24), 0, 0, 0, 0 });
            panel.setBackground(background);

            TextView handle = new TextView(getActivity());
            GradientDrawable handleBackground = new GradientDrawable();
            handleBackground.setColor(Color.rgb(203, 213, 225));
            handleBackground.setCornerRadius(dp(3));
            handle.setBackground(handleBackground);
            LinearLayout.LayoutParams handleParams = new LinearLayout.LayoutParams(dp(42), dp(4));
            handleParams.gravity = Gravity.CENTER_HORIZONTAL;
            handleParams.bottomMargin = dp(12);
            panel.addView(handle, handleParams);

            TextView title = new TextView(getActivity());
            title.setText("Create");
            title.setTextSize(20);
            title.setTextColor(Color.rgb(17, 24, 39));
            title.setGravity(Gravity.CENTER);
            title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);
            LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(-1, -2);
            titleParams.bottomMargin = dp(10);
            panel.addView(title, titleParams);

            final String[] labels = { "Create post", "Upload photos", "Create story", "Create reel" };
            final String[] subtitles = { "Share an update with your community", "Choose photos from your device", "Post a moment to your story", "Create a short-form video" };
            final String[] actions = { "post", "photos", "story", "reel" };
            for (int i = 0; i < labels.length; i++) {
                final int index = i;
                Button action = new Button(getActivity());
                action.setAllCaps(false);
                String combined = labels[i] + "\n" + subtitles[i];
                SpannableString styledText = new SpannableString(combined);
                int labelEnd = labels[i].length();
                styledText.setSpan(new StyleSpan(android.graphics.Typeface.BOLD), 0, labelEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                styledText.setSpan(new AbsoluteSizeSpan(16, true), 0, labelEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                styledText.setSpan(new ForegroundColorSpan(Color.rgb(31, 41, 55)), 0, labelEnd, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                styledText.setSpan(new AbsoluteSizeSpan(12, true), labelEnd + 1, combined.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                styledText.setSpan(new ForegroundColorSpan(Color.rgb(107, 114, 128)), labelEnd + 1, combined.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                action.setText(styledText);
                action.setTextColor(Color.rgb(31, 41, 55));
                action.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
                action.setPadding(dp(16), dp(8), dp(16), dp(8));
                GradientDrawable actionBg = new GradientDrawable();
                actionBg.setColor(Color.rgb(247, 250, 252));
                actionBg.setCornerRadius(dp(14));
                action.setBackground(actionBg);
                LinearLayout.LayoutParams actionParams = new LinearLayout.LayoutParams(-1, dp(62));
                actionParams.bottomMargin = dp(8);
                panel.addView(action, actionParams);
                action.setOnClickListener(v -> {
                    JSObject result = new JSObject();
                    result.put("action", actions[index]);
                    call.resolve(result);
                    dialog.dismiss();
                });
            }

            Button cancel = new Button(getActivity());
            cancel.setAllCaps(false);
            cancel.setText("Cancel");
            cancel.setTextSize(16);
            cancel.setTextColor(Color.rgb(0, 102, 178));
            GradientDrawable cancelBg = new GradientDrawable();
            cancelBg.setColor(Color.rgb(232, 243, 251));
            cancelBg.setCornerRadius(dp(14));
            cancel.setBackground(cancelBg);
            panel.addView(cancel, new LinearLayout.LayoutParams(-1, dp(50)));
            cancel.setOnClickListener(v -> {
                JSObject result = new JSObject();
                result.put("action", JSONObject.NULL);
                call.resolve(result);
                dialog.dismiss();
            });
            dialog.setOnCancelListener(ignored -> {
                JSObject result = new JSObject();
                result.put("action", JSONObject.NULL);
                call.resolve(result);
            });

            dialog.setContentView(panel);
            Window window = dialog.getWindow();
            if (window != null) {
                window.setBackgroundDrawableResource(android.R.color.transparent);
                window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                window.setGravity(Gravity.BOTTOM);
                window.setDimAmount(0.34f);
                window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            }
            dialog.show();
            if (window != null) window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        });
    }

    private int dp(int value) {
        return Math.round(value * getContext().getResources().getDisplayMetrics().density);
    }

    @PluginMethod
    public void postMessage(PluginCall call) {
        JSObject message = call.getObject("message");
        if (message == null) {
            call.reject("Missing web surface message.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (contentWebView == null) {
                call.reject("ChatPalez web content surface is not open.");
                return;
            }
            String json = JSONObject.quote(message.toString());
            contentWebView.evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('chatpalez:native-surface-message',{detail:JSON.parse(" + json + ")}));",
                    null
            );
            call.resolve();
        });
    }

    @PluginMethod
    public void setChatSoundEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            call.reject("Missing chat sound preference.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            chatSoundEnabled = enabled;
            syncChatSound();
            call.resolve();
        });
    }

    @PluginMethod
    public void resetSession(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (contentWebView != null) {
                contentWebView.stopLoading();
                contentWebView.loadUrl("about:blank");
                contentWebView.clearHistory();
                contentWebView.clearCache(false);
                contentWebView.setVisibility(View.GONE);
            }
            finishFeedLoading();
            ++feedLoadGeneration;
            surfaceVisible = false;
            CookieManager cookies = CookieManager.getInstance();
            cookies.removeAllCookies(value -> cookies.flush());
            allowedOrigin = null;
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
        if (feedLoadingView != null) {
            FrameLayout.LayoutParams loadingParams = new FrameLayout.LayoutParams(width, height);
            loadingParams.leftMargin = x;
            loadingParams.topMargin = y;
            feedLoadingView.setLayoutParams(loadingParams);
        }
    }

    private void finishFeedLoading() {
        feedLoading = false;
        if (feedLoadingView != null) feedLoadingView.setVisibility(View.GONE);
    }

    private void syncChatSound() {
        if (contentWebView == null || allowedOrigin == null) return;
        contentWebView.evaluateJavascript(
                "if (typeof window.__chatpalezBaseChatSound === 'undefined') " +
                "window.__chatpalezBaseChatSound = !!window.chat_sound; " +
                "window.chat_sound = window.__chatpalezBaseChatSound && " +
                (surfaceVisible && chatSoundEnabled ? "true" : "false") + ";", null);
    }



    private void emitCommand(String raw) {
        try {
            JSObject data = JSObject.fromJSONObject(new JSONObject(raw));
            String type = data.getString("type");
            if (!"share".equals(type) && !"pick-media".equals(type)
                    && !"open-native".equals(type) && !"open-external".equals(type)) return;
            notifyListeners("command", data);
        } catch (Exception ignored) {
        }
    }

    private boolean isAllowed(Uri uri) {
        if (uri == null || allowedOrigin == null) return false;
        Uri trusted = Uri.parse(allowedOrigin);
        return "https".equalsIgnoreCase(uri.getScheme())
                && trusted.getHost() != null
                && trusted.getHost().equalsIgnoreCase(uri.getHost());
    }

    private void emitRouteChanged(String url) {
        Uri uri = Uri.parse(url);
        if (!isAllowed(uri)) return;
        JSObject data = new JSObject();
        data.put("url", url);
        notifyListeners("routeChanged", data);
    }

    private static String encode(String value) {
        try {
            return URLEncoder.encode(value, StandardCharsets.UTF_8.name());
        } catch (Exception error) {
            throw new IllegalStateException("Unable to encode authenticated web transition.", error);
        }
    }
}
