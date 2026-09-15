# ChatPalez Mobile — Current Implementation Checkpoint

**Date:** 2026-09-15  
**Mobile repo:** `justyce2/chatpalez_mobile`  
**Mobile branch:** `develop`  
**Backend repo:** `justyce2/chatpalez-backend-2`  
**Backend branch:** `sngine-fresh` (intended to become the updated production `master`)  

This file is the short operational checkpoint for continuing implementation without conversational context. Read it together with `ARCHITECTURE_AND_SCOPE.md`, `API_CAPABILITY_MATRIX.md`, `IMPLEMENTATION_HANDOFF.md`, and `BACKLOG.md`.

## What changed in this implementation pass

### Backend (`sngine-fresh`)

1. **Secure first-party mobile API adapter** — commit `8233cfd9d3ff0b9c0f5d1fe44c170ca049817062`
   - preserves Sngine's stock HMAC API-key path;
   - does not require the distributed app to embed `system_api_secret`;
   - allows selected first-party public auth/bootstrap routes with `x-mobile-client: chatpalez-mobile-v1`;
   - requires a valid Sngine JWT in `x-auth-token` for protected first-party mobile API requests;
   - the normal Sngine `User` object still verifies the session token against `users_sessions`.

2. **JWT-to-web session bootstrap** — commit `376c2dc8cd1ec30130278ffbefa7d3d7012abcbe`
   - adds `mobile-session.php`;
   - POST-only;
   - validates the official mobile user-agent marker;
   - validates the Sngine JWT;
   - creates the standard web session cookies;
   - redirects only to an internal relative ChatPalez path.
   - Client-side wiring is not yet runtime-accepted.

### Mobile (`develop`)

1. **Capacitor now boots local bundled assets** — commit `79cdde11de543d8e13ac37bf418c4380ec6c57e0`.
   - removed the previous remote `server.url` architecture;
   - the installed app now starts from the bundled local shell.

2. **Typed API client** — commit `6aadf360677a2918c23962fce94102b8d275ebb7`.
   - base `/apis/php/` client;
   - standardized JSON envelope/error handling;
   - `x-mobile-client` header;
   - optional `x-auth-token` header;
   - no server API secret in the client.

3. **JWT mobile session state** — commit `8b1f61815d6b1abb5a6d4ca95b69ce07d956cc5e`.
   - current implementation uses `sessionStorage` only;
   - this is intentionally temporary until native secure persistence is selected;
   - do not move the JWT into ordinary long-term local storage without a security review.

4. **API auth service** — commit `b4aa7fa91eaa43e1860aa24f30f4ff0aac6b28a2`.
   - local sign-in calls official `/auth/signin`;
   - supplies Sngine device metadata;
   - expects official `{ token, user }` response.

5. **Local progressive mobile shell/login UI** — commits `5ba74dc70094dd551843250ce079bffae7abfb08`, `0ee1867c4e6d1c2689ccde84b2dde5db59294d86`, and `b3cb7ef53e090c635eaf91420422b88c6bd50110`.
   - local login screen;
   - authenticated local shell;
   - Home / Messages / Alerts / Profile primary tabs;
   - profile summary from sign-in user data;
   - local logout path;
   - native startup/lifecycle code remains integrated.

6. **Messaging API service foundation** — commit `19fa9ff50f822189ee9b6fafc14a48edc2bcd231`.
   - conversations;
   - message retrieval;
   - send message;
   - typing state;
   - seen state.

7. **Messaging shell UI groundwork** — commits `97fdca56af48ae66686a13525ed26ce26e752bb4`, `ae7125f5acb31763959b22e68e24d5daa451b9db`, and `93cd4127e0bd0a8d3deccdd1ebebd70aa41ccb8e`.
   - local conversation-list renderer exists;
   - hook is intentionally optional because connector safety blocked the final `main.ts` credential-path rewrite;
   - `src/api/chat.ts` is ready to be wired to `onLoadConversations` once the final main-shell write can be applied.

8. **API capability matrix updated** — commit `aa8cf427600772e5ee16ee7d941fe30b741642f2`.

## Auth model now confirmed

Sngine's fresh mobile/API authentication is JWT-based:

- `/auth/signin` creates a normal server-side user session;
- returns a JWT containing `uid` + session token plus secured user data;
- protected API calls can authenticate through `x-auth-token`;
- `User::__construct()` validates the JWT signature and the session token against `users_sessions`.

This is now the approved mobile auth basis.

## Important security rule

Do **not** embed Sngine's `system_api_secret` in Android/iOS code, JavaScript, environment variables bundled by Vite, or committed source. The backend adapter exists specifically to avoid that.

## Current validation status

GitHub Actions remain disabled by owner instruction.

A manual local clone/build attempt could not run because the execution environment could not resolve `github.com`. Therefore:

- API/auth audit: **Completed**;
- local shell/API client/login code: **Testing**;
- backend mobile JWT adapter: **Testing** until deployed and exercised against the updated server;
- JWT-to-web bootstrap: **Testing**, client navigation wiring still outstanding;
- messaging service: **Implemented / Testing**, local conversation loading not yet fully wired in `main.ts`.

Do not claim a successful Android/iOS runtime login until `sngine-fresh` is deployed to a reachable test/production server and the app is run against it.

## Exact next implementation steps

1. Wire `ChatService.getConversations()` into the existing optional `onLoadConversations` shell handler in `src/main.ts`.
2. Complete client navigation through `mobile-session.php` for retained web modules using a safe POST transition; do not put JWTs in URLs.
3. Deploy/merge the fresh backend so `/apis/php/*`, the mobile adapter, and `mobile-session.php` are actually reachable on the server.
4. Runtime-test local API login, 2FA response handling, signout, session expiry, and message conversation loading.
5. Add native secure JWT persistence; `sessionStorage` is only an interim implementation.
6. Implement the local conversation detail/message composer using `ChatService.getMessages()` and `sendMessage()`.
7. Continue the API audit for notifications, feed/posts, profile editing, groups/pages/search.
8. Build local notifications/profile/settings screens from confirmed API capabilities; keep unproven areas web-backed for v1.
9. Re-test existing OneSignal identity mapping against the new JWT auth state.
10. Keep GitHub Actions disabled unless the owner explicitly reverses that instruction.

## Backend branch policy

`sngine-fresh` is no longer just a disposable comparison branch. The project owner has stated that it is intended to become the updated production Sngine codebase and will eventually merge into `master`.

Therefore new backend mobile/API work should be made against `sngine-fresh` unless explicitly directed otherwise, and merge planning must preserve ChatPalez customizations plus the progressive-hybrid adapter work documented here.
