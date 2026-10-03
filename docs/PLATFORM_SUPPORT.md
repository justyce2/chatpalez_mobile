# ChatPalez Mobile — Platform Support Policy

## Initial v1 Support Floor

The initial ChatPalez Capacitor 8 mobile release will use the support levels already defined by the generated native projects and validated in CI:

| Platform | Minimum | Build/Target | Notes |
|---|---|---|---|
| Android | API 24 / Android 7.0 | compileSdk 36 / targetSdk 36 | Defined in `android/variables.gradle` |
| iPhone/iPad | iOS 15.0 | Current CI Xcode simulator SDK | Defined in Xcode project build settings |

## Rationale

- These values are generated/accepted by the current Capacitor 8 native projects.
- Android API 24 provides a broad compatibility floor while retaining modern WebView/runtime capability.
- iOS 15 is the existing project deployment target and keeps the first release focused on a modern WKWebView baseline.
- Raising the minimum version later is straightforward; lowering below the current framework/project floor would require separate compatibility validation and is not part of the initial conversion scope.

## Orientation Policy

ChatPalez is portrait-first for normal social use, but the initial release keeps landscape available because media viewing and voice/video calling can reasonably require it.

- iPhone: portrait + landscape left/right.
- iPad: portrait, portrait upside-down + both landscape orientations.
- Android: no forced portrait lock; configuration changes are handled by the existing Capacitor activity.

This policy avoids breaking call/media use cases purely for cosmetic portrait locking.

## Release Validation

Before each store release:

1. Verify the Android `minSdkVersion`, `targetSdkVersion` and `compileSdkVersion` values still match the intended support policy.
2. Verify the Xcode `IPHONEOS_DEPLOYMENT_TARGET` remains consistent for Debug and Release.
3. Re-run Android debug/release builds and the iOS unsigned simulator build.
4. Exercise the runtime QA matrix on at least one supported physical Android device and one supported physical iPhone before final submission.
