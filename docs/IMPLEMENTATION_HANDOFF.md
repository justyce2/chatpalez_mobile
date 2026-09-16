# ChatPalez Mobile — Progressive Hybrid Implementation Handoff

**Status date:** 2026-09-15  
**Primary mobile repository:** `justyce2/chatpalez_mobile`  
**Working branch:** `develop`  
**Backend repository:** `justyce2/chatpalez-backend-2`  
**Backend production/default branch:** `master`  
**Fresh upstream/reference branch:** `sngine-fresh`  
**Production site:** `https://chatpalez.com`  
**Android package / intended iOS bundle ID:** `com.chatpalez`  
**Architecture:** Progressive hybrid — Capacitor + local/API-driven screens + retained controlled web modules

---

## 1. Why this document exists

This document is the session-independent handoff for ChatPalez Mobile. A developer or AI session that has not seen the previous conversation should be able to read this file together with `ARCHITECTURE_AND_SCOPE.md` and `BACKLOG.md`, understand the approved architecture, know what has already been implemented, and continue from the next task without re-litigating earlier decisions.

If this document conflicts with an older conversational assumption, this document and the current repository state take precedence.

---

## 2. Approved product direction

Do **not** build ChatPalez as a simple full-screen website wrapper and do **not** start a full native/API rewrite of the entire social network.

The approved model is **progressive hybrid**:

1. Capacitor provides the Android/iOS native projects and native device services.
2. High-visibility app surfaces are local/mobile-first and consume the official Sngine API where possible.
3. Complex or lower-priority features may remain web-backed for the first release.
4. Web-backed areas must open as destinations from the local app shell; they must not define the whole application shell.
5. Existing official APIs must be used before adding custom backend endpoints.
6. Backend/template modifications are a last resort for proven gaps only.

The goal is a submission-ready first release within the existing two-week engineering target, while making the installed app visibly and behaviorally different from opening `chatpalez.com` in Safari.

---

## 3. Source-of-truth documents

Read these in this order before implementation:

1. `docs/IMPLEMENTATION_HANDOFF.md` — current state and exact continuation point.
2. `docs/ARCHITECTURE_AND_SCOPE.md` — architecture, principles, migration policy and definition of done.
3. `docs/BACKLOG.md` — task-level implementation/status tracker.
4. `docs/APP_STORE_COMPLIANCE.md` — UGC/privacy/store requirements.
5. `docs/AUTH_SESSION_AUDIT.md` — earlier web-session review; some assumptions must now be reconciled with API auth.
6. `docs/PLATFORM_SUPPORT.md` — Android/iOS support policy.
7. `docs/RELEASE_CHECKLIST.md` and `docs/RELEASE_INPUTS.md` — release gates/external inputs.
8. `docs/RUNTIME_QA_MATRIX.md` — runtime acceptance matrix.

When work changes architecture, implementation state, blockers or dependencies, update this handoff and `BACKLOG.md` in the same work session.

---

## 4. Repository/branch rules

### Mobile

Repository: `justyce2/chatpalez_mobile`

- `develop` is the active implementation branch.
- `main` is the release/merge target.
- Existing mobile PR #1 is a draft and must not be treated as release-ready until runtime/release gates are satisfied.

### Backend

Repository: `justyce2/chatpalez-backend-2`

- `master` contains the current ChatPalez backend plus an earlier merged mobile compatibility bridge.
- `sngine-fresh` is the clean fresh Sngine release/reference branch and is the authoritative reference for the newer official API subsystem.
- **Do not merge `sngine-fresh` blindly into `master`.** It is currently a reference/upstream branch. An Sngine upgrade must be handled as a deliberate migration because ChatPalez has existing production data, configuration and customizations.

### GitHub Actions

Project-owner instruction: **GitHub Actions are disabled.** Workflow files previously added to the mobile/backend repositories were removed. Do not recreate or enable Actions unless the project owner explicitly requests it.

Validation is manual/local or through explicitly approved tooling.

