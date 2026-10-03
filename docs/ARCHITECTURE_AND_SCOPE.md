# ChatPalez Mobile — Progressive Hybrid Architecture, Scope and Delivery Design

**Repository:** `justyce2/chatpalez_mobile`  
**Target platforms:** Android and iOS  
**Delivery model:** Progressive hybrid mobile application using Capacitor + selective ChatPalez APIs + retained web-backed modules  
**Existing platform:** ChatPalez PHP/Smarty social-network backend and mobile-responsive web experience  
**Target implementation window:** 2 weeks / 10 working days for a submission-ready first release

---

## 1. Purpose

This document is the technical and delivery source of truth for ChatPalez Mobile.

The approved direction is now a **progressive hybrid architecture**. ChatPalez Mobile will not be a simple full-screen wrapper around the mobile website, and it will not attempt a complete API-driven rewrite in the first release.

Instead, the application combines three layers:

1. **Native Capacitor capabilities** for device- and platform-level behavior.
2. **Local/API-driven mobile screens** for high-visibility app experiences that should clearly differ from Safari.
3. **Existing web-backed ChatPalez modules** for complex social-network functionality that would be too expensive or risky to rebuild during the initial delivery window.

The goal is to preserve the mature ChatPalez backend and working product features while making the installed application clearly behave and present itself as a mobile application rather than a repackaged website.

---

## 2. Architectural Decision

### 2.1 Approved model

The project will use a **progressive hybrid** model.

The first release should prioritize local/API-driven implementation for the most visible surfaces:

- splash/startup experience;
- authentication/login and onboarding where API coverage allows;
- main application shell;
- bottom-tab or equivalent primary navigation;
- notifications;
- profile/account summary;
- settings/account entry points.

More complex modules may continue to use the existing ChatPalez responsive web experience initially:

- full feed/post workflows if API implementation would exceed the delivery window;
- messaging/chat;
- groups;
- pages;
- search/discovery;
- complex media workflows;
- specialized modules;
- audio/video/calling until separately validated.

These web-backed modules remain migration candidates and can move to API-driven local UI incrementally after the first release.

### 2.2 Why this architecture

This direction balances four goals:

- **delivery speed:** we retain working social-network functionality;
- **App Store quality:** the installed app gains its own navigation, entry flow and native/local surfaces;
- **maintainability:** new mobile UI can consume APIs without forcing changes to the existing website;
- **migration flexibility:** web-backed modules can be replaced one-by-one instead of through a risky full rewrite.

### 2.3 Architecture rule

From this point forward:

> New high-visibility mobile screens should prefer local/API-driven implementation when existing ChatPalez APIs can support them safely. Backend/template modification should be a last resort, used only for a proven integration gap that cannot reasonably be solved in the mobile project or through existing APIs.

---

## 3. Current Platform Assessment

ChatPalez is a server-rendered PHP application using Smarty templates, Bootstrap and JavaScript. The backend already owns the system of record for users, content, social relationships, messaging, notifications, media and platform settings.

The existing responsive/mobile website remains valuable because it already implements a large amount of mature social-network behavior. However, using that responsive website as the entire visible app would leave the product too close to a browser experience.

The mobile implementation must therefore separate:

- the **native shell**;
- the **local mobile application UI**;
- the **API/service layer**;
- the **retained secure web-backed modules**;
- the **existing backend**, which remains authoritative.

Before implementing a local screen, the corresponding Sngine/ChatPalez API coverage must be audited. Existing APIs should be reused before any new backend endpoint is introduced.

---

## 4. Target Architecture

