package chatpalez.app.webview;

import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String SITE_ORIGIN = "https://chatpalez.com";
    private LinearLayout nativeTopBar;
    private LinearLayout nativeBottomBar;
    private WebView webView;
    private ViewGroup.MarginLayoutParams webViewMargins;
    private boolean chromeVisible = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
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
        ViewGroup parent = (ViewGroup) webView.getParent();
        if (!(parent instanceof FrameLayout)) return;

        if (webView.getLayoutParams() instanceof ViewGroup.MarginLayoutParams) {
            webViewMargins = (ViewGroup.MarginLayoutParams) webView.getLayoutParams();
        }

        nativeTopBar = buildTopBar();
        nativeBottomBar = buildBottomBar();

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

        parent.addView(nativeTopBar, topParams);
        parent.addView(nativeBottomBar, bottomParams);

        setNativeChromeVisible(false);
        webView.post(chromeStateWatcher);
    }

    private LinearLayout buildTopBar() {
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(14), 0, dp(8), 0);
        bar.setBackgroundColor(Color.WHITE);
        bar.setElevation(dp(6));

        TextView brand = new TextView(this);
        brand.setText("ChatPalez");
        brand.setTextColor(Color.rgb(0, 102, 178));
        brand.setTextSize(18);
        brand.setGravity(Gravity.CENTER_VERTICAL);
        brand.setTypeface(brand.getTypeface(), android.graphics.Typeface.BOLD);
        bar.addView(brand, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f));

        ImageButton search = iconButton(android.R.drawable.ic_menu_search, "Search");
        search.setOnClickListener(v -> loadWebPath("/search"));
        bar.addView(search);

        ImageButton notifications = iconButton(android.R.drawable.ic_dialog_info, "Notifications");
        notifications.setOnClickListener(v -> openNativeScreen("notifications"));
        bar.addView(notifications);

        TextView account = new TextView(this);
        account.setText("Me");
        account.setTextColor(Color.rgb(0, 102, 178));
        account.setTextSize(12);
        account.setGravity(Gravity.CENTER);
        GradientDrawable accountBg = new GradientDrawable();
        accountBg.setShape(GradientDrawable.OVAL);
        accountBg.setColor(Color.rgb(232, 243, 251));
        account.setBackground(accountBg);
        LinearLayout.LayoutParams accountParams = new LinearLayout.LayoutParams(dp(38), dp(38));
        accountParams.setMargins(dp(4), 0, 0, 0);
        account.setOnClickListener(v -> openNativeScreen("profile"));
        bar.addView(account, accountParams);

        return bar;
    }

    private LinearLayout buildBottomBar() {
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER);
        bar.setPadding(dp(4), dp(4), dp(4), dp(4));
        bar.setBackgroundColor(Color.WHITE);
        bar.setElevation(dp(10));

        bar.addView(navItem("Home", android.R.drawable.ic_menu_view, v -> loadWebPath("/")));
        bar.addView(navItem("Reels", android.R.drawable.ic_media_play, v -> loadWebPath("/reels")));
        bar.addView(createNavItem());
        bar.addView(navItem("Chat", android.R.drawable.ic_dialog_email, v -> openNativeScreen("messages")));
        bar.addView(navItem("Profile", android.R.drawable.ic_menu_myplaces, v -> openNativeScreen("profile")));

        return bar;
    }

    private View navItem(String label, int iconRes, View.OnClickListener listener) {
        LinearLayout item = new LinearLayout(this);
        item.setOrientation(LinearLayout.VERTICAL);
        item.setGravity(Gravity.CENTER);
        item.setPadding(dp(2), dp(3), dp(2), dp(2));
        item.setOnClickListener(listener);

        ImageButton icon = iconButton(iconRes, label);
        icon.setClickable(false);
        item.addView(icon, new LinearLayout.LayoutParams(dp(34), dp(32)));

        TextView text = new TextView(this);
        text.setText(label);
        text.setTextColor(Color.rgb(107, 114, 128));
        text.setTextSize(10);
        text.setGravity(Gravity.CENTER);
        item.addView(text, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(20)
        ));

        item.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f));
        return item;
    }

    private View createNavItem() {
        LinearLayout item = new LinearLayout(this);
        item.setOrientation(LinearLayout.VERTICAL);
        item.setGravity(Gravity.CENTER);
        item.setPadding(dp(2), 0, dp(2), dp(2));
        item.setOnClickListener(v -> showCreateSheet());

        TextView plus = new TextView(this);
        plus.setText("+");
        plus.setTextColor(Color.WHITE);
        plus.setTextSize(26);
        plus.setGravity(Gravity.CENTER);
        GradientDrawable circle = new GradientDrawable();
        circle.setShape(GradientDrawable.OVAL);
        circle.setColor(Color.rgb(0, 102, 178));
        plus.setBackground(circle);
        item.addView(plus, new LinearLayout.LayoutParams(dp(44), dp(44)));

        TextView text = new TextView(this);
        text.setText("Create");
        text.setTextColor(Color.rgb(107, 114, 128));
        text.setTextSize(10);
        text.setGravity(Gravity.CENTER);
        item.addView(text, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(18)
        ));

        item.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f));
        return item;
    }

    private ImageButton iconButton(int iconRes, String description) {
        ImageButton button = new ImageButton(this);
        button.setImageResource(iconRes);
        button.setContentDescription(description);
        button.setColorFilter(Color.rgb(31, 41, 55));
        button.setBackgroundColor(Color.TRANSPARENT);
        button.setScaleType(ImageButton.ScaleType.CENTER_INSIDE);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(40), dp(40));
        params.setMargins(dp(1), 0, dp(1), 0);
        button.setLayoutParams(params);
        return button;
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
                ? "setTimeout(function(){var p=document.querySelector('[data-chatpalez-media-picker=\\"photos\\"]');if(p)p.click();},500);"
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

            if (authenticatedSurface && url != null && url.startsWith(SITE_ORIGIN)) {
                webView.evaluateJavascript(
                    "(function(){if(document.body)document.body.classList.add('cp-native-chrome');})();",
                    null
                );
            }

            webView.postDelayed(this, 350);
        }
    };

    private void setNativeChromeVisible(boolean visible) {
        if (nativeTopBar == null || nativeBottomBar == null || webView == null || chromeVisible == visible) {
            return;
        }

        chromeVisible = visible;
        nativeTopBar.setVisibility(visible ? View.VISIBLE : View.GONE);
        nativeBottomBar.setVisibility(visible ? View.VISIBLE : View.GONE);

        if (webViewMargins != null) {
            webViewMargins.topMargin = visible ? dp(56) : 0;
            webViewMargins.bottomMargin = visible ? dp(66) : 0;
            webView.setLayoutParams(webViewMargins);
        }
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

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