---

## 5. Important previous backend change

An earlier mobile-integration PR was squash-merged into backend `master` as commit:

`2bc948816e2890df8e08c581760f8c272f710bd2`

It added compatibility support for the earlier WebView-heavy approach: official-mobile user-agent detection, app-only bridge script loading, OneSignal/native UI bridge support and mobile diagnostics.

Architecture has since changed. Treat that work as **compatibility support for retained web-backed modules**, not as the preferred implementation model for new mobile screens.

Do not keep extending Smarty/templates simply to make web screens look native when an official API can support a local screen.

---

## 6. Confirmed Sngine fresh API subsystem

The `sngine-fresh` branch contains a dedicated API stack under:

`apis/php/`

The API entry point is:

`apis/php/index.php`

It initializes Sngine, validates API requests, creates the user context, performs authentication checks and mounts the API routers.

Module registry:

`apis/php/routes/modules.php`

Confirmed modules:

- `app`
- `auth`
- `data`
- `monetization`
- `user`
- `chat`

This is separate from the older top-level `api.php`, which is much narrower and should not be used as the basis for judging current API capability.

---

## 7. Confirmed API capability matrix

### Authentication — API Ready

Source: `apis/php/modules/auth/router.php` and `controller.php` on `sngine-fresh`.

Confirmed endpoints:

- `POST /auth/signup`
- `POST /auth/activation`
- `POST /auth/activation_resend`
- `POST /auth/activation_reset`
- `POST /auth/getting_started_update`
- `POST /auth/getting_started_finish`
- `POST /auth/signin`
- `POST /auth/two_factor_authentication`
- `POST /auth/signout`
- `POST /auth/forget_password`
- `POST /auth/forget_password_confirm`
- `POST /auth/forget_password_reset`

Sign-in expects mobile device information including device type, OS/version and device name. This strongly supports a purpose-built mobile client.

### Application/bootstrap metadata — API Ready

Confirmed endpoints include:

- `GET /app/settings`
- `POST /app/contact_us`
- `GET /app/static_pages`
- `GET /app/static_pages/:page_url`
- `GET /app/genders`
- `GET /app/user_groups`
- `GET /app/languages`
- `GET /app/countries`
- `GET /app/custom_fields`
- `GET /app/categories`

### User/account operations — API Ready / Partial

Confirmed endpoints:

- `POST /user/connect`
- `POST /user/image_delete`
- `POST /user/onesignal`
- `POST /user/delete`
- `GET /user/blocked`

This gives us account deletion, blocked-user retrieval and OneSignal identity update through the official API. Broader profile read/update coverage must still be mapped before declaring the entire profile feature API-complete.

### Data/uploads/safety — API Ready

Confirmed endpoints:

- `GET /data/load`
- `POST /data/upload`
- `POST /data/delete`
- `POST /data/reset`
- `POST /data/report`

`/data/upload`, `/data/delete`, realtime-counter reset and content reporting are available. Current confirmed `data/load` implementation exposes `new_people`; do not assume it is a general feed endpoint.

### Messaging/chat — Strong API coverage / migration candidate

Confirmed endpoints:

- `POST /chat/actions/typing`
- `POST /chat/actions/seen`
- `POST /chat/actions/leave`
- `POST /chat/reactions/react`
- `GET /chat/reactions/who_reacts`
- `GET /chat/conversations`
- `GET /chat/conversation`
- `DELETE /chat/conversation/:id`
- `GET /chat/messages`
- `POST /chat/message`
- `DELETE /chat/message/:id`
- `GET /chat/calls`
- `GET /chat/contacts`

**Decision:** Messaging is no longer assumed to be permanently web-backed. It is an official-API migration candidate. For schedule control, the existing web chat remains an acceptable fallback until the local/API chat client is implemented and validated.

### Feed/posts/notifications/profile/settings — coverage not yet fully proven

Do not invent endpoints. The currently confirmed route modules do not yet prove complete API coverage for:

