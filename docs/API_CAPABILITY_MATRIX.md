# ChatPalez Mobile — Sngine API Capability Matrix

**Reference backend repo:** `justyce2/chatpalez-backend-2`  
**Reference branch:** `sngine-fresh`  
**API root in source:** `apis/php/`  
**Status date:** 2026-09-15

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
| Sign in | API Ready | `POST /auth/signin` | Local/API-driven |
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
| File/media upload | API Ready | `POST /data/upload` | Reusable by local profile/chat/media flows |
| Delete uploaded file | API Ready | `POST /data/delete` | Reusable service |
| Content reporting | API Ready | `POST /data/report` | Local safety feature candidate |
| Realtime counter reset | API Ready | `POST /data/reset` | Use as required |
| New people/discovery subset | API Ready | `GET /data/load?get=new_people...` | Limited discovery support only |
| Conversations | API Ready / UI Work | `GET /chat/conversations` | Local messaging migration candidate |
| Conversation details | API Ready / UI Work | `GET /chat/conversation` | Local messaging migration candidate |
| Delete/leave conversation | API Ready / UI Work | delete + leave routes | Local messaging migration candidate |
| Messages | API Ready / UI Work | `GET /chat/messages`, `POST /chat/message`, delete message | Local messaging migration candidate |
| Typing state | API Ready / UI Work | typing action | Local messaging migration candidate |
| Seen/read state | API Ready / UI Work | seen action | Local messaging migration candidate |
| Message reactions | API Ready / UI Work | react + who-reacts | Local messaging migration candidate |
| Chat contacts | API Ready / UI Work | `GET /chat/contacts` | Local messaging candidate |
| Calls data | Partial / Audit Required | `GET /chat/calls` | Existing call UI first; native/local call architecture separate |
| Full current-user/profile retrieval | Partial / Audit Required | Some user/app data exists; complete read contract not yet mapped | Audit before local profile completion |
| Full profile editing | Partial / Audit Required | Some user endpoints exist | Audit before implementation |
| Notification list/read state | Not Yet Proven | No complete route set confirmed yet | Audit; web-backed fallback allowed |
| Main timeline/feed | Not Yet Proven | `/data/load` currently confirmed only for `new_people` | Web-backed v1 unless further routes found |
| Post CRUD | Not Yet Proven | Not yet confirmed in official modules inspected | Web-backed v1 unless found |
| Non-chat comments/reactions | Not Yet Proven | Not yet confirmed | Web-backed v1 unless found |
| Friends/follow graph retrieval | Partial / Audit Required | connect action exists; retrieval coverage not fully mapped | Audit |
| Groups | Not Yet Proven | app metadata has user groups but social group feature routes not proven | Web-backed v1 allowed |
| Pages | Not Yet Proven | no complete page API confirmed | Web-backed v1 allowed |
| Search | Not Yet Proven | no complete search API confirmed | Web-backed v1 allowed |
| Full privacy/settings | Partial / Audit Required | blocked/delete/static/app settings exist | Local shell + controlled web fallback |

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
- `apis/php/utils/functions.php`

## Authentication transport still to verify

Before the mobile API client commits to a storage strategy, trace the exact successful `sign_in()` return and subsequent authenticated-request mechanism.

Already known:

- all API requests pass `checkAPIRequest()` / `valid_api_request()`;
- protected endpoints require the Sngine user context to be logged in;
- public bootstrap/auth routes are explicitly excluded from user-auth enforcement;
- API response envelopes are standardized.

Still required:

- exact API-key request format/headers expected by `valid_api_request()`;
- exact signin response structure;
- session cookie and/or token issued after signin;
- persistence/renewal behavior;
- logout invalidation behavior;
- how to maintain auth when moving into a retained web-backed module.

Do not implement ad-hoc token or cookie injection before this is known.

## Messaging decision

Messaging should now be treated as an **API-driven migration candidate**, not automatically as a permanent WebView feature. The official chat API is broad enough to justify a local client after the common auth/API service layer is complete.

For schedule safety, the existing web messaging UI remains the v1 fallback until the local chat experience is runtime-accepted.

## Update rule

Whenever a new official endpoint is confirmed or a missing capability is proven, update this matrix and the corresponding `BACKLOG.md` task immediately. Do not rely on conversational memory.