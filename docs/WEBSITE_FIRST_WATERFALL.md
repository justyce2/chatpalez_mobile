# ChatPalez Mobile — Website-First Hybrid Waterfall

**Status:** Active / authoritative architecture from 2026-09-21  
**Mobile repository:** `justyce2/chatpalez_mobile` (`develop`)  
**Backend repository:** `justyce2/chatpalez-backend-2` (`sngine-fresh`)  
**GitHub Actions:** disabled; do not trigger.

## 1. Architecture

ChatPalez Mobile is now a website-first hybrid application.

### Native-owned surfaces

Only these remain native/local:

- startup and connectivity gate;
- sign in;
- sign up;
- activation;
- getting-started completion;
- password recovery;
- two-factor authentication;
- secure JWT persistence used to restore the native-auth session;
- native push-notification initialization and permission;
- native app/deep-link lifecycle required before website handoff.

### Website-owned surfaces

After successful authentication, the main Capacitor WebView loads the normal responsive ChatPalez mobile website.

Website ownership includes:

- news feed;
- website header;
- hamburger/off-canvas navigation;
- bottom navigation;
- messages;
- notifications UI;
- profiles;
- settings;
- search;
- pages;
- groups;
- events;
- reels/watch;
- market;
- blogs;
- funding;
- creation flows;
- all other social-network functionality.

There is no native post-login navigation shell.

## 2. Secure handoff

The native login returns a JWT. The app does not put that JWT in a URL.

The app POSTs the JWT and requested internal path to:

`/mobile-session.php`

The backend validates the JWT, creates the normal first-party web cookies, and returns a 303 redirect to the requested ChatPalez path. With no form target, this replaces the native-auth document in the main Capacitor WebView.

On cold start, a restored JWT is checked against a protected Sngine endpoint before website handoff. Invalid/stale sessions are cleared and the native login is shown.

## 3. Native push

Before website handoff the app initializes OneSignal, binds the authenticated user identity, synchronizes the OneSignal ID through the existing Sngine `POST /user/onesignal` API and asks for notification permission when required.

Push delivery remains a native capability even though post-login presentation is website-owned.

## 4. Dedicated app website theme

The app UA remains:

`ChatPalezMobile/1.0`

Sngine selects the upgrade-isolated `content/themes/chatpalez_app/` overlay for that UA.

The overlay now **inherits the normal website templates** rather than removing website navigation. Its role is only to customize the mobile website for the installed-app experience.

Current app-theme behavior:

- normal mobile website header retained;
- normal hamburger/off-canvas navigation retained;
- normal footer/bottom bar retained;
- normal responsive website layout retained;
- PWA install banner hidden because the user is already in the installed app;
- small WebView ergonomics only.

Future native-feeling website improvements belong in this app-specific theme instead of the Capacitor TypeScript shell.

## 5. Rollback backlog

| ID | Task | Status | Acceptance |
|---|---|---|---|
| W1 | Remove native post-login shell from active app | Completed | Auth success transitions to website |
| W2 | Keep native login | Completed | API login remains local |
| W3 | Keep native signup/activation/onboarding | Completed | Registration remains local |
| W4 | Keep native password recovery | Completed | Recovery remains local |
| W5 | Keep native 2FA | Completed | 2FA remains local |
| W6 | Keep secure JWT storage | Completed | JWT never stored in ordinary browser storage |
| W7 | Keep native push initialization | Completed | OneSignal initializes before website handoff |
| W8 | Validate restored session before handoff | Completed | Stale JWT returns native login |
| W9 | Restore website header/navigation/footer | Completed | App theme inherits default mobile website chrome |
| W10 | Disable custom native-social API router | Completed | Native social endpoints are not loaded |
| W11 | Preserve secure JWT→web cookie bridge | Completed | JWT sent only by POST |
| W12 | Restore intentional first-party WebView navigation | Completed | Capacitor allows only ChatPalez/www hosts |
| W13 | Android debug build | Testing | `assembleDebug` succeeds |
| W14 | Login→website device test | Planned | Website opens authenticated after native login |
| W15 | Signup/recovery/2FA device test | Planned | Native auth flows work then website opens |
| W16 | Push permission/delivery test | Planned | Device receives native push |
| W17 | Website logout/session-expiry return-to-auth | Planned | Logged-out app returns cleanly to native auth |
| W18 | App-theme mobile polish | Planned | Website feels app-native without replacing Sngine logic |

## 6. Immediate debug test sequence

```powershell
git pull origin develop
npm install
npm run verify:native
npm test
npm run build
npx cap sync android
cd android
.\gradlew assembleDebug
```

APK output:

`android\app\build\outputs\apk\debug\app-debug.apk`

## 7. Explicitly superseded work

The following previous work is no longer part of the active product architecture:

- native feed;
- native pages/groups/events;
- native social search;
- native post detail/composer;
- native Reels/Watch;
- native messages UI;
- native profile/settings UI;
- native bottom navigation;
- native hamburger drawer;
- native account menu;
- retained-web iframe container;
- connected-account native switcher;
- native appearance controls for post-login UI.

Files may remain in the repository temporarily for historical traceability, but the active entry point does not mount them.

The previous `THREE_LAYER_HYBRID_WATERFALL.md` is superseded by this document.