- main timeline/feed retrieval;
- post CRUD;
- non-chat comments/reactions;
- full notifications list/read-state;
- full profile read/edit;
- all privacy/settings operations;
- groups/pages/search.

Before implementing any of those screens locally, inspect `sngine-fresh` further and classify each function as API Ready, API + Adapter, Minimal Backend Gap, or Web-backed for v1.

---

## 8. API request/auth behavior already confirmed

`apis/php/index.php` calls `checkAPIRequest()` for the official API layer. `apis/php/utils/functions.php` confirms:

- API key validation is required through Sngine's `valid_api_request()` logic.
- JSON request bodies are parsed centrally (upload is handled separately).
- public/auth/bootstrap endpoints are excluded from user-login enforcement.
- protected endpoints require `$user->_logged_in`.
- API responses use a consistent JSON envelope with `status`, optional `message`, `data`, optional `has_more`, and `timestamp`.

**Still to resolve before coding the final auth store:** determine exactly how successful `/auth/signin` establishes/returns the authenticated state used by subsequent API calls and how that state should be persisted by the Capacitor client. Do not invent cookie/token storage until this is verified from the fresh code/runtime.

---

## 9. First-release screen plan

### Must be local/native or API-driven for v1

- splash/startup shell;
- primary application shell/navigation;
- login and authentication flow;
- onboarding/activation flow as required by server settings;
- local settings shell for native permissions/account entry points;
- app-controlled loading/offline/error states;
- native push/deep-link/share/device behavior.

### High-priority API-driven candidates

- account/profile summary;
- notifications, once endpoints are confirmed;
- messaging/chat, because official chat API coverage is strong.

### Web-backed is acceptable for v1 when API coverage/effort is not proven

- main feed/timeline;
- post creation/media composer;
- comments/reactions outside chat;
- groups;
- pages;
- broad search/discovery;
- complex/specialized modules;
- audio/video calling UI until runtime behavior is validated.

A web-backed feature must be entered from the local app shell and must not replace the shell itself.

---

## 10. Current mobile implementation already present

The mobile repository already contains substantial Capacitor groundwork. Do not restart it.

Confirmed/previously implemented areas include:

- Capacitor 8 TypeScript/Vite foundation;
- Android and iOS native projects;
- package/bundle identity `com.chatpalez` in source;
- controlled production origin configuration;
- Android back/lifecycle/deep-link handling;
- custom `chatpalez://open` deep-link scheme on Android/iOS;
- trusted-origin/external-navigation policy;
- local loading/error/offline shell;
- OneSignal Capacitor SDK scaffolding;
- Share, AppLauncher, Keyboard and Haptics plugins;
- Android/iOS camera/microphone/photo permission declarations;
- iOS WKWebView navigation gesture configuration;
- production-safe bounded/redacted diagnostics;
- build/release metadata tooling;
- security/compliance/release documentation.

Many of these items remain in `Testing` because device/runtime acceptance has not yet been completed.

---

## 11. Current external blockers

These are not reasons to stop implementation of local/API screens. Mark work that truly depends on them as Blocked/Awaiting response and continue elsewhere.

- Apple Developer team / App Store Connect access.
- Final confirmation/ownership of iOS `com.chatpalez` bundle ID.
- APNs configuration.
- Firebase/FCM configuration.
- OneSignal mobile platform configuration/access.
- Google Play upload/signing credentials.
- Highest existing Play Console `versionCode` for `com.chatpalez`.
- Final store-ready icon/splash artwork.
- Final privacy/support URLs/content verification.
- Physical iOS/Android device acceptance where needed.

Development Android `versionCode 1` and iOS build `1` are placeholders and must not be assumed valid for store updates.

---

## 12. Native push status

The OneSignal Capacitor SDK and related bridge work exist, but push delivery is **not yet proven**.

Do not claim Android or iOS push works until:

- FCM is configured for Android;
- APNs is configured for iOS;
- OneSignal platform configuration is complete;
- real test devices register;
- foreground/background delivery and notification-click routing are tested.

The fresh API's `/user/onesignal` endpoint is relevant and should be preferred for user/device association where it matches the mobile SDK identity model.

---

## 13. App Store positioning requirement

Capacitor itself is acceptable for App Store applications. The risk is a product that feels like the website with browser chrome removed.

Therefore:

- app startup/navigation must be app-owned;
- local high-visibility screens must be mobile-first;
- native push/share/deep-link/permissions/lifecycle behavior must be meaningful;
- retained web modules are secondary destinations;
- the app and Safari may share branding/content but should not have an identical shell and interaction model.

Do not undo this architecture merely because the responsive website already works.

---

## 14. Implementation order from this handoff

Continue in this order unless a concrete technical discovery forces a change:

### Step 1 — Finish API audit for v1 surfaces

Already confirmed: auth, app/bootstrap, user basics, upload/reporting and chat.

Still map:

- authenticated current-user/profile retrieval/update;
- notifications/read state;
- feed/timeline;
- posts/comments/reactions;
- settings/privacy;
- friends/follow graph;
- groups/pages/search.

Update the matrix in this file and `BACKLOG.md` immediately after discoveries.

### Step 2 — Verify exact auth transport/persistence

Trace successful `sign_in()` response and API request/session/token mechanics on `sngine-fresh`.

Document:

- required headers/API-key fields;
- login request fields;
- response fields;
- cookie/token returned;
- storage strategy in Capacitor;
- logout behavior;
- 2FA/activation branches;
- how local API auth can coexist with retained web-backed modules.

This is the next critical architecture gate.

### Step 3 — Implement typed mobile API client

In `chatpalez_mobile`, add a central API/service layer. It must own:

- base URL/API path;
- API request headers;
- auth persistence;
- JSON envelope handling;
- normalized errors;
- upload requests;
- request cancellation/timeouts where appropriate;
- typed auth/app/user/chat services.

Do not let UI components call raw endpoints directly.

### Step 4 — Build the local application/navigation shell

The installed app should open into local UI, not directly into the website.

Define mobile-first primary navigation and local routes. Retained web modules become destinations within this shell.

### Step 5 — Implement local authentication/onboarding

Use the official `/auth/*` API routes. Cover server-driven activation/2FA paths rather than hard-coding one login happy path.

### Step 6 — Implement account/profile/settings high-visibility surfaces

Use confirmed APIs. Where an API gap remains, link to a controlled web-backed screen rather than inventing broad custom backend work.

### Step 7 — Implement/migrate messaging if schedule allows

The fresh API already provides strong chat coverage. Prefer API-driven messaging if the remaining UI/realtime work fits the release window. Keep existing web messaging as the fallback path until local chat is validated.

### Step 8 — Decide feed migration

Only move feed/post flows locally if endpoint coverage and schedule justify it. Otherwise intentionally retain the web feed for v1.

### Step 9 — Runtime/device validation and release hardening

Validate auth continuity, local↔web navigation, push, deep links, uploads, safety/account flows, calls, offline states and store configuration.

---

## 15. Backend modification rules for the next implementer

Before editing `chatpalez-backend-2`:

1. Check `sngine-fresh` for an official endpoint/function first.
2. Check whether the requirement can be solved in `chatpalez_mobile`.
3. Keep web-backed functionality working in normal browsers.
4. Never use user-agent detection as authentication or authorization.
5. Never commit API secret, APNs key, Firebase service credentials, signing keystore or privileged server secrets.
6. Do not add a large parallel API surface when the fresh official API already exposes the operation.
7. If a minimal backend gap is genuinely required, document the reason and endpoint contract in this handoff/backlog before implementation.

---

## 16. Validation rule after GitHub Actions were disabled

Do not interpret missing GitHub checks as code failure. Actions were intentionally disabled.

For meaningful changes, perform the applicable manual checks instead:

- `npm test`;
- `npm run build`;
- TypeScript/build metadata validation;
- `npx cap sync android` / `npx cap sync ios`;
- Android Gradle debug/release compile where environment permits;
- Xcode/simulator build where a Mac environment is available;
- endpoint contract checks against an appropriate deployed API environment;
- device/runtime checks for native/plugin behavior.

Record actual checks performed; do not claim a platform/runtime passed when it has not been run.

---

## 17. Status discipline

Use the status model from `BACKLOG.md`:

- Planned — accepted, not started.
- In Progress — actively being implemented.
- Testing — implementation exists but runtime/integration/device acceptance remains.
- Completed — implementation plus applicable acceptance passed.
- Blocked — external dependency/input is required.
- Deferred — deliberately moved out of the initial release.

If the implementer has done everything possible for an item and needs the project owner/external account/device, mark it Blocked (equivalent to awaiting response) and continue with independent work.

---

## 18. Immediate continuation point

**Do not restart architecture planning.** The progressive hybrid decision is approved and the fresh Sngine API subsystem is confirmed.

The next implementer should begin with:

1. trace `sngine-fresh` auth request validation and `sign_in()` return/persistence model;
2. complete the remaining API capability matrix for profile, notifications, feed/posts and settings;
3. update `BACKLOG.md` so N-01 is Completed when the v1 matrix is sufficient;
4. move D-01/API-auth design into In Progress/Completed as evidence allows;
5. implement N-02 typed API/service layer in `chatpalez_mobile/develop`;
6. then implement N-03 local navigation shell and N-04 local login/onboarding.

Messaging may be migrated through official APIs after the auth/service layer because strong chat routes are already confirmed.

---

## 19. Key non-claims

At this handoff point, do **not** claim:

- production ChatPalez has been upgraded to the fresh Sngine API branch;
- `sngine-fresh` has been merged/deployed to production;
- the full feed/notifications/settings API coverage is proven;
- API/local authentication persistence is fully designed;
- Android/iOS native push delivery is working;
- final signed Android AAB exists;
- final signed iOS archive/TestFlight build exists;
- physical-device acceptance is complete;
- Apple/Google store approval is guaranteed.

These remain implementation/release work.

---

## 20. Handoff completion rule

At the end of each meaningful implementation block, update this file with:

- latest branch/commit references;
- what was implemented;
- what was verified;
- what remains unverified;
- newly discovered APIs/gaps;
- next exact task;
- external input required.

This prevents future sessions from depending on hidden conversational context.


---

## 21. API-first and upgrade-safe customization resolution (2026-09-16)

The project owner has confirmed the following decision before further implementation:

1. Audit the official Sngine API and existing Sngine server capability before every backend change.
2. Reuse official API routes, business logic and OneSignal integration whenever sufficient; the mobile TypeScript API adapter is client-side code, not a substitute backend API.
3. Do not retain or add a custom route simply because a local app screen needs data. If official coverage is incomplete, keep that feature web-backed for v1 unless a minimal, documented backend gap is genuinely required.
4. The only potential exceptions are an isolated server-side mobile access boundary that prevents disclosure of `system_api_secret`, and a JWT-to-standard-web-session bridge for deliberately retained web modules. Both are backend tools, never theme code, and must remain as small, documented and upgrade-retestable as possible.
5. Use official `POST /user/onesignal` for OneSignal association; no custom OneSignal identity endpoint without a proven incompatibility.
6. Preserve the untouched Sngine core/default theme. App-only retained-web presentation belongs in a separately named duplicate theme (for example, `chatpalez_mobile`), selected only for official mobile-app requests, never as the global browser theme.
7. Keep an upgrade-customization register for each retained custom backend extension: upstream dependency, proven gap, reason, contract, isolation location and upgrade/test procedure.

**Implementation gate:** complete and record the API-versus-custom audit before further backend modification. Re-audit the existing notification adapter and mobile bridge; remove or reduce any part covered by stock Sngine.
