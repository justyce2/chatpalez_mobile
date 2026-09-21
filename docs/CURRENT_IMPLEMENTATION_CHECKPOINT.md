# ChatPalez Mobile — Current Implementation Checkpoint

**Date:** 2026-09-16  
**Mobile repo:** `justyce2/chatpalez_mobile` → `develop`  
**Backend repo:** `justyce2/chatpalez-backend-2` → `sngine-fresh`  
**Backend policy:** `sngine-fresh` is intended to become the updated production `master`.

Read this together with `ARCHITECTURE_AND_SCOPE.md`, `API_CAPABILITY_MATRIX.md`, `IMPLEMENTATION_HANDOFF.md`, and `BACKLOG.md`.

## Non-negotiable project rules

- Architecture is **progressive hybrid**: bundled/local Capacitor shell + API-driven high-visibility screens + retained web modules only where justified.
- Do not restore Capacitor `server.url` as the app root.
- Do not embed Sngine `system_api_secret` in the mobile app.
- Do not place JWTs in query strings, deep links, logs, analytics, or ordinary persistent `localStorage`.
- GitHub Actions are disabled by owner instruction. **Do not recreate, enable, or trigger Actions on normal pushes.**
- New backend mobile work belongs on `sngine-fresh` unless explicitly directed otherwise.

## Backend progressive-hybrid support already implemented

- first-party mobile API security adapter: `8233cfd9d3ff0b9c0f5d1fe44c170ca049817062`;
- JWT-to-web session bootstrap endpoint (`mobile-session.php`): `376c2dc8cd1ec30130278ffbefa7d3d7012abcbe`;
- Notifications API module: `887891555bca1afc1f9bdf59992b6489bdd94cf4`, `aa0379e629c06f92890ee260bc018ebcdbff335c`, `851e7f667a7647e645b0bd5ca48ee139aa5eef16`;
- mobile signup/onboarding request-body fix: `81519e014bb7a65cf96380c0b6d35436210e8588`;
- hardened same-origin redirect validation and no-referrer response headers for `mobile-session.php`: `f9f6dca6395193838a688def6e3ca45897ede5be`.

## Mobile foundation already implemented

- local Capacitor boot: `79cdde11de543d8e13ac37bf418c4380ec6c57e0`;
- typed API client: `6aadf360677a2918c23962fce94102b8d275ebb7`;
- interim JWT session state: `8b1f61815d6b1abb5a6d4ca95b69ce07d956cc5e`;
- local app shell with Home / Messages / Alerts / Profile;
- native lifecycle, status bar, deep-link groundwork and existing Capacitor integrations remain in place.

## Major milestone — local authentication and registration lifecycle

The app no longer depends on the website for basic account entry, recovery, registration, activation or getting-started onboarding.

Implemented:

- API login and logout;
- forgot-password request, reset-code confirmation and password replacement;
- explicit Sngine 2FA challenge detection and local 2FA UI;
- signup metadata loading from `/app/settings`, `/app/genders`, `/app/countries`, `/app/custom_fields` and `/app/user_groups`;
- local account creation through `POST /auth/signup`;
- local activation-code verification and resend;
- local getting-started profile form and finish route;
- incomplete registration resumes after app restart/login when `user_activated` or `user_started` is false;
- registration API contract tests added.

Registration milestone commits on `develop`:

- registration/onboarding API service: `9ae1334c8f6b272985d8d204793f3d77b2715c3f`;
- local signup/activation/getting-started flow: `193fde0353b8b18b79d9054edf63c90d545ba4bb`;
- app bootstrap wiring: `20d1a60452ba91a9de0cea338ccacd770a056d96`;
- registration API tests: `e50cd10e6b13523a1489f002ff086b35a525bc40`;
- resumable incomplete-registration lifecycle: `67dc56df4b42ed05873fd330177792db7f561845`, `fbf3575d8b626b28313bee4aba52646d34a87178`.

## Major milestone — safe local to retained-web session transition

Implemented in source:

- `src/web-session.ts` builds a POST-only transition to `https://chatpalez.com/mobile-session.php`;
- JWT is submitted in the HTTPS form body and is never placed in the URL;
- requested destinations are normalized against the configured ChatPalez origin and cross-origin/protocol-relative destinations are rejected;
- the existing Capacitor `appendUserAgent: ' ChatPalezMobile/1.0'` satisfies the backend first-party shell check;
- `onOpenWebModule` now uses the real bridge instead of the previous alert placeholder;
- trusted native/deep-link routes use the same authenticated bridge;
- missing mobile token returns the user to local sign-in rather than attempting a web transition;
- destination-policy contract tests added.

