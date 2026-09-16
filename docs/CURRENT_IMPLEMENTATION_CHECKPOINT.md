# ChatPalez Mobile — Current Implementation Checkpoint

**Date:** 2026-09-16  
**Mobile repo:** `justyce2/chatpalez_mobile`  
**Mobile branch:** `develop`  
**Backend repo:** `justyce2/chatpalez-backend-2`  
**Backend branch:** `sngine-fresh` (intended to become the updated production `master`)  

This is the operational continuation point. Read it together with `ARCHITECTURE_AND_SCOPE.md`, `API_CAPABILITY_MATRIX.md`, `IMPLEMENTATION_HANDOFF.md`, and `BACKLOG.md`.

## Architecture in force

ChatPalez Mobile is a **progressive hybrid Capacitor application**:

1. bundled/local Capacitor application shell;
2. API-driven high-visibility screens;
3. native device integrations;
4. retained web-backed modules only where API migration is not yet justified;
5. `sngine-fresh` is the backend/API source that is expected to become production `master`.

Do not return to the previous architecture where Capacitor boots directly into `https://chatpalez.com`.

## Owner instruction — GitHub Actions

GitHub Actions are disabled for this project. **Do not recreate, enable or trigger Actions on normal pushes.** Continue with direct commits and manual/runtime validation unless the project owner explicitly reverses this instruction.

## Backend implementation (`chatpalez-backend-2/sngine-fresh`)

### First-party mobile API security adapter

Commit: `8233cfd9d3ff0b9c0f5d1fe44c170ca049817062`

- preserves Sngine's HMAC/API-secret path for normal server API clients;
- prevents the mobile bundle from needing `system_api_secret`;
- allows approved first-party mobile bootstrap/auth calls;
- protected calls still require a valid Sngine JWT in `x-auth-token`;
- JWT/session validation remains owned by Sngine's `User` class and `users_sessions`.

### JWT-to-web session bootstrap

Commit: `376c2dc8cd1ec30130278ffbefa7d3d7012abcbe`

- adds `mobile-session.php`;
- POST-only;
- validates official mobile context and the signed Sngine JWT;
- establishes standard Sngine web-session cookies;
- redirects only to a safe internal relative path;
- client transition is still outstanding because JWTs must not be exposed in URLs.

### Notifications API adapter

Commits:

- `887891555bca1afc1f9bdf59992b6489bdd94cf4` — notification controller;
- `aa0379e629c06f92890ee260bc018ebcdbff335c` — notification router;
- `851e7f667a7647e645b0bd5ca48ee139aa5eef16` — module registration.

The fresh backend already contained the complete `NotificationsTrait::get_notifications()` business logic. The mobile adapter exposes that existing Sngine logic through authenticated `GET /apis/php/notifications` instead of duplicating notification behavior.

## Mobile implementation (`chatpalez_mobile/develop`)

### Local Capacitor boot

Commit: `79cdde11de543d8e13ac37bf418c4380ec6c57e0`

The installed app boots bundled local assets. Remote `server.url` is no longer the application root.

### API/auth foundation

- typed API client: `6aadf360677a2918c23962fce94102b8d275ebb7`;
- temporary JWT session state: `8b1f61815d6b1abb5a6d4ca95b69ce07d956cc5e`;
- API auth service: `b4aa7fa91eaa43e1860aa24f30f4ff0aac6b28a2`;
- local shell/login/navigation groundwork: `5ba74dc70094dd551843250ce079bffae7abfb08`, `0ee1867c4e6d1c2689ccde84b2dde5db59294d86`, `b3cb7ef53e090c635eaf91420422b88c6bd50110`.

The local shell provides Home / Messages / Alerts / Profile and API-driven login/logout.

## Major milestone — local/API messaging is now functionally broad

Original service foundation: `19fa9ff50f822189ee9b6fafc14a48edc2bcd231`.

Earlier wiring:

- `3cb2365171662cf2873c0af0b8a9d75d854118e0` — conversation list connected to Sngine API;
- `3c4bfad3aeef7b97b7e03c8cd326ffc6395798f0` — local conversation detail + composer;
- `a1f5ea8b994bb3f4bae2db731391e2b7766d2873` — message retrieval + send-message handlers;
- `b92de4c34d910912bd7e142db74454eb77d5ec3f` — thread/composer styling.

Current milestone commits:

- `b0c4df2e41eaa2452cb3a4f3f73f3a25e96943f1` — typing state, seen/read state hooks and local account/settings UI groundwork;
- `cda66806349beb8afd2a6bb10b74aa50a5a80a35` — wires typing, seen, blocked users and deletion handlers;
- `2196812464a47cd0d7cdd84dc75a170ca712e4dd` — adds contacts and official Sngine new-conversation creation support;
- `04c230a48d155767f9228cd7415f88dbdab1227b` — local New Message/contact picker/first-message flow;
- `94d8ecd3f4ef091ed2b6ce0670b8898dde0b1133` — wires contact search and start-conversation handlers;
- `c84289ccb45887c96d03842540265c8ff4046884`, `624e3316317ef79de577cdc8e02f18d79a470561` — Settings/chat/contact mobile UI styling.

