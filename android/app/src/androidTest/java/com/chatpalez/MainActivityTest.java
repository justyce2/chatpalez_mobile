package com.chatpalez;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
import static androidx.test.espresso.matcher.ViewMatchers.isRoot;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;

import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.rules.ActivityScenarioRule;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@RunWith(AndroidJUnit4.class)
public class MainActivityTest {

    @Rule
    public ActivityScenarioRule<MainActivity> activityRule = new ActivityScenarioRule<>(MainActivity.class);

    @Test
    public void appContainerLaunchesWithoutCrashing() {
        onView(isRoot()).check(matches(isDisplayed()));
    }

    @Test
    public void officialMobileUserAgentIsPresent() throws Exception {
        assertTrue("Expected ChatPalez mobile user-agent marker", waitForJavascriptTrue(
            "navigator.userAgent.indexOf('ChatPalezMobile/1.0') !== -1"
        ));
    }

    @Test
    public void productionBackendLoadsOfficialMobileBridge() throws Exception {
        assertTrue("Expected live ChatPalez production origin and mobile bridge", waitForJavascriptTrue(
            "location.origin === 'https://chatpalez.com' && " +
            "window.chatpalez_mobile_app === true && " +
            "typeof window.ChatPalezMobileWeb === 'object' && " +
            "typeof window.ChatPalezMobileNativeUI === 'object' && " +
            "typeof window.ChatPalezMobileDiagnostics === 'object'"
        ));
    }

    @Test
    public void customSchemeIsDeliveredToMainActivity() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        Intent intent = new Intent(
            Intent.ACTION_VIEW,
            Uri.parse("chatpalez://open?path=%2Fsettings%2Fnotifications")
        );
        intent.setPackage(context.getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        assertNotNull("Custom scheme should resolve to ChatPalez", intent.resolveActivity(context.getPackageManager()));
        context.startActivity(intent);

        Thread.sleep(1000);
        onView(isRoot()).check(matches(isDisplayed()));
    }

    private boolean waitForJavascriptTrue(String expression) throws Exception {
        WebView webView = getWebView();
        assertNotNull("Capacitor WebView was not found", webView);

        for (int attempt = 0; attempt < 30; attempt++) {
            CountDownLatch latch = new CountDownLatch(1);
            AtomicReference<String> result = new AtomicReference<>();

            InstrumentationRegistry.getInstrumentation().runOnMainSync(() ->
                webView.evaluateJavascript(expression, value -> {
                    result.set(value);
                    latch.countDown();
                })
            );

            if (latch.await(5, TimeUnit.SECONDS) && "true".equals(result.get())) {
                return true;
            }

            Thread.sleep(1000);
        }

        return false;
    }

    private WebView getWebView() {
        AtomicReference<WebView> reference = new AtomicReference<>();
        activityRule.getScenario().onActivity(activity ->
            reference.set(findWebView(activity.getWindow().getDecorView()))
        );
        return reference.get();
    }

    private WebView findWebView(View view) {
        if (view instanceof WebView) {
            return (WebView) view;
        }

        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView child = findWebView(group.getChildAt(i));
                if (child != null) {
                    return child;
                }
            }
        }

        return null;
    }
}
