# ChatPalez Mobile — Three-Layer Hybrid Waterfall Plan

**Status:** Active / authoritative implementation plan  
**Mobile repository:** `justyce2/chatpalez_mobile` (`develop`)  
**Backend repository:** `justyce2/chatpalez-backend-2` (`sngine-fresh`)  
**Architecture decision date:** 2026-09-21  
**Automation constraint:** GitHub Actions remain disabled. Do not create, enable or trigger Actions.

---

## 1. Architecture Decision

ChatPalez Mobile will use a three-layer hybrid architecture.

### Layer 1 — Native application shell and API-driven screens
The following belong to the application and must remain local/native-feeling:

- startup/offline/error states;
- login, registration, activation, onboarding, recovery and 2FA;
- authenticated top bar;
- hamburger/menu toggle;
- slide-out application drawer;
- five-item bottom navigation;
- account/menu interface;
- Messages;
- Notifications;
- Profile/account summary;
- Settings;
- native push controls;
- blocked users;
- account deletion;
- device lifecycle/deep links/share/external-link handling;
- feed and other social screens whenever a safe API contract is available.

Native controls may reuse the same icons, typography, spacing, shapes and information architecture as the mobile website, but they must not simply load the website header/footer/navigation.

### Layer 2 — Dedicated app API adapters
Prefer existing Sngine business logic and expose only the minimum mobile endpoints needed to render native screens.

Rules:

1. Reuse Sngine methods and permissions rather than reimplementing social-network rules.
2. Keep API payloads narrow and mobile-specific.
3. Do not expose server secrets.
4. Preserve privacy, moderation, package and membership checks already enforced by Sngine.
5. Add APIs progressively for high-value screens.
6. A missing API is not permission to replace the entire native shell with a website page.

Current custom mobile feed endpoint:

- `GET /apis/php/mobile/feed`
- views: newsfeed, popular, discover, saved, scheduled, memories.

### Layer 3 — Dedicated retained-web app theme
Create a separate theme, provisionally:

`content/themes/chatpalez_app/`

It is used only for official app fallback content that cannot yet be represented safely/practically through an API.

The app theme must:

- be selected only for official ChatPalez mobile-app requests;
- remain separate from `content/themes/default`;
- remove the normal website header;
- remove website bottom navigation;
- remove website footer/copyright;
- remove duplicate desktop/mobile sidebars and floating widgets;
- remove app-store banners and duplicate account controls;
- preserve the useful page/content markup and upstream business logic;
- render content in a shell-friendly layout;
- remain upgrade-isolated and recorded in the customization register.

The dedicated theme is a fallback content layer, not the application shell.

---

## 2. Non-Negotiable UX Rules

1. Native top bar stays visible on normal native screens.
2. Native bottom five-item bar stays visible on normal native screens.
3. Hamburger drawer is an app-owned native panel.
4. Menu is not merely Profile; it is an app-owned account/menu interface.
5. No page may render a second website header/footer over the native shell.
6. No website copyright/footer should appear inside app content.
7. Login/sign-up/recovery/2FA screens must fit the device viewport without blank overscroll above/below.
8. Long authentication/onboarding forms may scroll internally, but the screen itself remains pinned to the viewport.
9. Retain all working native/API features unless a specific regression requires replacement.
10. Web fallback is used only when the feature cannot yet be supported natively/API-first.

---

## 3. Waterfall Execution Order

A phase is not considered complete until its acceptance criteria are met. Later phases may be prepared, but implementation priority follows this order.

### PHASE 0 — Baseline and documentation

| ID | Task | Status | Acceptance |
|---|---|---|---|
| H0-01 | Record approved three-layer architecture | Completed | This document exists and is authoritative |
| H0-02 | Mark older web-backed-v1 decisions as superseded | Completed | Existing backlog points to this document |
| H0-03 | Preserve existing working native/API features | In Progress | No deliberate removal of auth/chat/notifications/settings/etc |
| H0-04 | Record current known regressions | Completed | Feed 404, duplicate web chrome, Menu=Profile, auth viewport overscroll documented |

