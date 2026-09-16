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
- Notifications API module: `887891555bca1afc1f9bdf59992b6489bdd94cf4`, `aa0379e629c06f92890ee260bc018ebcdbff335c`, `851e7f667a7647e645b0bd5ca48ee139aa5eef16`.

The backend adapter keeps server-side HMAC/API-secret support for normal API clients while allowing the first-party app to authenticate protected requests with Sngine's signed JWT/session model.

## Mobile foundation already implemented

- local Capacitor boot: `79cdde11de543d8e13ac37bf418c4380ec6c57e0`;
- typed API client: `6aadf360677a2918c23962fce94102b8d275ebb7`;
- interim JWT session state: `8b1f61815d6b1abb5a6d4ca95b69ce07d956cc5e`;
- local app shell with Home / Messages / Alerts / Profile;
- native lifecycle, status bar, deep-link groundwork and existing Capacitor integrations remain in place.

## Major milestone — local authentication lifecycle

The app no longer depends on the website for basic account entry/recovery.

Implemented:

- API login;
- API logout;
- forgot-password email request;
- reset-code confirmation;
- new-password submission;
- local success/return-to-login UX;
- explicit Sngine 2FA challenge detection;
- local 2FA code screen;
- successful 2FA completion into the normal JWT session.

Relevant commits:

- password recovery service: `55b1a69d9bf9d24acd70cbc570b16dec9b5cd01e`;
- local recovery UI: `a326f63c173ef78fbecb8fe6265e73afaf2d05a9`;
- recovery wiring: `7fac56794de5dbe5e1afec5ea311e48ef65cf47a`;
- recovery styling: `5c04436475555c5f82cbf7fa0be8adc1c77ca2d5`;
- recovery service tests: `8a3350c9a36012a71552fb774982fd9d6ee0f9e2`;
- 2FA-aware auth service: `4a9db7de75a7918dc9b1c891c1e1550bcc7bf006`;
- local 2FA UI: `b51548667a9c1d73681662a916c3423429e3b299`;
- 2FA wiring into app bootstrap/login: `daa6bfa43431eae095bb472eb19b3e22cdc1a095`.

Sngine behavior verified in `sngine-fresh`: non-web `sign_in()` returns `{ '2FA': true, user_id, method }` when required; `/auth/two_factor_authentication` returns the normal `{ token, user }` mobile session after successful verification.

Signup/activation/getting-started onboarding remains to be implemented.

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

Relevant commits include `19fa9ff50f822189ee9b6fafc14a48edc2bcd231`, `3cb2365171662cf2873c0af0b8a9d75d854118e0`, `3c4bfad3aeef7b97b7e03c8cd326ffc6395798f0`, `a1f5ea8b994bb3f4bae2db731391e2b7766d2873`, `b0c4df2e41eaa2452cb3a4f3f73f3a25e96943f1`, `2196812464a47cd0d7cdd84dc75a170ca712e4dd`, `04c230a48d155767f9228cd7415f88dbdab1227b`, `94d8ecd3f4ef091ed2b6ce0670b8898dde0b1133`.

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

User API service commit: `b4c5faea9980c23e7add58255f9451a6aec0dfaf`.

## Current validation state

All current progressive-hybrid work is **implemented / Testing** until the updated `sngine-fresh` backend is deployed and exercised from Android/iOS.

Do not claim runtime-passed login, recovery, 2FA, messaging, notifications, account deletion or retained-web session continuity yet.

## Exact next implementation order

1. Audit `/app/settings`, genders, countries, custom fields and user-group metadata needed for signup.
2. Implement local API signup + activation + getting-started onboarding.
3. Complete the safe POST client transition into `mobile-session.php` for retained web modules; never expose JWTs in URLs.
4. Deploy/merge `sngine-fresh` to a reachable ChatPalez environment.
5. Run manual Android/iOS validation for login, 2FA, recovery, logout, expiry, new/existing chats, typing/seen, Alerts, blocked users and deletion.
6. Replace interim `sessionStorage` JWT handling with a native secure-storage implementation.
7. Reconnect OneSignal identity through official `/user/onesignal` under the new JWT auth lifecycle.
8. Add local notification-permission controls to Settings.
9. Continue feed/posts/profile-editing/groups/pages/search API mapping and decide the v1 Home/feed boundary.
10. Add chat media/attachment support after text-chat runtime acceptance.

## Handoff rule

A new developer/session should start from this file, then read the architecture and API matrix before changing code. Do not infer missing API behavior from conversational memory; verify it in `sngine-fresh` first.