Relevant commits:

- POST transition helper: `61466974ec1e97a970dfb87a3f3e3c0ccea35f21`;
- bridge wiring: `1c1a9b68965f62f9154fb9d9190e6bab5e2297e0`;
- destination-policy tests: `471eb4869df02ead3a37f10f98d1bbbf612f0096`;
- backend path hardening: `f9f6dca6395193838a688def6e3ca45897ede5be`.

This bridge remains **Testing** until the updated backend is deployed and the actual Android/iOS WebView cookie + 303 redirect behavior is exercised.

## Major milestone — local/API messaging

Messaging is now the preferred local/API v1 path, not an automatic web fallback.

Implemented behavior:

1. conversation list (`GET /chat/conversations`);
2. local thread detail;
3. message loading (`GET /chat/messages`);
4. send text message (`POST /chat/message`);
5. typing state (`POST /chat/actions/typing`);
6. seen/read updates (`POST /chat/actions/seen`);
7. online/typing/last-seen display;
8. contact search (`GET /chat/contacts`);
9. New Message contact picker;
10. create a one-to-one conversation through Sngine's existing message endpoint with JSON-encoded recipients;
11. Sngine privacy/blocking/paid-chat rules remain authoritative.

Chat API contract tests: `99665f905c22ba3c5c5d8b9bfcc2577caa595ee6`.

## Local Alerts / Notifications

Implemented:

- authenticated notifications endpoint backed by existing Sngine notification logic;
- typed client service;
- local Alerts list;
- sender/name, message and time rendering;
- retry/error states;
- retained-web destinations now route through the POST session bridge.

## Local Profile / Account / Settings

Implemented:

- account identity summary;
- local Settings screen;
- blocked-user retrieval/list;
- local logout;
- password-confirmed account deletion;
- mobile session clear after deletion.

## Current validation state

All current progressive-hybrid work is **implemented / Testing** until the updated `sngine-fresh` backend is deployed and exercised from Android/iOS.

Do not claim runtime-passed signup, activation, onboarding, login, recovery, 2FA, messaging, notifications, account deletion or retained-web session continuity yet.

Source validation completed on 2026-09-16: `npm run build` passed (TypeScript + Vite production build) and `npm test` passed (37 tests). GitHub Actions remain intentionally disabled. Native Capacitor sync/build and physical-device acceptance are still required.

## Exact next implementation order

1. Install dependencies, run `npx cap sync`, then validate the native protected session store on Android/iOS: cold start, logout, deletion, corrupt-store recovery and no browser-storage fallback.
2. Deploy/merge `sngine-fresh` to a reachable ChatPalez environment.
3. Run manual Android/iOS validation for signup, activation, onboarding, login, 2FA, recovery, retained-web POST/cookie continuity, logout, expiry, new/existing chats, typing/seen, Alerts, blocked users and deletion.
4. Configure the public `VITE_ONESIGNAL_APP_ID`, then run `npx cap sync` and validate native OneSignal delivery/identity using the official `/user/onesignal` route: login, logout, permission grant/denial, foreground/background and notification click. Notification URLs must be internal ChatPalez paths.
5. Validate retained feed/home, post composer, comments/reactions, groups, pages and search through the protected WebView session bridge on Android/iOS.
6. Validate deeper profile, profile editing, friends/followers and social-graph pages through the protected WebView bridge on Android/iOS; the official API has no sufficient read/update contract.
7. Perform the native/device acceptance pass for local chat: conversation/contact/message history pagination, photo attachment upload/rendering, typing/seen, reactions and deletion. Video and voice attachments remain deferred.

## Handoff rule

A new developer/session should start from this file, then read the architecture and API matrix before changing code. Do not infer missing API behavior from conversational memory; verify it in `sngine-fresh` first.


## Resolution — API-first and upgrade-safe customization policy (2026-09-16)

Before retaining or adding any custom backend/mobile integration, audit the official Sngine API and existing server functionality first. Use official routes and business logic whenever they satisfy the requirement; do not duplicate them in a parallel ChatPalez API.

