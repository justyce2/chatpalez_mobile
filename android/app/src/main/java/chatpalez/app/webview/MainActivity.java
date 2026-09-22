package chatpalez.app.webview;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends BridgeActivity {

    private static final String SITE_ORIGIN = "https://chatpalez.com";
    private static final int COLOR_BLUE = Color.rgb(0, 102, 178);
    private static final int COLOR_TEXT = Color.rgb(31, 41, 55);
    private static final int COLOR_MUTED = Color.rgb(107, 114, 128);
    private static final int COLOR_BORDER = Color.rgb(229, 231, 235);
    private static final int COLOR_AVATAR_BG = Color.rgb(232, 243, 251);
    private static final int REQUEST_PICK_MEDIA = 8120;
    private static final int REQUEST_TAKE_PHOTO = 8121;

    private WebView webView;
    private LinearLayout topChrome;
    private LinearLayout bottomChrome;
    private ViewGroup.MarginLayoutParams webViewMargins;
    private int baseWebViewTopMargin = 0;
    private int baseWebViewBottomMargin = 0;

    private LinearLayout brandButton;
    private ImageView brandLogo;
    private TextView brandText;
    private TextView backButton;
    private TextView contextText;
    private ImageView groupsButton;
    private ImageView pagesButton;
    private ImageView avatarButton;
    private TextView notificationBadge;

    private final Map<String, BottomItem> bottomItems = new HashMap<>();

    private boolean chromeVisible = false;
    private String chromeContext = "";
    private String chromeActive = "";
    private String chromeLogo = "";
    private String chromeAvatar = "";
    private int chromeNotifications = 0;
    private String pendingMediaRequestId = "";
    private Uri pendingCameraUri = null;
    private boolean chromeGroupsEnabled = true;
    private boolean chromePagesEnabled = true;
    private boolean chromeShowBack = false;
    private String loadedLogoUrl = "";
    private String loadedAvatarUrl = "";

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

        ViewGroup webViewParent = (ViewGroup) webView.getParent();
        ViewGroup overlayHost = findViewById(android.R.id.content);
        if (webViewParent == null || overlayHost == null) return;

        if (webView.getLayoutParams() instanceof ViewGroup.MarginLayoutParams) {
            webViewMargins = (ViewGroup.MarginLayoutParams) webView.getLayoutParams();
            baseWebViewTopMargin = webViewMargins.topMargin;
            baseWebViewBottomMargin = webViewMargins.bottomMargin;
        }

        topChrome = buildNativeTopChrome();
        bottomChrome = buildNativeBottomChrome();

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

        overlayHost.addView(topChrome, topParams);
        overlayHost.addView(bottomChrome, bottomParams);
        topChrome.bringToFront();
        bottomChrome.bringToFront();

        setNativeChromeVisible(false);
        pushCachedChromeState();
        webView.post(chromeStateWatcher);
    }

    private LinearLayout buildNativeTopChrome() {
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(10), 0, dp(8), 0);
        bar.setBackgroundColor(Color.WHITE);
        bar.setElevation(dp(4));

        brandButton = new LinearLayout(this);
        brandButton.setOrientation(LinearLayout.HORIZONTAL);
        brandButton.setGravity(Gravity.CENTER_VERTICAL);
        brandButton.setPadding(dp(4), 0, dp(4), 0);
        brandButton.setClickable(true);
        brandButton.setFocusable(true);
        brandButton.setOnClickListener(view -> performChromeAction("home"));

        brandLogo = new ImageView(this);
        brandLogo.setAdjustViewBounds(true);
        brandLogo.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        brandLogo.setVisibility(View.GONE);
        brandButton.addView(brandLogo, new LinearLayout.LayoutParams(dp(104), dp(34)));

        brandText = new TextView(this);
        brandText.setText("ChatPalez");
        brandText.setTextColor(COLOR_BLUE);
        brandText.setTextSize(18);
        brandText.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        brandButton.addView(brandText, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        backButton = new TextView(this);
        backButton.setText("‹");
        backButton.setTextColor(COLOR_TEXT);
        backButton.setTextSize(32);
        backButton.setGravity(Gravity.CENTER);
        backButton.setContentDescription("Back");
        backButton.setClickable(true);
        backButton.setFocusable(true);
        backButton.setOnClickListener(view -> performChromeAction("back"));

        contextText = new TextView(this);
        contextText.setTextColor(COLOR_TEXT);
        contextText.setTextSize(14);
        contextText.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        contextText.setGravity(Gravity.CENTER);
        contextText.setSingleLine(true);
        contextText.setPadding(dp(3), 0, dp(3), 0);

        bar.addView(brandButton, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        bar.addView(backButton, new LinearLayout.LayoutParams(dp(40), ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout.LayoutParams contextParams = new LinearLayout.LayoutParams(
            0,
            ViewGroup.LayoutParams.MATCH_PARENT,
            1f
        );
        bar.addView(contextText, contextParams);

        bar.addView(nativeIconButton(R.drawable.cp_search, "search", "Search"), iconParams());

        groupsButton = nativeIconButton(R.drawable.cp_groups, "groups", "Groups");
        bar.addView(groupsButton, iconParams());

        pagesButton = nativeIconButton(R.drawable.cp_pages, "pages", "Pages");
        bar.addView(pagesButton, iconParams());

        FrameLayout notificationFrame = new FrameLayout(this);
        ImageView notificationButton = nativeIconButton(
            R.drawable.cp_notifications,
            "notifications",
            "Notifications"
        );
        notificationFrame.addView(notificationButton, new FrameLayout.LayoutParams(dp(38), dp(38), Gravity.CENTER));

        notificationBadge = new TextView(this);
        notificationBadge.setTextColor(Color.WHITE);
        notificationBadge.setTextSize(9);
        notificationBadge.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        notificationBadge.setGravity(Gravity.CENTER);
        notificationBadge.setMinWidth(dp(17));
        notificationBadge.setPadding(dp(3), 0, dp(3), 0);
        notificationBadge.setBackground(circleDrawable(Color.rgb(239, 68, 68)));
        notificationBadge.setVisibility(View.GONE);
        FrameLayout.LayoutParams badgeParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            dp(17),
            Gravity.TOP | Gravity.END
        );
        badgeParams.topMargin = dp(1);
        badgeParams.rightMargin = dp(1);
        notificationFrame.addView(notificationBadge, badgeParams);
        bar.addView(notificationFrame, iconParams());

        avatarButton = new ImageView(this);
        avatarButton.setImageResource(R.drawable.cp_profile);
        avatarButton.setColorFilter(COLOR_BLUE);
        avatarButton.setScaleType(ImageView.ScaleType.CENTER_CROP);
        avatarButton.setPadding(dp(8), dp(8), dp(8), dp(8));
        avatarButton.setBackground(circleDrawable(COLOR_AVATAR_BG));
        avatarButton.setClipToOutline(true);
        avatarButton.setOutlineProvider(ViewOutlineProvider.BACKGROUND);
        avatarButton.setContentDescription("Profile");
        avatarButton.setClickable(true);
        avatarButton.setFocusable(true);
        avatarButton.setOnClickListener(view -> performChromeAction("profile"));
        LinearLayout.LayoutParams avatarParams = new LinearLayout.LayoutParams(dp(38), dp(38));
        avatarParams.leftMargin = dp(2);
        bar.addView(avatarButton, avatarParams);

        return bar;
    }

    private LinearLayout buildNativeBottomChrome() {
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER);
        bar.setPadding(dp(4), dp(4), dp(4), dp(5));
        bar.setBackgroundColor(Color.WHITE);
        bar.setElevation(dp(8));

        addBottomItem(bar, "home", "Home", R.drawable.cp_home, false);
        addBottomItem(bar, "reels", "Reels", R.drawable.cp_reels, false);
        addBottomItem(bar, "create", "Create", R.drawable.cp_plus, true);
        addBottomItem(bar, "messages", "Chat", R.drawable.cp_chat, false);
        addBottomItem(bar, "profile", "Profile", R.drawable.cp_profile, false);

        return bar;
    }

    private ImageView nativeIconButton(int drawable, String action, String contentDescription) {
        ImageView button = new ImageView(this);
        button.setImageResource(drawable);
        button.setColorFilter(COLOR_TEXT);
        button.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
        button.setPadding(dp(8), dp(8), dp(8), dp(8));
        button.setContentDescription(contentDescription);
        button.setClickable(true);
        button.setFocusable(true);
        button.setOnClickListener(view -> performChromeAction(action));
        return button;
    }

    private LinearLayout.LayoutParams iconParams() {
        return new LinearLayout.LayoutParams(dp(38), dp(38));
    }

    private void addBottomItem(
        LinearLayout bar,
        String action,
        String label,
        int drawable,
        boolean createAction
    ) {
        LinearLayout item = new LinearLayout(this);
        item.setOrientation(LinearLayout.VERTICAL);
        item.setGravity(Gravity.CENTER);
        item.setClickable(true);
        item.setFocusable(true);
        item.setContentDescription(label);
        item.setOnClickListener(view -> performChromeAction(action));

        ImageView icon = new ImageView(this);
        icon.setImageResource(drawable);
        icon.setScaleType(ImageView.ScaleType.CENTER_INSIDE);

        LinearLayout.LayoutParams iconLayout;
        if (createAction) {
            icon.setColorFilter(Color.WHITE);
            icon.setPadding(dp(10), dp(10), dp(10), dp(10));
            icon.setBackground(circleDrawable(COLOR_BLUE));
            iconLayout = new LinearLayout.LayoutParams(dp(44), dp(44));
        } else {
            icon.setColorFilter(COLOR_MUTED);
            icon.setPadding(dp(3), dp(3), dp(3), dp(3));
            iconLayout = new LinearLayout.LayoutParams(dp(27), dp(27));
        }
        item.addView(icon, iconLayout);

        TextView text = new TextView(this);
        text.setText(label);
        text.setTextColor(COLOR_MUTED);
        text.setTextSize(10);
        text.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        text.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams textLayout = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        if (createAction) textLayout.topMargin = -dp(2);
        item.addView(text, textLayout);

        LinearLayout.LayoutParams itemLayout = new LinearLayout.LayoutParams(
            0,
            ViewGroup.LayoutParams.MATCH_PARENT,
            1f
        );
        bar.addView(item, itemLayout);
        bottomItems.put(action, new BottomItem(item, icon, text, createAction));
    }

    private GradientDrawable circleDrawable(int color) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.OVAL);
        drawable.setColor(color);
        return drawable;
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

    private void showSharePostSheet(String title, String url, String repostUrl, boolean repostDisabled) {
        String safeTitle = title == null || title.trim().isEmpty() ? "Share post" : title;
        String safeUrl = url == null ? "" : url;
        String safeRepostUrl = repostUrl == null ? "" : repostUrl;

        if (!repostDisabled && !safeRepostUrl.isEmpty()) {
            final String[] actions = { "Repost in ChatPalez", "Share to other apps" };
            new AlertDialog.Builder(this)
                .setTitle("Share post")
                .setItems(actions, (dialog, which) -> {
                    if (which == 0) {
                        executeRemoteJavascript(
                            "(function(){var x=document.createElement('div');" +
                            "x.setAttribute('data-toggle','modal');" +
                            "x.setAttribute('data-url'," + quoteJs(safeRepostUrl) + ");" +
                            "x.style.display='none';document.body.appendChild(x);x.click();" +
                            "setTimeout(function(){x.remove();},0);})();"
                        );
                    } else {
                        shareExternally(safeTitle, safeUrl);
                    }
                })
                .setNegativeButton("Cancel", null)
                .show();
            return;
        }

        shareExternally(safeTitle, safeUrl);
    }

    private void shareExternally(String title, String url) {
        Intent sendIntent = new Intent(Intent.ACTION_SEND);
        sendIntent.setType("text/plain");
        sendIntent.putExtra(Intent.EXTRA_SUBJECT, title);
        sendIntent.putExtra(Intent.EXTRA_TEXT, url);
        startActivity(Intent.createChooser(sendIntent, title));
    }

    private String quoteJs(String value) {
        return JSONObject.quote(value == null ? "" : value);
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
        String safePath = (path == null || path.trim().isEmpty()) ? "/" : path;
        webView.loadUrl(SITE_ORIGIN + safePath);
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
        // Use the same local Capacitor route that powered the known-good
        // API-driven Profile/Chat workflow. Do not derive this transition from
        // the currently loaded retained-web origin.
        webView.loadUrl("http://localhost/?native=" + Uri.encode(target));
    }

    private final Runnable chromeStateWatcher = new Runnable() {
        @Override
        public void run() {
            if (webView == null) return;
            String url = webView.getUrl();
            boolean authenticatedSurface = false;
            if (url != null) {
                authenticatedSurface = isChatPalezWebUrl(url)
                    || url.contains("?native=messages")
                    || url.contains("?native=notifications")
                    || url.contains("?native=profile");
            }

            setNativeChromeVisible(authenticatedSurface);
            webView.postDelayed(this, 350);
        }
    };

    private boolean isChatPalezWebUrl(String rawUrl) {
        try {
            Uri uri = Uri.parse(rawUrl);
            String host = uri.getHost();
            return "https".equalsIgnoreCase(uri.getScheme())
                && ("chatpalez.com".equalsIgnoreCase(host) || "www.chatpalez.com".equalsIgnoreCase(host));
        } catch (Exception ignored) {
            return false;
        }
    }

    private void setNativeChromeVisible(boolean visible) {
        if (topChrome == null || bottomChrome == null || webView == null) return;

        chromeVisible = visible;
        int visibility = visible ? View.VISIBLE : View.GONE;
        topChrome.setVisibility(visibility);
        bottomChrome.setVisibility(visibility);

        if (webViewMargins != null) {
            webViewMargins.topMargin = baseWebViewTopMargin + (visible ? dp(56) : 0);
            webViewMargins.bottomMargin = baseWebViewBottomMargin + (visible ? dp(66) : 0);
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
        runOnUiThread(() -> {
            if (contextText == null) return;

            contextText.setText(chromeContext);
            brandButton.setVisibility(chromeShowBack ? View.GONE : View.VISIBLE);
            backButton.setVisibility(chromeShowBack ? View.VISIBLE : View.GONE);
            groupsButton.setVisibility(chromeGroupsEnabled ? View.VISIBLE : View.GONE);
            pagesButton.setVisibility(chromePagesEnabled ? View.VISIBLE : View.GONE);

            if (chromeNotifications > 0) {
                notificationBadge.setText(chromeNotifications > 99 ? "99+" : String.valueOf(chromeNotifications));
                notificationBadge.setVisibility(View.VISIBLE);
            } else {
                notificationBadge.setVisibility(View.GONE);
            }

            if (chromeLogo.isEmpty()) {
                loadedLogoUrl = "";
                brandLogo.setImageDrawable(null);
                brandLogo.setVisibility(View.GONE);
                brandText.setVisibility(View.VISIBLE);
            } else if (!chromeLogo.equals(loadedLogoUrl)) {
                loadedLogoUrl = chromeLogo;
                loadRemoteImage(chromeLogo, brandLogo, () -> {
                    if (chromeLogo.equals(loadedLogoUrl)) {
                        brandLogo.setVisibility(View.VISIBLE);
                        brandText.setVisibility(View.GONE);
                    }
                }, () -> {
                    brandLogo.setVisibility(View.GONE);
                    brandText.setVisibility(View.VISIBLE);
                });
            }

            if (chromeAvatar.isEmpty()) {
                loadedAvatarUrl = "";
                showAvatarFallback();
            } else if (!chromeAvatar.equals(loadedAvatarUrl)) {
                loadedAvatarUrl = chromeAvatar;
                loadRemoteImage(chromeAvatar, avatarButton, () -> {
                    if (chromeAvatar.equals(loadedAvatarUrl)) {
                        avatarButton.setPadding(0, 0, 0, 0);
                        avatarButton.clearColorFilter();
                    }
                }, this::showAvatarFallback);
            }

            for (Map.Entry<String, BottomItem> entry : bottomItems.entrySet()) {
                boolean active = entry.getKey().equals(chromeActive);
                entry.getValue().setActive(active);
            }
        });
    }

    private void showAvatarFallback() {
        if (avatarButton == null) return;
        avatarButton.setImageResource(R.drawable.cp_profile);
        avatarButton.setColorFilter(COLOR_BLUE);
        avatarButton.setPadding(dp(8), dp(8), dp(8), dp(8));
    }

    private void loadRemoteImage(
        String rawUrl,
        ImageView target,
        Runnable onSuccess,
        Runnable onFailure
    ) {
        new Thread(() -> {
            try (InputStream input = new URL(rawUrl).openStream()) {
                Bitmap bitmap = BitmapFactory.decodeStream(input);
                if (bitmap == null) throw new IllegalStateException("Image decode failed");
                runOnUiThread(() -> {
                    target.setImageBitmap(bitmap);
                    onSuccess.run();
                });
            } catch (Exception ignored) {
                runOnUiThread(onFailure);
            }
        }).start();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_PICK_MEDIA && requestCode != REQUEST_TAKE_PHOTO) return;

        JSONArray items = new JSONArray();
        try {
            if (resultCode == Activity.RESULT_OK) {
                if (requestCode == REQUEST_TAKE_PHOTO && pendingCameraUri != null) {
                    appendMediaItem(items, pendingCameraUri, "chatpalez-camera-" + System.currentTimeMillis() + ".jpg");
                } else if (data != null) {
                    ClipData clip = data.getClipData();
                    if (clip != null) {
                        for (int i = 0; i < clip.getItemCount(); i++) {
                            appendMediaItem(items, clip.getItemAt(i).getUri(), null);
                        }
                    } else if (data.getData() != null) {
                        appendMediaItem(items, data.getData(), null);
                    }
                }
            }
        } catch (Exception ignored) {
            items = new JSONArray();
        }

        deliverPickedMedia(items);
        pendingCameraUri = null;
    }

    private void launchNativeMediaPicker(String source, boolean multiple, String requestId) {
        if (webView == null) return;
        pendingMediaRequestId = requestId == null ? "" : requestId;

        try {
            if ("camera".equals(source)) {
                File image = File.createTempFile("chatpalez-camera-", ".jpg", getCacheDir());
                pendingCameraUri = FileProvider.getUriForFile(
                    this,
                    getPackageName() + ".fileprovider",
                    image
                );

                Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                camera.putExtra(MediaStore.EXTRA_OUTPUT, pendingCameraUri);
                camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivityForResult(camera, REQUEST_TAKE_PHOTO);
                return;
            }

            Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            picker.addCategory(Intent.CATEGORY_OPENABLE);
            picker.setType("image/*");
            picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple);
            startActivityForResult(picker, REQUEST_PICK_MEDIA);
        } catch (Exception error) {
            deliverPickedMedia(new JSONArray());
        }
    }

    private void appendMediaItem(JSONArray items, Uri uri, String fallbackName) throws Exception {
        if (uri == null) return;

        String mimeType = getContentResolver().getType(uri);
        if (mimeType == null || mimeType.trim().isEmpty()) mimeType = "image/jpeg";

        String name = fallbackName;
        Cursor cursor = null;
        try {
            cursor = getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null);
            if (cursor != null && cursor.moveToFirst()) {
                int column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (column >= 0) name = cursor.getString(column);
            }
        } finally {
            if (cursor != null) cursor.close();
        }

        if (name == null || name.trim().isEmpty()) {
            name = "chatpalez-photo-" + System.currentTimeMillis() + ".jpg";
        }

        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (InputStream input = getContentResolver().openInputStream(uri)) {
            if (input == null) return;
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
        }

        JSONObject item = new JSONObject();
        item.put("dataUrl", "data:" + mimeType + ";base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP));
        item.put("mimeType", mimeType);
        item.put("name", name);
        items.put(item);
    }

    private void deliverPickedMedia(JSONArray items) {
        if (webView == null) return;
        String requestId = pendingMediaRequestId == null ? "" : pendingMediaRequestId;
        pendingMediaRequestId = "";

        String script =
            "(function(){if(window.__chatpalezResolveMedia){" +
            "window.__chatpalezResolveMedia(" + JSONObject.quote(requestId) + "," + items.toString() + ");" +
            "}})();";
        webView.evaluateJavascript(script, null);
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

    private class ChatPalezNativeBridge {
        @JavascriptInterface
        public void share(String title, String url) {
            runOnUiThread(() -> {
                String safeTitle = title == null || title.trim().isEmpty() ? "Share post" : title;
                String safeUrl = url == null ? "" : url;
                shareExternally(safeTitle, safeUrl);
            });
        }

        @JavascriptInterface
        public void sharePost(String title, String url, String repostUrl, boolean repostDisabled) {
            runOnUiThread(() -> showSharePostSheet(title, url, repostUrl, repostDisabled));
        }

        @JavascriptInterface
        public void pickMedia(String source, boolean multiple, String requestId) {
            runOnUiThread(() -> launchNativeMediaPicker(source, multiple, requestId));
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

    private class BottomItem {
        final View root;
        final ImageView icon;
        final TextView label;
        final boolean createAction;

        BottomItem(View root, ImageView icon, TextView label, boolean createAction) {
            this.root = root;
            this.icon = icon;
            this.label = label;
            this.createAction = createAction;
        }

        void setActive(boolean active) {
            int tint = active ? COLOR_BLUE : COLOR_MUTED;
            label.setTextColor(tint);
            label.setTypeface(Typeface.DEFAULT, active ? Typeface.BOLD : Typeface.NORMAL);
            if (!createAction) {
                icon.setColorFilter(tint);
            }
            root.setSelected(active);
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
