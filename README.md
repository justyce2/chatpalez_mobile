# ChatPalez Mobile

Hybrid Android and iOS client for ChatPalez, built with Capacitor 8 and TypeScript.

## Architecture

This repository contains the shared mobile shell plus Android and iOS native projects. The existing ChatPalez PHP/Smarty application remains the system of record for social-network business logic and most UI; native capabilities are layered onto the installed app through Capacitor and the guarded backend mobile bridge.

Core project documents:

- `docs/ARCHITECTURE_AND_SCOPE.md` — architecture and delivery scope
- `docs/BACKLOG.md` — implementation/status ledger
- `docs/RUNTIME_QA_MATRIX.md` — Android/iOS runtime acceptance tests
- `docs/APP_STORE_COMPLIANCE.md` — UGC/privacy/store audit
- `docs/RELEASE_INPUTS.md` — external Apple/Google/Firebase/OneSignal/signing inputs
- `docs/PLATFORM_SUPPORT.md` — supported Android/iOS versions and orientation policy
- `docs/RELEASE_CHECKLIST.md` — authoritative release go/no-go checklist
- `docs/DEEPLINK_DOMAIN_ASSOCIATION.md` — Android/iOS verified HTTPS link setup

## Confirmed Runtime Identity

| Item | Value |
|---|---|
| App display name | ChatPalez |
| Android application ID | `chatpalez.app.webview` |
| iOS bundle ID in project | `chatpalez.app.webview` |
| Production origin | `https://chatpalez.com` |
| Official-shell marker | `ChatPalezMobile/1.0` |
| Custom deep-link scheme | `chatpalez://open` |

The Android identity is preserved for compatibility with the existing app identity. Apple ownership/signing for `chatpalez.app.webview` still has to be confirmed in the client Apple Developer team before release.

## Platform Support

- Android API 24 / Android 7.0 and newer
- Android compile/target SDK 36
- iOS 15.0 and newer

See `docs/PLATFORM_SUPPORT.md` for orientation and support-policy details.

## Requirements

- Node.js 22+
- npm
- Android Studio + Android SDK for Android local builds
- macOS + Xcode for iOS device/archive builds

Local build scripts and the checked-in native projects support Android debug/release compilation and iOS compilation. GitHub Actions are currently disabled by project-owner instruction; final signed store artifacts still require client-controlled signing credentials/accounts.

## First-time Setup

```bash
cp .env.example .env
npm install
npm run build
npm test
```

Public runtime configuration belongs in `.env`; privileged credentials do not.

## Common Commands

```bash
npm run build
npm test
npm run build:metadata
npm run cap:sync
npm run android
npm run ios
```

`npm run build:metadata` validates native identity/version consistency and writes `artifacts/build-metadata.json` for traceable build evidence.

## Native Projects

The source-controlled native projects are:

- `android/`
- `ios/`

They are intentionally kept in the same repository because Android and iOS share the Capacitor configuration, web/native bridge contract, dependencies, release documentation and product behavior.

After plugin/config/web-shell changes:

```bash
npm run cap:sync
```

Only regenerate a native project deliberately. CI guards important native configuration such as package identity, Android backup/cleartext policy, permissions and deep-link registration.

## Runtime Configuration

`.env.example` defines the non-secret configuration used by the local shell:

- `VITE_CHATPALEZ_ORIGIN=https://chatpalez.com`
- trusted internal host configuration
- `CAP_APP_ID=chatpalez.app.webview`
- `CAP_APP_NAME=ChatPalez`

Never put API secrets, signing passwords, Apple APNs private keys, Firebase service-account credentials, OneSignal REST keys or private signing material in `VITE_*` variables or commit them to this repository.

## Current Native Capabilities

The active implementation includes:

- trusted HTTPS ChatPalez container policy
- recoverable loading/offline/server-error shell
- Android back behavior
- iOS WKWebView back/forward swipe navigation
- app lifecycle hooks
- external HTTP(S) browser handoff
- `tel:` and `mailto:` OS handoff
- native Share bridge
- keyboard resize/state integration
- safe-area/status/splash handling
- selective haptics
- custom `chatpalez://open` deep links with trusted-target validation
- Android App Link and iOS Universal Link source declarations for `https://chatpalez.com/...`
- OneSignal native SDK integration and user-controlled permission UX
- ChatPalez user ↔ OneSignal external identity bridge
- foreground/click notification handlers
- bounded privacy-safe diagnostics
- Android emulator/instrumentation smoke coverage
- Android unsigned release-AAB generation in CI
- traceable CI build metadata artifact

The matching server-side bridge is maintained in `justyce2/chatpalez-backend-2` on the active `sngine-fresh` integration branch and must be deployed in step with mobile runtime acceptance.

## Deep Links

The installed app supports the custom scheme, and the native projects now declare first-party HTTPS App/Universal Links:

```text
chatpalez://open?path=/settings/notifications
https://chatpalez.com/messages?thread=10
```

The custom scheme can also carry an encoded trusted same-origin URL through the `url` parameter. The bridge resolves only destinations that map back to the approved ChatPalez HTTPS origin. External hosts, script/data schemes, protocol-relative escape attempts and malformed targets are rejected.

## Push Notifications

Native push scaffolding is implemented, but real delivery is not release-complete until the client provides/configures:

- OneSignal mobile platform access/configuration
- Firebase/FCM for Android
- APNs/Apple Developer configuration for iOS
- physical-device delivery/click testing

The app does **not** automatically prompt on first launch. The user explicitly enables native notifications from ChatPalez Notifications settings.

## Release Versioning

The default Android `versionCode 1` and iOS build `1` are development placeholders. Android builds can override the development values with `CHATPALEZ_VERSION_CODE` and `CHATPALEZ_VERSION_NAME` without editing Gradle source. Because ChatPalez has an existing Android identity, the final Android version code must be strictly higher than the highest version already uploaded to Google Play. Do not guess this number.

See `docs/RELEASE_INPUTS.md` before producing a final signed release.

## Validation Notes

GitHub Actions are currently disabled by project-owner instruction. Run `npm run verify:native`, `npm test`, `npm run build`, `npx cap sync android`, and the Gradle build locally before treating a commit as a device-test candidate.

## Branch Strategy

- `main`: stable/release-ready work
- `develop`: active mobile implementation/integration

The current `develop → main` pull request remains intentionally draft. Do not merge merely because compile CI passes; runtime P0/P1 acceptance and release dependencies are tracked in `docs/RELEASE_CHECKLIST.md`.