Known regressions at start:

- live feed endpoint may return 404 until backend `sngine-fresh` deployment includes the mobile route;
- Pages/Groups and other retained-web routes render unwanted website footer/widgets;
- Menu currently maps directly to Profile;
- auth/signup screens can overscroll and expose empty space;
- unsupported web routes can replace the native shell if opened as full-page navigation.

### PHASE 1 — Native shell and viewport foundation

| ID | Task | Status | Acceptance |
|---|---|---|---|
| H1-01 | Fix login viewport pinning | Testing | Login fills device viewport; no blank top/bottom overscroll |
| H1-02 | Fix signup/activation/onboarding viewport behavior | Testing | Long forms scroll inside viewport; no document bounce gap |
| H1-03 | Fix password recovery/2FA viewport behavior | Testing | Same viewport contract as login |
| H1-04 | Stabilize native top bar | Testing | App-owned header, correct icons/spacing/safe area |
| H1-05 | Stabilize native hamburger drawer | Testing | Smooth slide-in/out; app-owned; no web offcanvas duplicate |
| H1-06 | Stabilize five-item bottom navigation | Testing | Home, Reels/Watch, Add, Search, Menu; correct active state |
| H1-07 | Replace Menu→Profile shortcut with account/menu interface | Testing | Native menu includes Profile, Settings, Saved, notifications controls, legal, logout |
| H1-08 | Define native-shell navigation state | Testing | Back/navigation keeps shell stable and predictable |
| H1-09 | Ensure no full-page fallback destroys shell silently | Testing | Fallback paths are explicit and controlled |

### PHASE 2 — Core API/native content surfaces

| ID | Task | Status | Acceptance |
|---|---|---|---|
| H2-01 | Deploy/validate `/mobile/feed` | Planned | Authenticated app receives feed JSON; no 404 |
| H2-02 | Native News Feed | Testing | Feed cards render from API inside native shell |
| H2-03 | Native Popular/Discover/Saved/Scheduled/Memories | Testing | Drawer feed variants work without full website navigation |
| H2-04 | Native post detail foundation | Testing | Post can open without losing native shell |
| H2-05 | Add post reactions/comments API audit | Testing | Decide native vs app-theme fallback per action |
| H2-06 | Native Search API | Testing | Search results render in shell |
| H2-07 | Native People/friend requests API | Testing | People and requests no longer require full website chrome |
| H2-08 | Native Pages list/detail API | Testing | Page list/detail render in shell where practical |
| H2-09 | Native Groups list/detail API | Testing | Group list/detail render in shell where practical |
| H2-10 | Native Events list/detail API | Testing | Events render in shell where practical |
| H2-11 | Native Reels API | Testing | Reels surface renders in app-owned experience |
| H2-12 | Native Watch/video API audit | Testing | Native implementation where practical |

Existing working native surfaces to retain:

- Messages and conversations;
- contact search/new conversation;
- message history/pagination;
- chat photos;
- typing/seen;
- message reaction/delete/leave conversation;
- Notifications;
- Profile/account summary;
- Settings;
- push permission control;
- blocked users;
- account deletion.

### PHASE 3 — Dedicated `chatpalez_app` retained-web theme

| ID | Task | Status | Acceptance |
|---|---|---|---|
| H3-01 | Create upgrade-isolated `chatpalez_app` overlay theme | Testing | Separate upgrade-isolated theme exists |
| H3-02 | Add official-app theme selection | Testing | App UA selects app theme; normal website remains default |
| H3-03 | Strip app-theme website header | Testing | No duplicate top navigation |
| H3-04 | Strip app-theme website bottom bar | Testing | No duplicate bottom navigation |
| H3-05 | Strip footer/copyright/app badges | Testing | Content ends cleanly |
| H3-06 | Strip duplicate sidebars/widgets | Testing | No overlay against native shell |
| H3-07 | Normalize app-theme content spacing | Testing | Content fits between native bars |
| H3-08 | Preserve upstream content functionality | Testing | Forms/actions/business logic still work |
| H3-09 | Register customization/upgrade diff | Completed | All theme deviations documented |