- The mobile TypeScript API adapter is client-side only. It normalizes calls to official Sngine routes and is **not** a new backend API.
- Use the official Sngine route `POST /user/onesignal` for authenticated OneSignal user/device association. Do not create a custom OneSignal identity endpoint unless an audit proves an incompatible provider requirement.
- Existing custom notification support must be re-audited against fresh Sngine before it is retained; remove or reduce it if stock coverage is sufficient.
- Keep feed, posts, comments, groups, pages and search web-backed for v1 unless the official API audit proves complete, practical coverage. Do not create broad custom endpoints to force their migration.
- The only custom backend work that may remain is the smallest isolated extension required to: (a) prevent the mobile app from containing Sngine's server-only HMAC secret, and (b) establish a standard Sngine web session when an authenticated local user enters a retained web module. Both must be documented, runtime-tested and kept outside stock theme presentation code where practical.
- Preserve the stock Sngine core/default theme. Any app-specific retained-web presentation belongs in a separately named duplicate theme (for example, `chatpalez_mobile`) and must be selected only for official mobile-app requests, not made the global website default.
- Maintain an upgrade-customization register for every retained custom backend extension: upstream file/function, requirement, why the official API was insufficient, minimal contract, isolation location and upgrade/retest steps.

**Immediate gate:** complete the official-API-versus-custom-extension audit before any further backend modification. This decision does not itself mark existing bridge/API work runtime-accepted; it remains Testing until deployed Android/iOS validation.


## Implementation update — native secure JWT storage (2026-09-16)

Implemented on `develop`:

- replaced browser `sessionStorage` JWT/user persistence with an in-memory session plus native protected persistence;
- added Capacitor 8 secure storage using iOS Keychain (`whenUnlockedThisDeviceOnly`, iCloud sync disabled) and Android Keystore-backed storage;
- browser builds deliberately keep session state in memory only and never use the plugin's localStorage web fallback;
- restored native sessions asynchronously during bootstrap; logout/deletion clear the protected store;
- no backend route, Sngine theme, JWT bridge or API contract was modified.

**Status:** Testing — requires `npm install`, `npx cap sync`, Android/iOS build and real-device cold-start/logout verification. The next independent implementation work remains official-API audit/OneSignal lifecycle integration; do not add custom backend code before that audit.


## Upgrade customization register

The API-first exception register is now maintained in `docs/UPGRADE_CUSTOMIZATION_REGISTER.md`. Before modifying the backend or upgrading Sngine, audit each listed item against the fresh official API and update its retain/remove decision and test outcome.


## Implementation update — official OneSignal native lifecycle (2026-09-16)

Implemented on `develop` without any backend modification:

- added optional public `VITE_ONESIGNAL_APP_ID` configuration; no OneSignal secret is included in the app;
- initializes the installed native OneSignal Capacitor SDK only on Android/iOS and only when that public ID is present;
- logs the authenticated ChatPalez user ID in as the OneSignal external ID, then sends the OneSignal user ID through the existing official `POST /user/onesignal` API;
- logs out the native OneSignal identity on ChatPalez logout and account deletion;
- adds a local Settings control that requests notification permission only after an explicit user tap; it does not prompt on application launch;
- app build and test validation passed: `npm run build`; `npm test` — 37 tests;
- no custom OneSignal endpoint, Sngine business-logic change, session bridge change or theme change was made.

**Status:** Testing — requires public app-ID/FCM/APNs configuration, `npx cap sync`, Android/iOS native builds, and physical-device delivery/click validation.


## Decision — Home/feed remains a controlled web module for v1 (2026-09-16)

The official fresh-Sngine API audit is complete for the Home/feed boundary. Its API exposes discovery new_people only; it has no official timeline, post CRUD, non-chat comment/reaction, social-group, social-page or global-search route. ChatPalez will therefore retain those surfaces in the existing mobile web experience, opened only through the protected POST JWT-to-standard-web-session bridge. The local app shell, auth, messages, Alerts, profile summary and Settings remain native/API-driven. This requires no custom backend code or theme modification.


## Implementation update — trusted OneSignal notification routing (2026-09-16)

A OneSignal notification click can now open only a relative or configured-same-origin ChatPalez URL. The route is normalized before entering the existing authenticated web-module bridge; external, malformed and alternate-port URLs are ignored. This keeps notification taps within the same trusted-navigation policy as deep links and retained-web buttons. Unit tests cover the route policy. Status: **Testing** pending native foreground/background click validation.


## Decision — deeper profile and social graph remain web-backed for v1 (2026-09-16)

The official fresh user API audit is complete. It does not include dedicated profile retrieval or update, nor friends/followers/relationship-list retrieval. The current local identity summary, blocked-user list and account deletion are retained; profile editing and social-graph pages stay behind the protected retained-web bridge. No custom backend API is authorized for these screens.


