# ChatPalez Mobile — Current Implementation Checkpoint

**Date:** 2026-09-15  
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

The fresh backend already contained the complete `NotificationsTrait::get_notifications()` business logic. The mobile adapter now exposes that existing Sngine logic through authenticated `GET /apis/php/notifications` instead of duplicating notification behavior.

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

### Messaging is now API-driven in the mobile implementation

Service foundation: `19fa9ff50f822189ee9b6fafc14a48edc2bcd231`.

Current wiring:

- `3cb2365171662cf2873c0af0b8a9d75d854118e0` — conversation list connected to the real Sngine chat API;
- `3c4bfad3aeef7b97b7e03c8cd326ffc6395798f0` — local conversation detail + composer UI;
- `a1f5ea8b994bb3f4bae2db731391e2b7766d2873` — message retrieval + send-message handlers connected;
- `b92de4c34d910912bd7e142db74454eb77d5ec3f` — local thread/composer styling.

Current local Messages behavior in source:

1. load conversations from `GET /chat/conversations`;
2. open a conversation locally rather than handing it to the website;
3. load messages from `GET /chat/messages`;
4. send text through `POST /chat/message`;
5. refresh the local thread after send.

Typing, seen state, reactions, contacts and calls remain available in the Sngine API and can be layered onto the local chat UI next.

### User/account API service

Commit: `b4c5faea9980c23e7add58255f9451a6aec0dfaf`.

Provides client methods for:

- blocked users;
- password-confirmed account deletion;
- OneSignal session association.

The local Settings UI still needs to consume these methods.

### Notifications client service

Commit: `be327cd02fef872a01927cf412c62654c4995d48`.

The mobile client now has a typed notification service for the newly exposed backend endpoint. Alerts UI wiring is the next local-screen step.

## Confirmed auth model

Fresh Sngine authentication is JWT-based for non-web clients:

- `/auth/signin` creates a server-side user session;
- the response contains `{ token, user }`;
- the token is a signed JWT containing the user ID and session token;
- protected API requests send it as `x-auth-token`;
- `User::__construct()` validates both JWT signature and the session token against `users_sessions`.

This is the approved mobile auth model.

## Security rules that must not be violated

- Never embed `system_api_secret` in Android/iOS/JavaScript/Vite configuration.
- Never put the mobile JWT in a query string, deep link, log or analytics event.
- Do not move the JWT into ordinary permanent `localStorage` as a shortcut.
- `sessionStorage` is temporary until native secure persistence is implemented.
- Web-module entry must use the server session-bootstrap design, not cookie fabrication in JavaScript.
- New backend mobile endpoints should reuse existing Sngine business logic rather than duplicating it.

## Current validation status

GitHub Actions are disabled by owner instruction and must remain disabled unless explicitly reversed.

The available execution environment previously could not resolve GitHub for a local clone/build. Therefore code committed in this implementation wave is **implemented / Testing**, not runtime-complete.

Do not claim Android/iOS API login, chat or notifications as runtime-passed until `sngine-fresh` is deployed to a reachable server and exercised from the app.

## Exact next implementation steps

1. Wire `NotificationsService.getNotifications()` into the local Alerts tab and render notification name/message/time with trusted destination routing.
2. Build local Settings using confirmed `/user/blocked`, `/user/delete`, and native notification-permission controls.
3. Add typing + seen state to local Messages, followed by contacts/new-conversation UX.
4. Complete the safe POST transition from local/API UI to `mobile-session.php`; never put JWT in a URL.
5. Deploy/merge `sngine-fresh` so the new API stack, first-party adapter, notifications endpoint and session bootstrap exist on the reachable ChatPalez server.
6. Runtime-test login, 2FA, logout, session expiry, conversations, thread loading, send message, notifications, and API error handling.
7. Replace interim `sessionStorage` JWT persistence with native secure storage.
8. Continue endpoint mapping for feed/posts/profile editing/groups/pages/search.
9. Re-test OneSignal identity association against JWT auth using the official `/user/onesignal` route.
10. Keep documentation synchronized after each material milestone.

## Backend branch policy

`sngine-fresh` is an active upgrade branch intended to become the new production Sngine codebase. New backend progressive-hybrid/API changes belong there unless specifically directed otherwise. The eventual merge into `master` must preserve existing ChatPalez customizations and all mobile adapter work listed above.
