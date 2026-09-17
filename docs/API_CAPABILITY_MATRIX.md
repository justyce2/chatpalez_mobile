# ChatPalez Mobile — Sngine API Capability Matrix

**Reference backend repo:** `justyce2/chatpalez-backend-2`  
**Reference branch:** `sngine-fresh`  
**API root in source:** `apis/php/`  
**Status date:** 2026-09-17

This matrix is the implementation reference for deciding whether a ChatPalez Mobile surface should be local/API-driven, needs a minimal backend adapter, or remains web-backed for v1.

Do not infer capability from the legacy top-level `api.php`. The current/fresh API subsystem is under `apis/php/`.

## Classification

- **API Ready** — official route coverage is sufficient to begin a client service.
- **API Ready / UI Work** — backend capability is strong; client UX/realtime integration remains substantial.
- **Partial / Audit Required** — some routes exist but complete screen requirements are not proven.
- **Not Yet Proven** — no sufficient official route set has been confirmed yet.
- **Web-backed v1 allowed** — keep the existing web flow until API coverage/effort justifies migration.

## Matrix

| Capability | Classification | Confirmed official API surface | v1 direction |
|---|---|---|---|
| Sign in | API Ready | `POST /auth/signin` returns `{ token, user }` | Local/API-driven |
| Sign up | API Ready | `POST /auth/signup` | Local/API-driven |
| Account activation | API Ready | activation / resend / reset routes | Local/API-driven |
| Getting started/onboarding | API Ready | update + finish routes | Local/API-driven |
| Two-factor auth | API Ready | `POST /auth/two_factor_authentication` | Local/API-driven |
| Sign out | API Ready | `POST /auth/signout` | Local/API-driven |
| Forgot/reset password | API Ready | full forgot/confirm/reset route set | Local/API-driven |
| App settings/bootstrap | API Ready | `GET /app/settings` | Local/API-driven bootstrap |
| Static/legal pages | API Ready | static page collection + page route | Local or controlled web depending presentation |
| Genders/user groups/languages/countries/custom fields/categories | API Ready | `/app/*` routes | Use for dynamic forms/onboarding |
| User connect/social relationship action | API Ready | `POST /user/connect` | Use where required |
| Delete avatar/cover | API Ready | `POST /user/image_delete` | Local/profile candidate |
| OneSignal user/device association | API Ready | `POST /user/onesignal` | Prefer official API after auth model verified |
| Account deletion | API Ready | `POST /user/delete` | Must remain accessible in app |
| Blocked users | API Ready | `GET /user/blocked` | Local settings/safety candidate |
| File/media upload | API Ready | multipart `POST /data/upload` with `file`, `name`, `guid`, type/handle | Local chat photo upload implemented |
| Delete uploaded file | API Ready | `POST /data/delete` | Reusable service |
| Content reporting | API Ready | `POST /data/report` | Local safety feature candidate |
| Realtime counter reset | API Ready | `POST /data/reset` | Use as required |
| New people/discovery subset | API Ready | `GET /data/load?get=new_people...` | Limited discovery support only |
| Conversations | API Ready / UI Work | `GET /chat/conversations` with `offset` / `has_more` | Local API-driven list implemented; runtime validation pending |
| Conversation details | API Ready / UI Work | `GET /chat/conversation` | Local messaging migration candidate |
| Delete/leave conversation | API Ready / UI Work | delete + leave routes | Local messaging migration candidate |
| Messages | API Ready / UI Work | `GET /chat/messages` offset history, `POST /chat/message`, delete message | Local send, photo attachment and older-history paging implemented; runtime validation pending |
| Typing state | API Ready / UI Work | typing action | Local messaging migration candidate |
| Seen/read state | API Ready / UI Work | seen action | Local messaging migration candidate |
| Message reactions | API Ready / UI Work | react + who-reacts | Local messaging migration candidate |
| Chat contacts | API Ready / UI Work | `GET /chat/contacts` with `offset` / `has_more` | Local contact picker and paging implemented; runtime validation pending |
| Calls data | Partial / Audit Required | `GET /chat/calls` | Existing call UI first; native/local call architecture separate |
| Full current-user/profile retrieval | Not API Ready — confirmed | Signin/bootstrap return a secured summary; no dedicated profile-read route | Use local summary; retain deeper profile web-backed |
| Full profile editing | Not API Ready — confirmed | User module exposes connect, image deletion, OneSignal, delete and blocked only; no profile-update route | Retain web-backed v1 |
| Notification list | API Ready / documented minimal adapter | `GET /notifications` delegates to Sngine notification retrieval | Local initial list implemented. The adapter does not emit `has_more`; do not add client paging until live response behavior is verified or a minimal adapter contract is approved. |
| Main timeline/feed | Not API Ready — confirmed | Full fresh-module audit found `/data/load?get=new_people` only; no timeline route | **Retained web module for v1** |
| Post CRUD | Not API Ready — confirmed | No official posts module/route in fresh API subsystem | **Retained web module for v1** |
| Non-chat comments/reactions | Not API Ready — confirmed | No official non-chat comment/reaction route | **Retained web module for v1** |
| Friends/follow graph retrieval | Not API Ready — confirmed | `POST /user/connect` exists, but no relationship-list/read route | Retain web-backed v1; use action only if a contained future UI needs it |
| Groups | Not API Ready — confirmed | `app/user_groups` is account-plan metadata, not social groups; no group route | **Retained web module for v1** |
| Pages | Not API Ready — confirmed | Static/legal page routes exist, but no social-pages API | **Retained web module for v1** |
| Search | Not API Ready — confirmed | No official social/global-search route | **Retained web module for v1** |
| Full privacy/settings | Partial / Audit Required | blocked/delete/static/app settings exist | Local shell + controlled web fallback |

