# ChatPalez Mobile

Hybrid Android and iOS client for ChatPalez, built with Capacitor and TypeScript.

## Architecture

This repository contains the mobile shell and native platform projects. The existing ChatPalez PHP/Smarty application remains the system of record for social-network business logic and most UI. Native capabilities are added progressively through Capacitor.

See:
- `docs/ARCHITECTURE_AND_SCOPE.md`
- `docs/BACKLOG.md`

## Requirements

- Node.js 22+
- npm
- Android Studio + Android SDK for Android builds
- macOS + Xcode for iOS builds
- CocoaPods if required by installed iOS plugins

## First-time setup

```bash
cp .env.example .env
npm install
npm run build
```

Update `.env` with the approved ChatPalez origin and trusted host names before generating native projects.

## Native project generation

Android:

```bash
npm run cap:add:android
```

iOS:

```bash
npm run cap:add:ios
```

After dependencies or web code change:

```bash
npm run cap:sync
```

Open native IDEs:

```bash
npm run android
npm run ios
```

## Environment variables

`VITE_CHATPALEZ_ORIGIN` is the HTTPS ChatPalez URL opened by the mobile shell.

`VITE_ALLOWED_HOSTS` contains comma-separated hosts trusted by the web-side navigation layer.

`CAP_ALLOWED_HOSTS` contains hosts Capacitor is permitted to keep inside the native WebView.

`CAP_APP_ID` and `CAP_APP_NAME` configure native application identity. The current repository default `com.chatpalez.mobile` is provisional and must be finalized before store registration/signing.

Never place private keys, API secrets, Apple APNs keys, Android signing keys, Firebase service-account credentials, or other privileged secrets in `VITE_*` variables or commit them to this repository.

## Current startup flow

1. Launch local Capacitor shell.
2. Prepare native status/splash UI.
3. Check network connectivity.
4. Validate configured ChatPalez origin.
5. Show a recoverable offline/configuration state when necessary.
6. Navigate to the approved ChatPalez mobile experience.

Navigation interception, authentication verification, native push, media permissions, deep links and release signing are tracked in `docs/BACKLOG.md` and will be implemented incrementally.

## Branch strategy

- `main`: stable/release-ready work.
- `develop`: active implementation and integration.

Implementation should land on `develop`, be tested, then merge to `main` at release milestones.
