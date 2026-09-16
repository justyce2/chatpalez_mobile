# ChatPalez Mobile — Release Inputs Runbook

This document lists external values/accounts required to complete Android/iOS release work. It intentionally does **not** contain secrets.

## Security Rules

- Never commit keystores, passwords, APNs private keys, Firebase service-account keys, signing certificates/private keys or App Store credentials.
- Prefer client-owned Apple/Google/Firebase/OneSignal accounts.
- Store CI secrets only in repository/environment secret storage when automated signing is explicitly enabled.
- Keep public identifiers (bundle ID, package ID, OneSignal App ID, Firebase project/app IDs) separate from private credentials.

## Confirmed Project Identity

| Item | Current value | Status |
|---|---|---|
| App name | ChatPalez | Working/final-name confirmation still recommended |
| Android application ID | `com.chatpalez` | Confirmed from existing Android identity |
| iOS bundle ID in Xcode project | `com.chatpalez` | Must be registered/owned in client Apple Developer team |
| Production origin | `https://chatpalez.com` | Confirmed |
| Native shell user-agent marker | `ChatPalezMobile/1.0` | Implemented |
| Custom app deep-link scheme | `chatpalez://open` | Registered on Android/iOS; trusted-target validation implemented |

## Android — Google Play / Signing

Required before final signed AAB:

1. Google Play Console access to the existing ChatPalez app, if an existing listing is being upgraded.
2. Confirm Play package name is exactly `com.chatpalez`.
3. **Read the highest version code already uploaded/published in Google Play.** The new Android `versionCode` must be strictly higher. The generated project currently uses `versionCode 1` only as a development placeholder and this must not be treated as release-ready for an existing listing.
4. Confirm the desired user-facing release `versionName` (for example `1.0`, `1.1`, or the next existing product version) so Android and iOS marketing versions can be aligned intentionally.
5. Determine whether **Play App Signing** is already enabled.
6. If this is an update, obtain the correct upload key/keystore or use the existing Play upload-key process.
7. Required local/CI signing values:
   - keystore file (`.jks`/`.keystore`)
   - keystore password
   - key alias
   - key password
8. Verify signing certificate SHA-256/SHA-1 fingerprints if Firebase/App Links need them.

Current engineering state: CI already compiles an unsigned release `.aab`; signing is deliberately not embedded in source control. The artifact proves the release variant compiles, but it is **not** the final Play-upload artifact until version/signing inputs above are applied.

## Firebase / FCM — Android Push

Required:

1. Firebase project controlled by client/project owner.
2. Android Firebase app registered for package `com.chatpalez`.
3. `google-services.json` generated for the Android app if required by the selected OneSignal setup.
4. FCM credentials configured in OneSignal according to the current OneSignal/Firebase integration method.
5. Test device registration and delivery verified after credentials are configured.

Do not commit server/private Firebase credentials.

## OneSignal

The backend already exposes the configured public OneSignal App ID to the official mobile shell. To finish native delivery:

1. Access to the OneSignal app used by ChatPalez.
2. Confirm the same OneSignal app should serve web + mobile, or explicitly approve a dedicated mobile OneSignal app.
3. Configure Android platform with FCM credentials.
4. Configure iOS platform with APNs credentials.
5. Verify OneSignal external-user identity uses the authenticated ChatPalez user ID.
6. Validate foreground, background and notification-click behavior on physical devices.

The mobile source accepts the public identifier through `VITE_ONESIGNAL_APP_ID`; set it in the build environment, not in a committed `.env` file. The installed app logs in with the authenticated ChatPalez user ID as its external identity and syncs the OneSignal user ID through the existing official `POST /user/onesignal` route. OneSignal REST/API secrets must never be exposed to the app bundle or web page.

## Apple Developer / App Store Connect

Required:

1. Active Apple Developer Program membership.
2. Access to the client team in Apple Developer and App Store Connect.
3. Register/confirm bundle identifier `com.chatpalez`.
4. If an existing iOS listing/build exists, read the current App Store marketing version and highest build number. New `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION` values must advance correctly; the generated `1.0` / build `1` values are development placeholders until this is confirmed.
5. Enable capabilities required by the final app, including Push Notifications when native push is enabled.
6. Configure signing through Xcode automatic signing or managed certificates/profiles.
7. Confirm Team ID.
8. Create/confirm the App Store Connect app record for ChatPalez.
9. Provide final app metadata, privacy policy URL, support URL, screenshots and age/content declarations.

A cloud Mac is sufficient for Xcode archive/TestFlight work, but Apple Developer/App Store credentials remain separate.

## APNs — iOS Push

Preferred input where supported:

- APNs authentication key (`.p8`)
- Key ID
- Apple Team ID
- Bundle/topic `com.chatpalez`

Alternative certificate-based APNs setup can be used if the client already operates that model.

The private `.p8` key must not be committed to Git.

## Branding Assets

Needed for final native packaging:

- authoritative square app icon source, preferably 1024×1024 or larger without rounded corners baked in
- splash/launch artwork if different from app icon
- official background color/brand color
- confirmation that display name should be exactly **ChatPalez**

Do not generate final store artwork from an uncertain favicon/logo unless the client approves it as the authoritative source.

## Store URLs / Compliance

Verify before submission:

- public Privacy Policy page is live and complete
- public Contact/Support page is live and complete
- account deletion is enabled in production and reachable from the installed app
- report/block flows are reachable from relevant UGC/user surfaces
- data-safety/app-privacy declarations match actual enabled ChatPalez modules

## Recommended Handoff Format

When credentials become available, provide access through the relevant client-owned service rather than pasting long-lived secrets into chat where avoidable. The minimum non-secret values that can safely be confirmed in writing are:

- Apple Team ID
- exact bundle ID
- current App Store marketing version/highest build number, if an iOS listing already exists
- Google Play package ID/listing confirmation
- highest Google Play version code already uploaded/published
- desired next user-facing mobile version
- Firebase project ID/app registration confirmation
- OneSignal App ID / app selection confirmation
- final support URL
- final privacy URL
- final brand asset location

Private signing and messaging credentials should be installed directly in their provider/CI secret store during release setup.