```text
+------------------------------------------------------------------+
|                     ChatPalez Android / iOS                      |
|                                                                  |
|  +------------------------------------------------------------+  |
|  | Capacitor Native Layer                                     |  |
|  | lifecycle | push | deep links | share | permissions        |  |
|  | camera/media | keyboard | haptics | status/splash          |  |
|  +-----------------------------+------------------------------+  |
|                                |                                 |
|  +-----------------------------v------------------------------+  |
|  | Local Mobile Application Shell                             |  |
|  | app navigation | bottom tabs | loading/error states        |  |
|  +-------------------+----------------------+-----------------+  |
|                      |                      |                    |
|        +-------------v-----------+   +------v----------------+  |
|        | API-driven local UI     |   | Secure Web Modules    |  |
|        | login/onboarding        |   | complex feed flows    |  |
|        | notifications           |   | messaging initially   |  |
|        | profile summary         |   | groups/pages/search   |  |
|        | settings                |   | calls/media as needed |  |
|        +-------------+-----------+   +-----------+-----------+  |
+----------------------+---------------------------+--------------+
                       | HTTPS / API               | HTTPS
                       v                           v
+------------------------------------------------------------------+
|                   Existing ChatPalez Backend                     |
| PHP / business logic / database / storage / social services      |
| Existing APIs + minimal new endpoints only where proven needed    |
+------------------------------------------------------------------+
```

---

## 5. Responsibility by Layer

### 5.1 Capacitor/native layer

Capacitor remains responsible for:

- Android/iOS project lifecycle;
- push notifications;
- deep links and app links;
- native share sheet;
- phone/email/app intents;
- camera/microphone/photo permissions;
- file/device integrations where needed;
- keyboard behavior;
- haptics;
- status bar and splash;
- app foreground/background events;
- OS-specific release configuration.

### 5.2 Local mobile UI layer

The local application should own the screens that most strongly establish the product as an installed app:

- startup/loading shell;
- login/onboarding where feasible;
- primary application navigation;
- notifications list/entry experience;
- profile/account summary;
- settings shell;
- native/local error and offline states.

These screens should have mobile-first interaction patterns rather than simply reproducing the website markup.

### 5.3 API/service layer

The mobile repository will contain a service abstraction around ChatPalez APIs. This layer should:

- centralize base URL/configuration;
- normalize API responses and errors;
- handle authentication/session/token rules;
- provide typed service functions;
- support pagination where required;
- avoid leaking API implementation details into UI components;
- support future migration of additional screens.

### 5.4 Secure web-backed module layer

Web-backed screens are permitted where they materially reduce first-release risk. They must still operate inside a controlled experience:

- only approved ChatPalez origins are internal;
- external navigation leaves the app;
- loading and failures remain app-controlled;
- deep links route predictably;
- web-backed modules should enter/exit through the app shell rather than becoming the app shell themselves;
- a web-backed screen should be replaceable later without restructuring the whole application.

### 5.5 Backend layer

The existing backend remains authoritative. Existing APIs must be audited and reused before modifying backend templates or introducing new endpoints.

Backend changes are allowed only when one of these conditions is met:

- a required mobile operation is not available through the existing API;
- a security-sensitive server operation cannot be implemented client-side;
- push/device association requires server participation;
- OAuth/session behavior requires a server callback adjustment;
- a store-compliance requirement cannot be satisfied from the current interface/API.

Any backend change must remain compatible with the website.

---

## 6. First-Release Screen Strategy

| Surface | Initial implementation | Reason |
|---|---|---|
| Splash/startup | Native/local | Establish installed-app experience immediately |
| Login/onboarding | API-driven local UI where API permits | High visibility; important App Store differentiation |
| Main navigation shell | Local mobile UI | Makes app structurally different from Safari |
| Notifications | API-driven local UI | High-value native/push integration point |
| Profile/account summary | API-driven local UI | High-frequency identity surface |
| Settings | Local/API-driven shell | Native permissions/account controls fit naturally here |
| Feed | API-driven if coverage/time permits; otherwise web-backed for v1 | Large implementation surface |
| Post creation/media | Web-backed initially unless API path proves straightforward | Complex media/validation workflow |
| Messaging/chat | Web-backed initially | Real-time complexity and schedule risk |
| Groups/pages/search | Web-backed initially | Lower first-release differentiation value |
| Calls/audio/video | Existing flow first; remediate separately | High technical uncertainty |