### PHASE 4 — Controlled fallback integration

| ID | Task | Status | Acceptance |
|---|---|---|---|
| H4-01 | Define shell-safe retained-content container | Testing | Fallback content does not permanently replace native shell |
| H4-02 | Session continuity for fallback content | Testing | JWT→web cookie bridge remains secure |
| H4-03 | Route unsupported actions to app theme | Testing | Only unsupported functionality uses fallback |
| H4-04 | Suppress native/web duplicate controls | Testing | One header, one drawer, one bottom bar |
| H4-05 | External URL handling | Testing | External destinations leave app safely |
| H4-06 | Android back behavior across fallback content | Testing | Back returns through app navigation correctly |
| H4-07 | Deep links/push links | Testing | Trusted routes open correct native/fallback surface |

### PHASE 5 — Profile, account and creation expansion

| ID | Task | Status | Acceptance |
|---|---|---|---|
| H5-01 | Expand native account menu | Testing | Full mobile account navigation |
| H5-02 | Native profile detail/edit API audit | Testing | Native where supported; app-theme fallback otherwise |
| H5-03 | Native privacy/settings expansion | Testing | Common account controls local/API driven |
| H5-04 | Native Create menu | Testing | App-owned action sheet/grid mirrors website capabilities |
| H5-05 | Post composer API implementation/audit | Testing | Native composer where safe |
| H5-06 | Page/Group/Event creation | Testing | Native API or stripped app-theme fallback by complexity |
| H5-07 | Legal/safety/account-deletion links | Testing | Accessible from native account menu |

### PHASE 6 — Device validation, compliance and release

| ID | Task | Status | Acceptance |
|---|---|---|---|
| H6-01 | Android full regression | Planned | Auth/shell/feed/chat/fallback/device actions pass |
| H6-02 | iOS full regression | Planned | Same |
| H6-03 | Offline/cold-start/session-expiry regression | Planned | Recoverable and no shell corruption |
| H6-04 | Keyboard/safe-area/edge-to-edge pass | Planned | No clipped/blank/bouncing layouts |
| H6-05 | Push/deep-link regression | Planned | Correct destination and identity lifecycle |
| H6-06 | Google Play compliance review | Planned | Privacy/deletion/UGC/app-access requirements satisfied |
| H6-07 | App Store compliance review | Planned | Privacy/deletion/reviewer/signing requirements satisfied |
| H6-08 | Release build checklist | Planned | AAB/iOS archive inputs complete |
| H6-09 | Final upgrade-customization register | Planned | All backend/theme modifications documented |

---

## 4. Navigation Ownership Matrix

| Surface | Owner |
|---|---|
| Top bar | Native app |
| Hamburger toggle | Native app |
| Drawer | Native app |
| Bottom five items | Native app |
| Account/Menu interface | Native app |
| Login/Signup/2FA/Recovery | Native/API |
| Messages | Native/API |
| Notifications | Native/API |
| Profile summary | Native/API |
| Settings | Native/API |
| Feed | Native/API |
| Popular/Discover/Saved/Scheduled/Memories | Native/API |
| Pages/Groups/Events/Reels/Search | Native/API progressively |
| Complex unsupported feature content | `chatpalez_app` fallback theme |
| Normal public website | Existing default theme |

---

## 5. Acceptance Gate for Phase 1

Do not start broad app-theme customization until all of the following are true:

- login/signup/recovery/2FA screens are viewport-correct;
- native top bar is stable;
- hamburger drawer is stable;
- bottom five items are stable;
- Menu opens a real native account/menu interface;
- navigation does not accidentally replace the whole shell;
- existing native chat/notifications/profile/settings still work in source.

---

## 6. Required Manual/Server Checks

These are not reasons to stop implementation, but must be called out for runtime acceptance:

1. Pull latest `sngine-fresh` on the live ChatPalez backend.
2. Verify `apis/php/modules/mobile/controller.php` and `router.php` exist.
3. Verify `apis/php/routes/modules.php` loads the mobile router.
4. Test authenticated `/apis/php/mobile/feed` from an installed app.
5. Rebuild mobile bundle before every `npx cap sync android`.
6. Preserve existing Play package ID and signing lineage.
7. GitHub Actions remain disabled.

---

## 7. Current Work Pointer

**Current phase:** PHASE 4/5 — retained-content integration hardening and native account/settings expansion (source implementation in Testing pending device acceptance).  
**Next task:** close remaining H4 retained-route/session/deep-link regression items, then perform Android/iOS acceptance of the native account/profile/settings surfaces and account switching.  
**Parallel testing gate:** deploy latest `sngine-fresh` and verify native feed/community/search/people/reels/watch/post/community detail, native text-post creation, native account/profile/privacy settings, deep/push routing, retained history/back behavior, and `chatpalez_app` fallback rendering.

This document supersedes older implementation notes that stated feed/groups/pages/search must remain full retained-web surfaces for v1. Those historical decisions remain useful context, but this document governs implementation from 2026-09-21 onward.


### Source checkpoint — 2026-09-21 (retained navigation + appearance)

Implemented on mobile `develop`:

- retained iframe bridge messages are now accepted only from the active retained frame window and the configured trusted origin;
- retained paths are origin-normalized before history entry and retained navigation history is capped;
- leaving retained content now clears the active retained frame window reference as well as frame/history state;
- native account Menu no longer routes Appearance to generic web settings;
- app-owned Appearance now supports **Use device setting**, **Day mode**, and **Night mode**;
- native shell night-mode styles were added without changing the retained website theme contract;
- Switch Accounts now has a dedicated native entry surface and continues through the JWT-to-first-party-web-session bridge without placing the mobile JWT in the URL.

Commits:

- `b32ef5f` — retained navigation hardening + native account appearance/switch entry;
- `105493e` — native day/night appearance styles.

Remaining Switch Accounts work is the actual account-list/switch API contract. Until that backend contract exists, the native Switch Accounts surface deliberately hands off to the authenticated first-party switcher rather than collecting/storing secondary account credentials in the app.

GitHub Actions remain disabled and were not triggered.


### Source checkpoint — 2026-09-21 (native Switch Accounts)

Implemented across backend `sngine-fresh` and mobile `develop`:

- mobile endpoint lists only identities belonging to the authenticated Sngine connected-account family;
- switching validates the target against Sngine's existing connected-account relationship;
- a successful switch creates a fresh device-bound API JWT/session for the selected account;
- the old mobile API session is deleted after the replacement session has been created;
- the app stores the replacement token only through the existing protected native session store;
- the native shell remounts under the switched identity and native push identity is reinitialized;
- the current account is marked and cannot be redundantly selected;
- connecting a brand-new account remains on the authenticated first-party Sngine flow so password/2FA handling is not duplicated insecurely in the mobile client.

Backend commits:

- `a6477f5` — native connected-account listing/session-switch contract;
- `da076ff` — mobile connected-account routes;
- `5b9630a` — redundant self-switch rejection.

Mobile commits:

- `43e5222` — connected-account API client;
- `d4e5744` — native session rotation and identity remount;
- `beb2cd8` — native connected-account picker;
- `b630ffc` — connected-account picker styles.

Runtime acceptance still requires the latest backend `sngine-fresh` deployment before testing Switch Accounts on-device. GitHub Actions remain disabled and were not triggered.