Current local Messages behavior in source:

1. load conversations through `GET /chat/conversations`;
2. open conversation detail locally;
3. load thread data through `GET /chat/messages`;
4. send messages through `POST /chat/message`;
5. send typing state through `POST /chat/actions/typing`;
6. mark loaded messages seen through `POST /chat/actions/seen`;
7. display online/typing/last-seen state returned by Sngine;
8. search contacts through `GET /chat/contacts`;
9. start a new one-to-one conversation locally by calling Sngine's existing `post_conversation_message()` path with recipients and no existing conversation ID;
10. rely on Sngine's existing privacy, blocking and paid-chat checks when a conversation is created.

Messaging is no longer planned as an automatically web-backed v1 surface. The API/local implementation is now the preferred v1 path, subject to runtime acceptance.

### Local Profile / Account / Settings milestone

User service foundation: `b4c5faea9980c23e7add58255f9451a6aec0dfaf`.

The local Profile/Settings experience now includes:

- local account identity summary;
- local navigation from Profile into Account & Settings;
- blocked-user retrieval from `GET /user/blocked`;
- blocked-user list rendered inside the app;
- local sign-out;
- password-confirmed account deletion through `POST /user/delete`;
- local session cleared after successful deletion.

Account deletion still requires runtime/device acceptance before it is marked complete for store compliance.

### Notifications are API-driven in the mobile implementation

- client service: `be327cd02fef872a01927cf412c62654c4995d48`;
- local Alerts renderer: `7e81faa878256462dc44ef0cdf56a327b04de169`;
- service wiring: `f48a7c76bf6bf7d4e7f7e957928acec9eb683e66`;
- notification-list styling: `07d426fa237a6b7c888d817dc150f5bccf1cb707`.

Current local Alerts behavior in source:

1. request authenticated notifications from `GET /apis/php/notifications`;
2. render sender/name, message and time locally;
3. retain notification destinations for controlled local-to-web routing;
4. retry on API failure.

Notification destination taps still depend on the pending JWT-to-web session transition before retained web pages can open as the same signed-in user.

## Confirmed auth model

Fresh Sngine authentication is JWT-based for non-web clients:

- `/auth/signin` creates a server-side user session;
- response contains `{ token, user }`;
- token is a signed JWT containing the user ID and session token;
- protected API requests send it as `x-auth-token`;
- `User::__construct()` validates JWT signature and session token against `users_sessions`.

This remains the approved mobile auth model.

## Security rules that must not be violated

- Never embed `system_api_secret` in Android/iOS/JavaScript/Vite configuration.
- Never put the mobile JWT in a query string, deep link, log or analytics event.
- Do not move the JWT into ordinary permanent `localStorage` as a shortcut.
- `sessionStorage` is temporary until native secure persistence is implemented.
- Web-module entry must use the server session-bootstrap design, not cookie fabrication in JavaScript.
- New backend mobile endpoints should reuse existing Sngine business logic rather than duplicating it.

## Current validation status

GitHub Actions remain disabled by owner instruction and must remain disabled unless explicitly reversed.

The implementation environment has not yet completed a real Android/iOS runtime pass against a deployed `sngine-fresh`. Therefore this milestone is **implemented / Testing**, not runtime-complete.

Do not claim Android/iOS login, chat, notifications, account deletion or retained-web session continuity as runtime-passed until the fresh backend is reachable and exercised from the app.

## Exact next implementation steps

1. Complete the safe POST transition from local/API UI to `mobile-session.php`; never put JWT in a URL.
2. Deploy/merge `sngine-fresh` so the first-party adapter, notifications endpoint and session bootstrap exist on the reachable ChatPalez server.
3. Runtime-test login, 2FA, logout, session expiry, conversations, new conversation, thread loading, send message, typing, seen state, notifications, blocked users and account deletion.
4. Replace interim `sessionStorage` JWT persistence with native secure storage.
5. Re-test OneSignal identity association against JWT auth using official `/user/onesignal`.
6. Add notification permission controls into local Settings and verify Android/iOS permission UX.
7. Continue endpoint mapping for feed/posts/profile editing/groups/pages/search.
8. Decide whether the home/feed stays retained-web for v1 or receives a limited API/local implementation.
9. Add messaging media/attachment support after runtime text-chat acceptance.
10. Keep documentation synchronized after each material milestone.

## Backend branch policy

`sngine-fresh` is an active upgrade branch intended to become the new production Sngine codebase. New backend progressive-hybrid/API changes belong there unless specifically directed otherwise. The eventual merge into `master` must preserve existing ChatPalez customizations and all mobile adapter work listed above.
