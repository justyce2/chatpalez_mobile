package com.chatpalez;

import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.isDisplayed;
import static androidx.test.espresso.matcher.ViewMatchers.isRoot;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.rules.ActivityScenarioRule;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class MainActivityTest {

    @Rule
    public ActivityScenarioRule<MainActivity> activityRule = new ActivityScenarioRule<>(MainActivity.class);

    @Test
    public void appContainerLaunchesWithoutCrashing() {
        onView(isRoot()).check(matches(isDisplayed()));
    }

    @Test
    public void trustedCustomSchemeLaunchesMainActivity() {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        Uri deepLink = Uri.parse("chatpalez://open?path=%2Fsettings%2Fnotifications");
        Intent intent = new Intent(Intent.ACTION_VIEW, deepLink);
        intent.setPackage(context.getPackageName());
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(intent)) {
            scenario.onActivity(activity -> {
                Uri received = activity.getIntent().getData();
                assertNotNull(received);
                assertEquals("chatpalez", received.getScheme());
                assertEquals("open", received.getHost());
            });
            onView(isRoot()).check(matches(isDisplayed()));
        }
    }
}
