package chatpalez.app.webview;

import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.FrameLayout;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String SITE_ORIGIN = "https://chatpalez.com";
    private WebView webView;
    private WebView topChrome;
    private WebView bottomChrome;
    private ViewGroup.MarginLayoutParams webViewMargins;
    private boolean chromeVisible = false;
    private String chromeContext = "";
    private String chromeActive = "";
    private String chromeLogo = "";
    private String chromeAvatar = "";
    private int chromeNotifications = 0;
    private boolean chromeGroupsEnabled = true;
    private boolean chromePagesEnabled = true;
    private boolean chromeShowBack = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.WHITE);
        installNativeChrome();
        handleChatPalezDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleChatPalezDeepLink(intent);
    }

    private void installNativeChrome() {
        if (getBridge() == null || getBridge().getWebView() == null) return;

        webView = getBridge().getWebView();
        webView.addJavascriptInterface(new ChatPalezNativeBridge(), "ChatPalezNative");

        ViewGroup parent = (ViewGroup) webView.getParent();
        if (!(parent instanceof FrameLayout)) return;

        if (webView.getLayoutParams() instanceof ViewGroup.MarginLayoutParams) {
            webViewMargins = (ViewGroup.MarginLayoutParams) webView.getLayoutParams();
        }

        topChrome = buildChromeWebView("top");
        bottomChrome = buildChromeWebView("bottom");

        FrameLayout.LayoutParams topParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            dp(56),
            Gravity.TOP
        );
        FrameLayout.LayoutParams bottomParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            dp(66),
            Gravity.BOTTOM
        );

        parent.addView(topChrome, topParams);
        parent.addView(bottomChrome, bottomParams);

        setNativeChromeVisible(false);
        webView.post(chromeStateWatcher);
    }

    private WebView buildChromeWebView(String part) {
        WebView chrome = new WebView(this);
        chrome.setBackgroundColor(Color.WHITE);
        chrome.setVerticalScrollBarEnabled(false);
        chrome.setHorizontalScrollBarEnabled(false);
        chrome.getSettings().setJavaScriptEnabled(true);
        chrome.getSettings().setDomStorageEnabled(false);
        chrome.addJavascriptInterface(new ChromeActionBridge(), "ChatPalezChromeAction");
        chrome.loadUrl("file:///android_asset/public/native-chrome.html?part=" + Uri.encode(part));
        chrome.postDelayed(this::pushCachedChromeState, 250);
        return chrome;
    }

    private void performChromeAction(String action) {
        if (action == null) return;
        switch (action) {
            case "home":
                loadWebPath("/");
                break;
            case "reels":
                loadWebPath("/reels");
                break;
            case "create":
                showCreateSheet();
                break;
            case "messages":
                openNativeScreen("messages");
                break;
            case "profile":
                openNativeScreen("profile");
                break;
            case "notifications":
                openNativeScreen("notifications");
                break;
            case "search":
                loadWebPath("/search");
                break;
            case "groups":
                loadWebPath("/groups");
                break;
            case "pages":
                loadWebPath("/pages");
                break;
            case "back":
                if (webView != null && webView.canGoBack()) webView.goBack();
                else loadWebPath("/");
                break;
            default:
                break;
        }
    }

    private void showCreateSheet() {
        final String[] actions = {
            "Create post",
            "Upload photos",
            "Create story",
            "Create reel"
        };

        new AlertDialog.Builder(this)
            .setTitle("Create")
            .setItems(actions, (dialog, which) -> {
                switch (which) {
                    case 0:
                        openPublisher(false);
                        break;
                    case 1:
                        openPublisher(true);
                        break;
                    case 2:
                        executeRemoteJavascript(
                            "(function(){var x=document.createElement('div');" +
                            "x.setAttribute('data-toggle','modal');" +
                            "x.setAttribute('data-url','posts/story.php?do=create');" +
                            "document.body.appendChild(x);x.click();setTimeout(function(){x.remove();},0);})();"
                        );
                        break;
                    case 3:
                        openPublisher(false);
                        break;
                    default:
                        break;
                }
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void openPublisher(boolean photos) {
        String script =
            "(function(){var x=document.createElement('div');" +
            "x.setAttribute('data-toggle','modal');" +
            "x.setAttribute('data-static','true');" +
            "x.setAttribute('data-url','posts/publisher.php');" +
            "document.body.appendChild(x);x.click();" +
            (photos
                ? "setTimeout(function(){var p=document.querySelector('[data-chatpalez-media-picker=photos]');if(p)p.click();},500);"
                : "") +
            "setTimeout(function(){x.remove();},0);})();";
        executeRemoteJavascript(script);
    }

    private void executeRemoteJavascript(String script) {
        if (webView == null) return;
        String current = webView.getUrl();
        if (current != null && current.startsWith(SITE_ORIGIN)) {
            webView.evaluateJavascript(script, null);
            return;
        }
        loadWebPath("/?publisher=open");
    }

    private void loadWebPath(String path) {
        if (webView == null) return;
        webView.loadUrl(SITE_ORIGIN + path);
    }

    private void openNativeScreen(String target) {
        if (webView == null || !isAllowedNativeTarget(target)) return;
        if ("messages".equals(target)) {
            chromeActive = "messages";
            chromeContext = "Chat";
        } else if ("profile".equals(target)) {
            chromeActive = "profile";
            chromeContext = "Profile";
        } else if ("notifications".equals(target)) {
            chromeActive = "";
            chromeContext = "Notifications";
        }
        chromeShowBack = false;
        pushCachedChromeState();
        webView.loadUrl("http://localhost/?native=" + Uri.encode(target));
    }

    private final Runnable chromeStateWatcher = new Runnable() {
        @Override
        public void run() {
            if (webView == null) return;
            String url = webView.getUrl();
            boolean authenticatedSurface = false;
            if (url != null) {
                authenticatedSurface = url.startsWith(SITE_ORIGIN)
                    || url.contains("?native=messages")
                    || url.contains("?native=notifications")
                    || url.contains("?native=profile");
            }

            setNativeChromeVisible(authenticatedSurface);
            webView.postDelayed(this, 350);
        }
    };

    private void setNativeChromeVisible(boolean visible) {
        if (topChrome == null || bottomChrome == null || webView == null || chromeVisible == visible) return;

        chromeVisible = visible;
        topChrome.setVisibility(visible ? WebView.VISIBLE : WebView.GONE);
        bottomChrome.setVisibility(visible ? WebView.VISIBLE : WebView.GONE);

        if (webViewMargins != null) {
            webViewMargins.topMargin = visible ? dp(56) : 0;
            webViewMargins.bottomMargin = visible ? dp(66) : 0;
            webView.setLayoutParams(webViewMargins);
        }
    }

    private void pushChromeState(
        String context,
        String active,
        String logo,
        String avatar,
        int notifications,
        boolean groupsEnabled,
        boolean pagesEnabled,
        boolean showBack
    ) {
        chromeContext = context == null ? "" : context;
        chromeActive = active == null ? "" : active;
        chromeLogo = logo == null ? "" : logo;
        chromeAvatar = avatar == null ? "" : avatar;
        chromeNotifications = notifications;
        chromeGroupsEnabled = groupsEnabled;
        chromePagesEnabled = pagesEnabled;
        chromeShowBack = showBack;
        pushCachedChromeState();
    }

    private void pushCachedChromeState() {
        String json = "{"
            + "\"context\":\"" + js(chromeContext) + "\","
            + "\"active\":\"" + js(chromeActive) + "\","
            + "\"logo\":\"" + js(chromeLogo) + "\","
            + "\"avatar\":\"" + js(chromeAvatar) + "\","
            + "\"notifications\":" + chromeNotifications + ","
            + "\"groupsEnabled\":" + chromeGroupsEnabled + ","
            + "\"pagesEnabled\":" + chromePagesEnabled + ","
            + "\"showBack\":" + chromeShowBack
            + "}";

        String call = "window.ChatPalezChrome&&window.ChatPalezChrome.setState(" + quoteJs(json) + ");";
        if (topChrome != null) topChrome.post(() -> topChrome.evaluateJavascript(call, null));
        if (bottomChrome != null) bottomChrome.post(() -> bottomChrome.evaluateJavascript(call, null));
    }

    private String js(String value) {
        if (value == null) return "";
        return value
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "");
    }

    private String quoteJs(String value) {
        return "\"" + js(value) + "\"";
    }

    private void handleChatPalezDeepLink(Intent intent) {
        if (intent == null || intent.getData() == null || getBridge() == null) return;

        Uri data = intent.getData();
        if (!"chatpalez".equalsIgnoreCase(data.getScheme()) || !"open".equalsIgnoreCase(data.getHost())) return;

        String target = data.getQueryParameter("native");
        if (!isAllowedNativeTarget(target)) return;

        final String localUrl = "http://localhost/?native=" + Uri.encode(target);
        getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(localUrl));
    }

    private boolean isAllowedNativeTarget(String target) {
        return "feed".equals(target)
            || "messages".equals(target)
            || "notifications".equals(target)
            || "profile".equals(target);
    }

    private class ChromeActionBridge {
        @JavascriptInterface
        public void perform(String action) {
            runOnUiThread(() -> performChromeAction(action));
        }
    }

    private class ChatPalezNativeBridge {
        @JavascriptInterface
        public void share(String title, String url) {
            runOnUiThread(() -> {
                Intent sendIntent = new Intent(Intent.ACTION_SEND);
                sendIntent.setType("text/plain");
                String safeTitle = title == null || title.trim().isEmpty() ? "Share post" : title;
                String safeUrl = url == null ? "" : url;
                sendIntent.putExtra(Intent.EXTRA_SUBJECT, safeTitle);
                sendIntent.putExtra(Intent.EXTRA_TEXT, safeUrl);
                startActivity(Intent.createChooser(sendIntent, safeTitle));
            });
        }

        @JavascriptInterface
        public void openNative(String target) {
            runOnUiThread(() -> openNativeScreen(target));
        }

        @JavascriptInterface
        public void setChromeState(
            String context,
            String active,
            String logo,
            String avatar,
            int notifications,
            boolean groupsEnabled,
            boolean pagesEnabled,
            boolean showBack
        ) {
            runOnUiThread(() -> pushChromeState(
                context,
                active,
                logo,
                avatar,
                notifications,
                groupsEnabled,
                pagesEnabled,
                showBack
            ));
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