## Major milestone — local chat photo attachments (2026-09-16)

Implemented using existing official Sngine behavior only: the mobile client sends a multipart chat-photo upload to `POST /data/upload` (`type=photos`, `handle=chat`) and supplies the returned server path as the `photo` value to `POST /chat/message`. The conversation composer supports an optional image with or without text. No custom route, storage logic or theme change was added. Status: **Testing** pending deployed-backend and Android/iOS device upload/send/render validation.


## Implementation update — local chat photo rendering (2026-09-16)

Local conversation threads now render a message photo only when its server path matches the expected Sngine `photos/YYYY/MM/file` form. The source is converted to the configured ChatPalez uploads origin; malformed, non-photo and external values are rejected. Status remains **Testing** pending deployed-device validation.


## Major milestone — local conversation management (2026-09-16)

Local messaging now supports official Sngine leave/delete conversation actions, Like reactions, and deletion of a sender's own message. Server-side authorization remains authoritative. No backend route or theme change was added. Status: **Testing** pending deployed Android/iOS validation.


## Implementation update — messaging pagination foundation (2026-09-16)

The API client now preserves Sngine's official `has_more` metadata for paged conversation/contact requests; ChatService exposes page-aware methods alongside its existing simple list calls. Status: **Testing**; use this foundation for local Load More UI after runtime API validation.


## Major milestone — local messaging pagination UI (2026-09-17)

The local Messages and New Message contact picker now provide Load More controls using Sngine's official offset and has_more responses. No backend change was made. Status: **Testing** pending deployed API/device validation.


## Implementation update — correct message-history paging contract (2026-09-17)

Message history now omits `last_message_id` for normal offset-based pages, avoiding the API's separate “newer than this ID” mode when no cursor is intended. This is the required service foundation for loading older thread history. Status: **Testing**.


## API implementation tranche complete — runtime validation next (2026-09-17)

The API-related implementation tranche is complete in source. The local thread now provides **Load older messages** through the official `chat/messages` offset/history contract while preserving the reader's position when older content is prepended. Existing local services were rechecked against their audited routes and contract tests now cover chat, authentication/recovery, registration, user blocking/deletion/OneSignal association, notifications, and multipart chat-photo uploads. The transport layer retains JSON/form-data distinction, authenticated headers and page metadata.

No additional backend route, Sngine core file, stock theme, or JWT bridge behavior was added or changed. The existing `notifications` adapter remains a documented minimal exception, pending deployed acceptance; it was not expanded.

**Verification:** `npm run build` passes and `npm test` passes (**52 tests**). This is source-level verification only. The remaining API boundary is not more custom implementation: deploy the approved backend reference, then validate each existing contract on Android and iOS with real users/devices (including history paging, attachment limits/failures, session expiration, OneSignal delivery and retained-web session transition).

**Next non-API implementation phase:** native runtime validation and retained-web module regression. Do not create a replacement API for the intentionally retained feed, posts, groups, pages, search, deeper profile, or social-graph modules unless a fresh official-API audit demonstrates a sufficient contract.


## Retained-web bridge activation (2026-09-17)

The bundled shell now activates the existing mobile bridge and binds retained-web share/external-event hooks before authentication begins. This does not alter any web/mobile theme or replace the current ChatPalez UI; it makes the already-designed hybrid controls available in the bundled shell. The bridge only accepts trusted internal route notifications, while the secure POST session handoff remains responsible for entering retained web modules.

**Verification:** fresh-clone native configuration check, web build, and 61 unit tests must pass. Physical-device and deployed retained-web regression remain the next acceptance gate.


## Reliability milestones — session expiry and startup recovery (2026-09-17)

The typed API client now invokes a single session-expiry handler only when a request made with an existing JWT receives HTTP 401. It clears protected session and native notification identity, then returns to the local sign-in flow. A public sign-in failure does not trigger this cleanup. The startup/offline screen now retries the real bootstrap pipeline rather than only displaying the login screen.

**Verification:** fresh-clone native configuration check, web build and **63 unit tests** pass. This is source verification; Android/iOS device recovery scenarios remain manual acceptance items.


## Reliability hardening — lifecycle, offline retained modules and release boundary (2026-09-17)

Implemented on `develop`:

- native lifecycle registration is now single-flight across startup retries, preventing duplicate deep-link, restoration, app-state and Android-back listeners;
- retained web modules check connectivity before the protected POST session transition, so an offline device stays in the bundled shell instead of attempting a broken remote view;
- native lifecycle unit coverage verifies browser no-op behavior, trusted deep-link routing, restored/app-state events, Android back behavior and iOS exclusion;
- `npm run verify:native` now includes static release-boundary checks: no server API secret in the mobile source, no browser-storage JWT fallback, and the retained-web bridge's POST/no-JWT-query contract.

**Verification:** `npm run verify:native` passed (**14 checks**), `npm run build` passed, and `npm test` passed (**67 tests**). Native runtime and deployed-backend acceptance remain the next external validation gate.

## Branding and published Android identity — assets provisioned (2026-09-17)

The Android application ID is now fixed to **`chatpalez.app.webview`**, the existing Google Play identity specified for this product. The Android Gradle namespace/application ID, Java package, generated Capacitor configuration, release documents and iOS project identifier were aligned before release preparation. The existing Android upload/signing identity must still be used for Play Console acceptance.

The supplied ChatPalez logo has been converted into a native icon master and used to provision Android launcher/adaptive-icon density assets, iOS app icon assets, portrait/landscape Android splash screens and iOS splash screens. The bundled local startup/login experience now displays the ChatPalez icon and uses its blue brand colour; retained web UI and stock theme were not modified.


---

## Three-layer hybrid checkpoint — 2026-09-21

Authoritative plan: `docs/THREE_LAYER_HYBRID_WATERFALL.md`.

Architecture is now native shell + narrow mobile APIs + `chatpalez_app` retained-content overlay.

Implemented in source since the three-layer decision:

- authentication viewport pinning for login/signup/activation/onboarding/recovery/2FA;
- native top bar, hamburger drawer, five-item bottom navigation and account menu;
- shell-aware Android back routing;
- shell-safe retained-content iframe target through the existing JWT-to-web-session bridge;
- native feed views: News Feed, Popular, Discover, Saved, Scheduled and Memories;
- native Reels list;
- native Watch/video list;
- native global Search;
- native People, Friend Requests, Sent Requests and Friends;
- native Pages, Groups and Events lists plus Like/Join/Interest actions;
- native Page/Group/Event detail with privacy-aware recent posts;
- native post detail, media playback, comments, post Like/unlike and comment creation;
- native comment Like/unlike, Edit and Delete;
- native text-post composer with privacy;
- `chatpalez_app` Smarty overlay selected only for `ChatPalezMobile/1.0`, inheriting untouched templates/assets from the active website theme while stripping duplicate website header/footer/bottom navigation/sidebar/PWA chrome;
- upgrade register updated for mobile social API and app-theme overlay.

Backend `sngine-fresh` must be deployed before runtime acceptance of the new mobile routes. A live 404 from `/apis/php/mobile/feed` means the live backend has not yet pulled the relevant `sngine-fresh` commits.

All items above remain **Testing** until Android/iOS runtime acceptance. GitHub Actions remain disabled by owner instruction.

Next implementation priority:

1. retained-content/session/navigation regression (H4-02 through H4-07);
2. account/profile/settings expansion (H5-01 through H5-03);
3. runtime regression of native social surfaces and app-theme fallback;
4. complex Create flows remain app-theme backed until individually audited.


### Follow-on checkpoint — retained navigation + native account/settings

Added after the three-layer checkpoint:

- retained app-theme pages now report their current route/title to the native shell via `postMessage`;
- native shell validates retained bridge messages against the configured ChatPalez origin;
- Android back traverses retained fallback history before returning to native Home;
- hidden JWT bridge forms are removed from the local DOM immediately after submission;
- trusted deep links, push routes and notification links now use one native route dispatcher;
- trusted routes arriving before authentication are queued until the native shell is mounted;
- Capacitor native cookie bridge enabled;
- iOS `WKAppBoundDomains` added for `localhost`, `chatpalez.com`, and `www.chatpalez.com`, with `limitsNavigationsToAppBoundDomains` enabled;
- native account snapshot API added;
- native Profile screen expanded with picture, bio, work/location/education/website summary;
- native editors added for Profile, Login & Contact, Work, Location, Education, Social Links, Password and Privacy;
- account writes delegate to Sngine's existing `settings()` validation;
- blocked-user list now supports native Unblock;
- account snapshot cache invalidates after edits so native identity refreshes without app restart.

Current device acceptance remains pending. The source-level next target is Page/Group/Event creation plus profile-avatar update audit, followed by Android/iOS regression closure.