## Authentication transport — confirmed

The fresh Sngine API authentication model is now understood:

- `POST /auth/signin` calls Sngine `sign_in(..., from_web=false, device_info)`;
- Sngine creates a normal server-side user session and returns a signed JWT plus secured user data;
- the JWT payload contains `uid` and the server session token;
- subsequent API requests can authenticate through `x-auth-token`;
- `User::__construct()` decodes `x-auth-token` with `system_jwt_key` and verifies the embedded session token against `users_sessions`;
- logout invalidates the underlying Sngine session through the official signout flow.

### Important API-secret finding

The stock fresh API also requires every request to pass `valid_api_request()`, which checks:

- `x-api-key`;
- a timestamp no older than five minutes;
- an HMAC SHA-256 signature produced using `system_api_secret`.

A mobile application must **not embed `system_api_secret` in its bundle** because it can be extracted from a distributed client.

To preserve Sngine's official routes without shipping the server API secret, `sngine-fresh` now contains a first-party ChatPalez mobile adapter in `apis/php/utils/functions.php` (backend commit `8233cfd9...`). It keeps Sngine's original HMAC path for server-to-server callers and additionally allows:

- selected public auth/bootstrap endpoints for requests marked `x-mobile-client: chatpalez-mobile-v1`;
- protected requests only when a valid signed Sngine JWT is supplied as `x-auth-token`.

The normal `User` construction still performs the definitive user/session validation.

## Local ↔ retained-web session bridge

`sngine-fresh` also contains `mobile-session.php` (backend commit `376c2dc8...`). Its intended role is:

1. receive a POST from the official mobile client;
2. validate the Sngine JWT server-side;
3. create Sngine's standard web session cookies (`c_user`, `xs`, `user_jwt`);
4. redirect only to a trusted internal path.

This avoids putting a JWT into a URL and gives the progressive-hybrid app a path for authenticated transitions into retained web modules. Client wiring still requires runtime validation and is not yet marked complete.

## Confirmed source files

- `apis/php/index.php`
- `apis/php/routes/modules.php`
- `apis/php/modules/auth/router.php`
- `apis/php/modules/auth/controller.php`
- `apis/php/modules/app/router.php`
- `apis/php/modules/user/router.php`
- `apis/php/modules/data/router.php`
- `apis/php/modules/data/controller.php`
- `apis/php/modules/chat/router.php`
- `apis/php/modules/chat/controller.php`
- `apis/php/utils/functions.php`
- `includes/class-user.php`
- `includes/traits/chat.php`
- `mobile-session.php` (ChatPalez adapter)