This table is a migration policy, not a permanent limitation. Any retained web-backed module can become local/API-driven later.

---

## 7. Authentication Strategy

Authentication must be designed so API-driven screens and retained web-backed modules behave as one product.

Implementation should prefer the existing supported API authentication mechanism. Before coding login, we must audit:

- API login endpoint and credentials/response format;
- token/session lifetime;
- refresh/session renewal behavior;
- logout endpoint;
- current-user endpoint;
- OAuth/social login support;
- whether an API-authenticated user can establish or share the website session needed by retained web modules.

Possible patterns, in preferred order:

1. **Shared supported authentication model** that works for both API and web-backed modules.
2. **Mobile token + server session bootstrap** where the backend can securely convert/associate authenticated mobile identity with a web session.
3. Minimal backend endpoint only if existing APIs cannot bridge the two safely.

Do not invent insecure cookie injection or expose server credentials to the app.

---

## 8. API Audit Before Implementation

Before converting a screen, record whether existing APIs support:

- login/logout/current user;
- profile retrieval/update;
- notifications and read state;
- feed retrieval/pagination;
- post creation/edit/delete;
- reactions/comments;
- media upload;
- conversations/messages;
- friends/following;
- groups/pages/search;
- settings/privacy/block/report/account deletion.

Each feature receives one of four classifications:

- **API Ready** — existing API is sufficient;
- **API + Mobile Adapter** — API is sufficient but needs client normalization;
- **Minimal Backend Gap** — a small endpoint/server adjustment is required;
- **Web-backed for v1** — migration cost is not justified for the first release.

This audit controls implementation priority.

---

## 9. Native Integrations

The first release continues to include:

- OneSignal Capacitor SDK;
- FCM Android push configuration;
- APNs iOS push configuration;
- user-controlled notification permission UX;
- foreground/background notification handling;
- trusted notification click routing;
- deep links;
- system share;
- AppLauncher handling for `tel:` and `mailto:`;
- keyboard integration;
- haptics used selectively;
- camera/microphone/photo permissions where required;
- native loading/offline/error behavior.

These integrations remain valuable regardless of whether the visible screen is local or web-backed.

---

## 10. Store-Readiness Principle

Using Capacitor does not itself determine whether the app is accepted or rejected. The application must provide meaningful installed-app value and must not present itself merely as the website with browser chrome removed.

For ChatPalez, the first-release differentiation target is:

- dedicated app startup experience;
- dedicated app navigation shell;
- local/API-driven high-visibility screens;
- native notifications and permission UX;
- native sharing and device actions;
- deep linking;
- app lifecycle/resilience;
- platform-appropriate keyboard/status/safe-area behavior;
- UGC report/block/delete-account compliance.

The website and the installed app may share branding and content, but their application shell and interaction model should not be identical.

---

## 11. Security Principles

1. HTTPS only in production.
2. Only trusted ChatPalez origins may remain inside web-backed modules.
3. No privileged secret is stored in source or exposed through `VITE_*` configuration.
4. API tokens/session material must use the safest storage option supported by the final auth model.
5. Deep links must be validated before navigation.
6. Backend user-agent detection is presentation/integration metadata only and never authentication.
7. Native permissions remain least-privilege.
8. Diagnostics must remain bounded and redact passwords, cookies, sessions, authorization values and tokens.
9. New backend endpoints require authentication, authorization and CSRF/token rules appropriate to their transport.

---

## 12. Backend Modification Policy

The earlier mobile integration work in `chatpalez-backend-2` introduced official-shell detection and bridge support. That work should now be treated as **legacy/compatibility support for retained web-backed modules**, not as the preferred method for building new mobile screens.

From this decision onward:

- do not add new Smarty/mobile-template changes when the same outcome can be achieved through an existing API and local mobile UI;
- do not extend backend business logic merely to make a WebView look native;
- add minimal server/API work only when an audited feature gap requires it;
- keep all new mobile presentation code in `chatpalez_mobile` where practical.

---

## 13. Out of Scope for the Initial Two-Week Release

The first release does **not** require:

- rewriting the complete social network locally;
- replacing the PHP/Smarty backend;
- reproducing every website screen through APIs;
- redesigning the whole ChatPalez website;
- replacing the database;
- replacing the current messaging/real-time architecture;
- creating a complete new REST API;
- fully native Agora calling unless existing behavior proves unusable;
- migrating every web-backed module before submission.

---

## 14. Revised Delivery Phases

### Phase 1 — Architecture/API audit

- inventory existing API capabilities;
- define authentication/session bridge;
- classify key screens as API Ready / Minimal Backend Gap / Web-backed;
- freeze first-release migration list.

### Phase 2 — App shell and high-visibility local UI

- local startup shell;
- mobile navigation structure;
- login/onboarding;
- notifications;
- profile/account summary;
- settings shell.

### Phase 3 — Native integrations

- push;
- deep links;
- share/intents;
- permissions/media;
- keyboard/status/safe areas;
- lifecycle/error/offline handling.

### Phase 4 — Web-module integration and regression

- feed if retained web-backed;
- messaging;
- groups/pages/search;
- complex media;
- calls/audio/video;
- cross-boundary navigation between local and web-backed screens.

### Phase 5 — Release hardening

- security/compliance;
- Android AAB;
- iOS archive/TestFlight;
- icons/splash;
- store metadata;
- physical-device regression;
- release-candidate documentation.

---

## 15. Two-Week Working Strategy

The remaining implementation window should prioritize differentiation, not broad rewriting.

### Priority 1

- API capability audit;
- authentication architecture;
- local app shell/navigation.

### Priority 2

- local login/onboarding;
- local notifications;
- local profile/account summary;
- local settings shell.

### Priority 3

- integrate existing web-backed modules behind the app shell;
- validate session continuity and cross-boundary navigation.

### Priority 4

- native push/media/device behavior;
- release/security/compliance testing.

If feed API coverage is strong and implementation remains within schedule, feed becomes the next API-driven screen. Otherwise feed remains web-backed for v1 and moves to the next migration phase.

---

## 16. Compatibility and Release Policy

Initial support floor:

- Android API 24+;
- Android target/compile API 36;
- iOS 15+.

Android and iOS remain in one shared Capacitor project. Shared TypeScript/application logic should be preferred, with native Swift/Java/Kotlin only when platform behavior requires it.

GitHub Actions are currently disabled by project-owner instruction. Validation must therefore be performed manually/local or through explicitly approved tooling until that decision changes.

---

## 17. Definition of Done for Initial Release

The first release is engineering-complete when:

- Android and iOS projects build successfully;
- the application has a distinct local/native app shell;
- approved high-visibility surfaces are local/API-driven;
- retained web-backed modules are integrated deliberately rather than acting as the entire app shell;
- authentication works across local/API-driven and retained web-backed areas;
- primary social-network flows remain usable;
- native navigation, share, deep links and permissions work;
- push notifications work on configured test devices;
- notification taps route correctly;
- offline/server failures produce an app-controlled recoverable state;
- report/block/account-deletion requirements are satisfied;
- release configuration contains no privileged secrets;
- Android release artifact and iOS archive/TestFlight candidate can be produced once signing access is available;
- all release-blocking backlog items are completed or explicitly accepted.

Store approval itself is not part of engineering Definition of Done because Apple and Google control their review decisions and timelines.

---

## 18. Delivery Governance

`docs/BACKLOG.md` is the living implementation tracker for this architecture.

Every significant implementation task must be reflected there. The architecture document controls **how** the app should be built; the backlog controls **what is being implemented and its state**.

Any decision to migrate a web-backed module to API-driven UI must update both documents where it materially changes scope.

---

## 19. Long-Term Migration Path

The progressive architecture is intentionally evolutionary.

After v1, likely migration order is:

1. feed/home;
2. post creation/media;
3. messaging;
4. search/discovery;
5. groups/pages;
6. calls/media if a native implementation is justified.

The end state may become predominantly API-driven without requiring a disruptive rewrite today.
