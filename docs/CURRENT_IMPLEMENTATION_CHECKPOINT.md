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
- mobile signup/onboarding request-body fix: `81519e014bb7a65cf96380c0b6d35436210e8588`.

The auth adapter now passes the API request body directly into Sngine signup/getting-started methods and no longer returns undefined onboarding response variables.

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

Earlier auth milestone commits remain documented in repository history for password recovery and 2FA.

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
- destination retained for controlled local-to-web routing.

Notification destination taps still depend on the pending JWT-to-web session transition.

## Local Profile / Account / Settings

Implemented:

- account identity summary;
- local Settings screen;
- blocked-user retrieval/list;
- local logout;
- password-confirmed account deletion;
- mobile session clear after deletion.

## Current validation state

All current progressive-hybrid work, including signup/activation/onboarding, is **implemented / Testing** until the updated `sngine-fresh` backend is deployed and exercised from Android/iOS.

Do not claim runtime-passed signup, activation, onboarding, login, recovery, 2FA, messaging, notifications, account deletion or retained-web session continuity yet.

Local build execution could not be performed from the current tool runtime because that runner cannot resolve GitHub to clone/install the repository. Source/contract validation was performed and GitHub Actions remain intentionally disabled.

## Exact next implementation order

1. Complete the safe POST client transition into `mobile-session.php` for retained web modules; never expose JWTs in URLs.
2. Deploy/merge `sngine-fresh` to a reachable ChatPalez environment.
3. Run manual Android/iOS validation for signup, activation, onboarding, login, 2FA, recovery, logout, expiry, new/existing chats, typing/seen, Alerts, blocked users and deletion.
4. Replace interim `sessionStorage` JWT handling with a native secure-storage implementation.
5. Reconnect OneSignal identity through official `/user/onesignal` under the new JWT auth lifecycle.
6. Add local notification-permission controls to Settings.
7. Continue feed/posts/profile-editing/groups/pages/search API mapping and decide the v1 Home/feed boundary.
8. Add chat media/attachment support after text-chat runtime acceptance.

## Handoff rule

A new developer/session should start from this file, then read the architecture and API matrix before changing code. Do not infer missing API behavior from conversational memory; verify it in `sngine-fresh` first.
