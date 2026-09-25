# ChatPalez Mobile — Release Checklist

This is the authoritative go/no-go checklist for the first Android/iOS Capacitor release.

## 1. Engineering Baseline

- [x] Capacitor 8 mobile project initialized.
- [x] Android project builds in CI.
- [x] iOS simulator project builds in CI without signing.
- [x] Android package identity is `chatpalez.app.webview`.
- [ ] Apple Developer team confirms ownership/registration of `chatpalez.app.webview`.
- [x] Production origin is `https://chatpalez.com`.
- [x] Android API 24+ / target 36 support policy documented.
- [x] iOS 15+ support policy documented.
- [x] Android cleartext traffic disabled.
- [x] Android application backup disabled.
- [x] No unnecessary native location permission is declared.
- [x] iOS does not use an arbitrary-load ATS exception.

## 2. Native Integration

- [x] Official mobile-shell marker implemented.
- [x] Browser OneSignal SDK suppressed only inside official app shell.
- [x] Native OneSignal Capacitor SDK installed.
- [x] User-controlled notification permission UX implemented.
- [x] ChatPalez user ↔ OneSignal external identity bridge implemented.
- [x] Foreground notification handler implemented.
- [x] Notification-click routing implemented.
- [x] Native Share bridge implemented.
- [x] External HTTP(S) browser handoff implemented.
- [x] `tel:` / `mailto:` OS handoff implemented.
- [x] Keyboard resize/state integration implemented.
- [x] Android back-button handling implemented.
- [x] iOS WKWebView back/forward gesture enabled.
- [x] Custom `chatpalez://open` scheme registered on Android/iOS.
- [x] Deep-link trusted-origin validation implemented and unit tested.
- [x] Selective haptic feedback implemented.
- [x] Privacy-safe bounded diagnostics implemented.

## 3. Branding

- [ ] Authoritative final app icon source approved.
- [ ] Final Android adaptive/legacy icon assets generated.
- [ ] Final iOS AppIcon asset set generated.
- [ ] Final splash/launch artwork approved and applied.
- [ ] Display name confirmed as exactly **ChatPalez**.
- [ ] Store screenshots prepared for required Android/iOS device sizes.

## 4. Runtime QA

Execute `docs/RUNTIME_QA_MATRIX.md` against the release candidate.

### P0 acceptance

- [ ] Android standard login succeeds.
- [ ] iOS standard login succeeds.
- [ ] Session persistence verified on both platforms.
- [ ] Logout and post-logout restart verified.
- [ ] Authenticated forms/CSRF flows verified.
- [ ] Feed loads and core social navigation works.
- [ ] Text post creation succeeds.
- [ ] Avatar/media upload succeeds on Android.
- [ ] Avatar/media upload succeeds on iOS.
- [ ] Messaging send/receive works.
- [ ] Message attachments work.
- [ ] Enabled voice/video calling works or is explicitly disabled/scoped before release.
- [ ] Report objectionable content flow works.
- [ ] Block user flow works.
- [ ] Account deletion completes using a disposable account.
- [ ] No P0 diagnostic/privacy/security failure remains.

### Important P1 acceptance

- [ ] Android back behavior verified on device/emulator.
- [ ] iOS swipe-back behavior verified in simulator/device.
- [ ] Keyboard does not cover login/chat composer.
- [ ] Safe areas/notches/home indicator do not obstruct content.
- [ ] External links, phone and email intents work.
- [ ] Offline/reconnect and backend-unavailable recovery work.
- [ ] OAuth/social login providers in production configuration are verified or disabled before release.

## 5. Push Notifications

- [ ] OneSignal mobile platform configuration confirmed.
- [ ] Firebase Android app exists for `chatpalez.app.webview`.
- [ ] FCM credentials configured in OneSignal.
- [ ] Apple APNs credentials configured in OneSignal.
- [ ] Android device receives native push.
- [ ] iPhone receives native push.
- [ ] Foreground notification behavior verified.
- [ ] Background delivery verified.
- [ ] Internal notification click opens correct ChatPalez route.
- [ ] External notification URL leaves the app container.
- [ ] Logout detaches native push identity.

## 6. Google Play Release

- [ ] Existing Play Console listing/package `chatpalez.app.webview` confirmed.
- [ ] Highest existing Google Play `versionCode` recorded.
- [ ] New `versionCode` set strictly above the existing maximum.
- [ ] Final user-facing Android `versionName` approved.
- [ ] Play App Signing state confirmed.
- [ ] Correct upload keystore/key available.
- [ ] Signed release AAB built.
- [ ] Signed AAB verified with expected package/signing identity.
- [ ] Play Data Safety form completed from actual production configuration.
- [ ] Content rating completed.
- [ ] Privacy policy/support URLs supplied.
- [ ] Release notes prepared.
- [ ] Internal/closed testing upload passes Play validation before production rollout.

Engineering evidence already available: CI can build an **unsigned** release AAB; this proves the release variant compiles but is not a substitute for the signed/store-versioned artifact.

## 7. Apple / TestFlight Release

- [ ] Active Apple Developer membership confirmed.
- [ ] App Store Connect access confirmed.
- [ ] Apple Team ID recorded.
- [ ] Bundle ID `chatpalez.app.webview` registered/owned by the team.
- [ ] Existing App Store version/build history checked, if applicable.
- [ ] New marketing version/build number set correctly.
- [ ] Push Notifications capability enabled.
- [ ] Correct signing certificate/profile or automatic signing configured.
- [ ] Release archive succeeds on macOS/Xcode.
- [ ] Archive validates for App Store distribution.
- [ ] TestFlight upload succeeds.
- [ ] App Privacy disclosure completed from actual production configuration.
- [ ] Privacy policy/support URLs supplied.
- [ ] UGC/report/block/delete-account review notes prepared.
- [ ] TestFlight regression pass completed before App Review submission.

## 8. Compliance / Public URLs

Reference `docs/APP_STORE_COMPLIANCE.md`.

- [x] Backend report capability identified.
- [x] Backend user-block capability identified.
- [x] Password-confirmed account deletion implementation identified.
- [x] Settings UI exposes Blocking.
- [x] Settings UI exposes Delete Account when enabled.
- [ ] Production `delete_accounts_enabled` confirmed enabled.
- [ ] Public Privacy Policy content manually verified as current/complete.
- [ ] Public Contact/Support content manually verified as current/complete.
- [ ] Production moderation/admin handling verified.
- [ ] Final store privacy/data declarations reconciled with enabled modules.

## 9. Release Traceability

- [x] CI generates build metadata from native project files.
- [x] CI validates Android/iOS identifiers and matching marketing versions.
- [x] CI records commit SHA/ref in build metadata.
- [x] Runtime QA matrix exists.
- [x] External release-input runbook exists.
- [ ] Final signed release metadata saved with release candidate.
- [ ] Final release candidate commit recorded/tagged.
- [ ] Final Android AAB SHA-256 recorded.
- [ ] Final iOS archive/TestFlight build number recorded.

## Go / No-Go Rule

**NO-GO** while any of the following is true:

- any P0 runtime test fails;
- production login/session is unverified on either platform;
- report/block/account-deletion requirements are inaccessible;
- final store identifiers/version numbers are unknown;
- signing identity is unknown or incorrect;
- privacy/support pages are missing/incomplete;
- required FCM/APNs push configuration is missing while native push is advertised as a release feature;
- release artwork is provisional/unapproved.

The engineering project may be merged to a release branch only after the unresolved items are either completed or explicitly removed from the release scope with matching UI/configuration disabled.