## Messaging decision

Messaging is now an **API-driven migration candidate**, not a permanent WebView feature. The official chat API covers conversations, message retrieval/send/delete, typing, seen state, reactions, contacts and calls history. `chatpalez_mobile/develop` now contains `src/api/chat.ts` as the typed messaging service foundation.

The existing web messaging UI remains a fallback until the local conversation/message UI is runtime-accepted. The local source now covers conversation/contact paging, offset-based older message history, text/photo send, typing/seen, reactions, leave/delete and own-message deletion. These use existing official chat/data routes only.

## Update rule

Whenever a new official endpoint is confirmed or a missing capability is proven, update this matrix and the corresponding implementation checkpoint/backlog immediately. Do not rely on conversational memory.


## Resolution — custom-extension admission rule (2026-09-16)

The official Sngine API is the default implementation surface. A custom backend extension is permitted only after the matrix records the exact official-route/function audit and proves that it cannot safely meet the requirement.

| Need | Decision |
|---|---|
| Mobile UI API adapter | Client-side only; call official Sngine routes. |
| OneSignal association | Use official `POST /user/onesignal`; no custom identity endpoint. |
| Signup/onboarding/chat/account actions/uploads/reporting | Use confirmed official API routes. |
| Feed/posts/groups/pages/search with unproven coverage | Retain web-backed v1; do not invent broad custom APIs. |
| Mobile access to API requiring `system_api_secret` | A minimal isolated server-side boundary may be justified because the secret cannot ship in the app. Audit/isolate/document it. |
| JWT to ordinary Sngine web session for retained web modules | A minimal backend bridge may be justified because the official API does not provide this transition. Audit/isolate/document it. |
| App-specific web presentation | Duplicate theme only; not part of API/JWT bridge code. |

Every retained exception must be entered in the upgrade-customization register with its upstream dependency and retest procedure.


## Feed/Home decision — completed official-route audit (2026-09-16)

The fresh API route inventory is limited to the app, auth, chat, data, monetization, and user modules. The data controller implements only GET /data/load?get=new_people; it does not expose timeline loading. No official posts module exists, and no feed/post/comment/reaction/group/social-page/search contract was found in that subsystem.

**Decision:** retain Home/feed, composer, non-chat engagement, groups, pages and search as controlled web modules for v1. The local Home screen remains the app-owned entry point and opens the existing feed through the already implemented POST-only JWT-to-web session bridge. This is a deliberate API-first/upgradable decision, not a missing implementation. No custom backend endpoint is authorized for these surfaces unless a future fresh-Sngine audit finds a supported extension point and the upgrade-customization register records a new exception.


## Profile/social-graph audit — completed (2026-09-16)

The fresh user module router/controller was reviewed in full. It exposes connect action, avatar/cover deletion, OneSignal association, account deletion, and blocked-user retrieval only. No dedicated profile-read, profile-update, follower/friend list, or relationship-read contract exists. The existing local account summary remains appropriate, while deeper profile editing and social-graph pages remain controlled web modules for v1.


## API implementation completion boundary (2026-09-17)

All currently justified mobile API client work is implemented in source and covered by contract tests: authentication/recovery, registration/onboarding, chat, multipart photo upload, user blocking/deletion/OneSignal association, notifications, page metadata and authenticated transport. No further backend API is authorized at this boundary. The next work is deployed Android/iOS acceptance of these contracts and protected retained-web modules; only a new fresh-Sngine audit can reopen the custom-API decision.


## API hardening follow-up (2026-09-17)

The selected v1 service audit is source-complete: sign-in, two-factor completion, sign-out, activation reset, transport headers/error handling/multipart behavior, user blocking pagination, deletion, OneSignal association, notifications and uploads now have contract coverage. Blocked-user `has_more` is preserved through the local Settings UI.

Direct conversation lookup, call history, reaction-viewer and unreact are intentionally deferred because no selected v1 screen requires them. Notification pagination remains a runtime/backend-contract gate: the existing minimal adapter accepts pagination inputs but does not return `has_more`.
