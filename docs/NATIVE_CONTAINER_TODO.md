# Native Container Implementation TODO

The TypeScript bridge layer is in place. The next native-specific tasks are intentionally separated because they require generated `android/` and `ios/` projects.

## Android

- Generate Capacitor Android project.
- Verify Gradle build.
- Add/verify WebView navigation delegate as required by final container approach.
- Verify hardware back behavior against real WebView history.
- Verify uploads/file chooser/camera permissions.
- Add FCM/OneSignal after credentials are supplied.

## iOS

- Generate Capacitor iOS project.
- Verify Xcode project opens and builds on cloud Mac.
- Verify WKWebView navigation delegate and external link behavior.
- Verify safe-area/keyboard/file input behavior.
- Add APNs/OneSignal after Apple Developer credentials are supplied.

Do not mark platform tasks Completed until the corresponding native project/runtime has been exercised.


## Local native readiness verification (2026-09-17)

Run `npm run verify:native` before a native build. It statically verifies that the bundled Capacitor configuration has no remote root, the bridge user agent and HTTPS protections remain configured, deep links are declared, and Android/iOS camera, microphone and photo permission declarations exist. It does not replace Android/iOS builds or physical-device testing.

**Current source check:** Android and iOS `npx cap sync` both completed with all 11 Capacitor plugins. Android debug assembly remains Awaiting Response because this environment cannot download the Gradle 8.14.3 distribution; no compile failure was observed.
