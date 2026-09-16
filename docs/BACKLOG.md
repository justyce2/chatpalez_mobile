# ChatPalez Mobile — Delivery Backlog and Status Tracker

**Repository:** `justyce2/chatpalez_mobile`  
**Architecture source:** `docs/ARCHITECTURE_AND_SCOPE.md`  
**Compliance source:** `docs/APP_STORE_COMPLIANCE.md`  
**Target:** Android + iOS progressive hybrid application using Capacitor + selective APIs + retained web-backed modules  
**Initial delivery window:** 2 weeks / 10 working days

---

## Status Legend

| Status | Meaning |
|---|---|
| Planned | Accepted but not started |
| In Progress | Actively being implemented |
| Blocked | Waiting on a dependency, account, credential, asset or external decision |
| Testing | Implemented and awaiting runtime/integration/device acceptance |
| Completed | Implemented and acceptance checks passed |
| Deferred | Deliberately moved beyond the initial release |

---

## Overall Progress

| Metric | Current |
|---|---:|
| Total tracked tasks | 108 |
| Completed | 15 |
| In Progress | 0 |
| Testing | 34 |
| Blocked | 9 |
| Planned | 50 |
| Deferred | 0 |

> Architecture rule: new high-visibility mobile screens should prefer local/API-driven implementation when existing ChatPalez APIs can support them safely. Backend/template changes are a last resort. Retained web modules must sit behind the local app shell rather than becoming the app shell.

> Automation rule: GitHub Actions are currently disabled by project-owner instruction. Do not recreate Actions workflows unless explicitly requested.

---

# EPIC A — Discovery and Architecture

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| A-01 | Inspect existing ChatPalez backend architecture | Completed | Backend/frontend architecture identified | Backend access | PHP/Smarty/Bootstrap architecture reviewed |
| A-02 | Define mobile architecture and scope | Completed | Architecture, scope, phases, risks and DoD documented | A-01 | Progressive hybrid architecture now approved |
| A-03 | Validate production/staging origin strategy | Completed | Approved URL/SSL/environment approach documented | Backend URL | Production origin `https://chatpalez.com` verified |
| A-04 | Confirm Android application ID | Completed | Existing store package identity preserved | Existing Android listing | `com.chatpalez` |
| A-05 | Confirm iOS bundle identifier | Blocked | Bundle ID owned/approved in Apple Developer account | Apple Developer account | Native project currently uses `com.chatpalez` |
| A-06 | Confirm app display name and branding assets | Blocked | Final name/icon/splash approved | Client assets | Display name ChatPalez; authoritative store artwork still required |
| A-07 | Confirm minimum Android/iOS support targets | Completed | Support versions documented | Product decision | Android API 24+ / target+compile 36; iOS 15+ |

---

# EPIC B — Project Foundation

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| B-01 | Initialize Node/TypeScript project | Completed | TypeScript/Vite project committed | None | Foundation exists on `develop` |
| B-02 | Install/configure Capacitor | Completed | Capacitor initialized with valid config | B-01 | Capacitor 8 configured |
| B-03 | Create local application shell | Testing | Local startup/loading/error/offline shell works | B-02 | Must now evolve into primary progressive-hybrid shell |
| B-04 | Add Android project | Completed | Android project builds | B-02 | `com.chatpalez` |
| B-05 | Add iOS project | Completed | iOS project builds without signing | B-02 | Bundle currently `com.chatpalez` |
| B-06 | Add environment/config abstraction | Completed | Origins/non-secret config separated | B-02 | Secrets excluded |
| B-07 | Add `.gitignore` and secret-safety rules | Completed | Sensitive/native artifacts excluded | B-01 | APNs/Firebase/signing/env exclusions present |
| B-08 | Add README/build instructions | Completed | Fresh developer can understand setup | B-01–B-07 | Current instructions documented |

---

# EPIC C — Secure Web-backed Modules and Navigation

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| C-01 | Load approved ChatPalez origin as controlled web module | Testing | Web-backed modules consistently load approved origin | B-03, A-03 | No longer intended to be the complete app shell |
| C-02 | Implement trusted-host policy | Testing | Only approved ChatPalez origin is internal | C-01 | URL policy tests exist |
| C-03 | Implement external URL interception | Testing | External URLs leave app container | C-02 | Native Browser/AppLauncher bridge implemented |
| C-04 | Handle `tel:` / `mailto:` / app links | Testing | Supported schemes hand off to OS | C-03 | Runtime acceptance pending |
| C-05 | Handle popup/new-window flows | Testing | OAuth/external windows behave safely | C-03 | Runtime/OAuth testing pending |
| C-06 | Implement Android back behavior | Testing | Back works across local/web navigation | B-03 | Must be retested once local navigation shell is introduced |
| C-07 | Define iOS navigation/back behavior | Testing | Local/web history and swipe UX acceptable | B-03 | WKWebView swipe behavior implemented |
| C-08 | Implement loading state | Testing | App controls loading UI | B-03 | Existing loading shell must wrap both local and web modules |
| C-09 | Implement server/error state | Testing | Server failures are recoverable | B-03 | Local fallback exists |
| C-10 | Implement offline/reconnect state | Testing | App recovers from connection loss | B-03 | Runtime acceptance pending |

---

# EPIC D — Authentication and Session Lifecycle

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| D-01 | Audit API authentication endpoints | Planned | Login/current-user/logout/session model documented | N-01 | First task before local login implementation |
| D-02 | Implement local/API-driven login UI | Planned | User can authenticate from local mobile screen | D-01, N-02 | Replaces website-first login direction |
| D-03 | Design API ↔ retained-web session continuity | Planned | API-authenticated user can enter web-backed modules safely | D-01 | May require supported session bootstrap strategy |
| D-04 | Verify logout synchronization | Planned | API/local/native/web identities all clear predictably | D-02,D-03 | Includes OneSignal identity logout |
| D-05 | Handle expired/invalid auth | Planned | User returns safely to local login without loops | D-02,D-03 | Central auth state required |
| D-06 | Verify CSRF/token compatibility | Planned | API and retained web actions remain valid | D-03 | Minimal backend adjustment only if proven necessary |
| D-07 | Test social/OAuth login flows | Planned | Enabled providers return correctly to app | C-05,D-02 | High-priority runtime case |
| D-08 | Official mobile-shell compatibility support | Testing | Retained web modules can detect official app when needed | Backend integration | Backend bridge merged; new screens should not depend on template detection |

---

# EPIC E — Native / Local UI Integration

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| E-01 | Configure splash screen | Blocked | Correct final splash on Android/iOS | A-06 | Final artwork needed |
| E-02 | Configure app icons | Blocked | Required native icon sets applied | A-06 | Final artwork needed |
| E-03 | Configure status bar | Testing | Status bar matches local/web screens | B-04,B-05 | Runtime acceptance pending |
| E-04 | Configure safe areas | Testing | Content avoids notches/home indicators | B-03 | Local shell must also use safe-area rules |
| E-05 | Configure keyboard behavior | Testing | Forms/chat remain usable | B-03 | Capacitor Keyboard integrated |
| E-06 | Define orientation behavior | Completed | Orientation policy documented | Product decision | Portrait + landscape retained for media/calls |
| E-07 | Validate Android edge-to-edge | Planned | No clipping on current Android UI modes | B-04 | Device/emulator visual test |

---

# EPIC F — Media, Camera and File Handling

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| F-01 | Test profile/avatar upload on Android | Planned | Camera/gallery/file upload succeeds | Auth | Local/API profile may change path |
| F-02 | Test profile/avatar upload on iOS | Planned | Camera/gallery upload succeeds | Auth | Local/API profile may change path |
| F-03 | Test feed/post media upload | Planned | Image/video upload works | Feed decision | API or retained-web path |
| F-04 | Test messaging attachments | Testing | Local photo can be selected, uploaded and sent through official API | Messaging | Runtime device validation pending; video/voice deferred |
| F-05 | Add native camera/gallery bridge if required | Planned | Native fallback only where needed | F-01–F-04 | Avoid unnecessary plugin complexity |
| F-06 | Configure permission descriptions | Testing | Camera/photo/mic reasons accurate | Native builds | Declarations committed |
| F-07 | Implement download/file-open handling | Planned | Supported downloads usable | C-03 | Add only after real download flow audit |

---

# EPIC G — Push Notifications and Deep Links

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| G-01 | Confirm/create OneSignal mobile configuration | Blocked | OneSignal Android/iOS configured | OneSignal access | SDK integration exists |
| G-02 | Configure Android Firebase/FCM | Blocked | Android device registers and receives push | Firebase access | External credential/config gate |
| G-03 | Configure Apple APNs | Blocked | iOS push capability valid | Apple access | External gate |
| G-04 | Install OneSignal Capacitor SDK | Testing | SDK initializes without runtime error | Native builds | Device configuration pending |
| G-05 | Implement permission UX | Testing | Permission requested from user-controlled local settings | G-04 | Existing web setting can migrate into local Settings |
| G-06 | Associate subscription with logged-in user | Testing | OneSignal identity tracks authenticated ChatPalez user | Auth,G-04 | Revisit against new API auth state |
| G-07 | Handle foreground notifications | Testing | Foreground behavior defined | G-04 | Device test pending |
| G-08 | Handle background notifications | Planned | Background push reliable | G-02,G-03 | Device test needed |
| G-09 | Implement notification-click routing | Testing | OneSignal click accepts only trusted internal paths and enters protected web bridge | G-04,N-03 | Device test must validate foreground/background tap behavior |
| G-10 | Implement deep-link parsing/validation | Testing | Only valid routes open | C-02 | Custom scheme exists; router integration remains |
| G-11 | Configure badges | Planned | Badge behavior predictable | G-04 | Later polish |

---

# EPIC H — Native Share and Device Actions

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| H-01 | Implement native share | Testing | Supported content invokes OS share | B-02 | Bridge implemented |
| H-02 | Validate phone/email/external intents | Testing | Intents launch safely | C-04 | Runtime acceptance pending |
| H-03 | Add selective haptics | Testing | Haptics used sparingly | B-02 | Existing light/success feedback implemented |

---

# EPIC I — Social Network Regression / Migration

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| I-01 | Feed/home decision and regression | Testing | Retained-web v1 path selected; validate authenticated WebView feed | N-01 | Official audit found no timeline/post API; no custom endpoint authorized |
| I-02 | Post creation regression | Planned | Text/media posting works through selected path | I-01,F | Web-backed acceptable for v1 |
| I-03 | Reactions/comments regression | Planned | Interactions work | I-01 | Selected path |
| I-04 | Profile/account regression | Testing | Local summary works; validate deeper profile/edit path through protected WebView | N-06 | Official API has no full profile-read/update contract |
| I-05 | Messaging regression | Planned | Send/receive/composer work | Auth,F | Web-backed initially |
| I-06 | Notifications regression | Planned | Local notifications + push interactions work | N-05,G | API-driven target |
| I-07 | Search/friends/groups/pages regression | Planned | Primary community flows work | Auth | Web-backed initially |
| I-08 | Settings/privacy regression | Planned | Local settings shell + safety/account flows work | N-07 | Progressive hybrid target |

---

# EPIC J — Audio, Video and Calling

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| J-01 | Test audio playback/notification sounds | Planned | Audio predictable on both platforms | E | Web-backed initially |
| J-02 | Test microphone permission/use | Planned | Voice/call features can use mic | F-06 | Android+iOS |
| J-03 | Test camera use during calling | Planned | Video camera initializes | F-06 | Android+iOS |
| J-04 | Test existing Agora/WebRTC flow | Planned | Incoming/outgoing calls assessed | J-01–J-03 | Major uncertainty |
| J-05 | Implement WebView-specific call fixes | Planned | Feasible fixes applied | J-04 | Scope depends on findings |
| J-06 | Decide native-calling remediation | Planned | Native rewrite deferred or scoped | J-04 | Post-v1 if necessary |

---

# EPIC K — App Lifecycle and Reliability

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| K-01 | Test cold start | Testing | App starts reliably | Core build | Re-test after progressive shell is active |
| K-02 | Test foreground/background transitions | Planned | App resumes valid state | Core build | Must cover local + web modules |
| K-03 | Test process/app restart | Planned | Auth/navigation restore valid | D-03 | Local router state included |
| K-04 | Test connectivity loss | Planned | Recoverable UX | C-10 | Local shell controls failure state |
| K-05 | Test server unavailable state | Planned | No blank/crash state | C-09 | Local shell owns fallback |
| K-06 | Production-safe diagnostics | Completed | Useful bounded/redacted diagnostics | Core build | Sensitive-key/token/session redaction exists |

---

# EPIC L — Security and Compliance

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| L-01 | Review permissions for least privilege | Testing | Only required permissions remain | F/G/J | No location/broad storage permission |
| L-02 | Review HTTPS/navigation restrictions | Testing | Unsafe/untrusted internal navigation prevented | C | Retained web modules only |
| L-03 | Review embedded config/secrets | Testing | No privileged secret in app/repo | B/G/N | API auth storage must be reviewed when implemented |
| L-04 | Verify content-reporting flow | Testing | User can report UGC | Backend feature | Runtime UI path still required |
| L-05 | Verify user-blocking flow | Testing | User can block abusive users | Backend feature | Runtime UI path still required |
| L-06 | Verify moderation/filtering | Testing | Moderation capability documented/tested | Backend/admin | Production admin handling pending |
| L-07 | Verify support/contact information | Planned | Support route live/accessible | Client/backend | Store metadata dependency |
| L-08 | Verify privacy-policy route | Planned | Privacy policy live/accessible | Client/backend | Store metadata dependency |
| L-09 | Verify account deletion | Testing | In-app deletion requirement satisfied | Backend feature | Device test pending |
| L-10 | Prepare privacy/data inventory | Completed | Data/device permissions mapped | L-01–L-09 | Inventory exists |

---

# EPIC M — Release Engineering

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| M-01 | Configure Android signing/release | Blocked | Secure signing strategy configured | Play/signing access | Need existing versionCode/upload key |
| M-02 | Produce Android AAB | Planned | Store-ready signed AAB produced | M-01, regression | Unsigned bundle was previously proven |
| M-03 | Configure iOS signing/team/capabilities | Blocked | Xcode signing resolves | Apple access | External gate |
| M-04 | Produce iOS archive | Planned | Release archive builds | M-03, regression | Requires Mac/Xcode/signing |
| M-05 | Prepare TestFlight build | Planned | Upload validates | M-04 | App Store Connect required |
| M-06 | Final Android/iOS regression | Planned | No release-blocking defects | All critical epics | Physical devices preferred |
| M-07 | Prepare store-readiness checklist | Testing | Privacy/permissions/assets/support checked | L | Documents exist; external inputs remain |
| M-08 | Tag/document initial release candidate | Planned | Candidate commit/version recorded | M-02–M-07 | Manual validation; GitHub Actions disabled |

---

# EPIC N — Progressive Hybrid / API Migration

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| N-01 | Audit existing Sngine/ChatPalez API coverage | Completed | Matrix documents confirmed/absent official contracts and v1 boundaries | Backend/API access | Feed/posts/comments/groups/pages/search/profile/social graph audit complete |
| N-02 | Build typed API/service layer | Planned | Central API client, config, auth/error normalization and reusable services exist | N-01 | Keep UI independent of raw API details |
| N-03 | Build local mobile navigation shell | Planned | App opens into local shell with mobile-first primary navigation | B-03 | Bottom-tab/app-bar design; web modules become destinations |
| N-04 | Implement local login/onboarding | Planned | Authentication occurs through local UI using supported API/auth model | D-01,N-02 | High App Store differentiation value |
| N-05 | Implement API-driven notifications screen | Planned | Local notification list/read state works | N-01,N-02,N-04 | Integrate native push routing |
| N-06 | Implement API-driven profile/account summary | Planned | Local account identity/profile summary works | N-01,N-02,N-04 | Deeper profile may remain web-backed initially |
| N-07 | Implement local/API settings shell | Planned | Settings shell exposes native permissions + key account options | N-01,N-02,N-04 | Link to retained safety/account flows as needed |
| N-08 | Create local↔web module router/session bridge | Planned | Users move between local and retained web modules without broken auth/navigation | D-03,N-03 | Critical progressive-hybrid boundary |
| N-09 | Decide whether feed migrates in v1 | Testing | Retained-web v1 decision documented and entry point implemented | N-01,N-08 | Official fresh API lacks feed/post contract; validate bridge on devices |

---

# First-Release Surface Map

| Surface | Target for v1 |
|---|---|
| Splash/startup | Native/local |
| Login/onboarding | API-driven local |
| Main navigation | Local mobile shell |
| Notifications | API-driven local |
| Profile/account summary | API-driven local |
| Settings shell | Local/API-driven |
| Feed | Controlled retained web module; official API audit found no feed/post contract |
| Post/media composer | Controlled retained web module; no official post contract |
| Messaging | Retained web initially |
| Groups/pages/search | Controlled retained web modules; no official API contracts |
| Calls | Existing implementation first; remediate separately |

---

# External Dependencies / Inputs Required

| Dependency | Needed for | Current status |
|---|---|---|
| Production ChatPalez URL | API/web-module integration | Verified: `https://chatpalez.com` |
| Existing API documentation/coverage | Progressive hybrid implementation | Audit required under N-01 |
| Android application ID | Existing Play identity | Verified `com.chatpalez` |
| Android version history | Play update | Need highest existing `versionCode` |
| iOS bundle ID ownership | App Store identity | Awaiting Apple confirmation |
| Apple Developer/App Store Connect | Signing/APNs/TestFlight | Blocked |
| Firebase/FCM | Android push | Blocked |
| OneSignal mobile configuration | Push | Blocked |
| Google Play signing access | Android release | Blocked |
| Final icon/splash assets | Branding | Blocked |
| Privacy/support URLs | Store compliance | Verification pending |

---

# Revised Two-Week Execution View

## Immediate — Progressive architecture foundation

N-01, D-01, N-02, N-03.

Exit condition: API coverage is known, auth model selected, service layer established and app opens into a local navigation shell.

## Next — High-visibility local screens

N-04, N-05, N-06, N-07, N-08.

Exit condition: login, notifications, profile/account and settings are visibly app-owned rather than Safari-equivalent.

## Then — Retained web module integration

C/I/J tasks plus N-09.

Exit condition: web-backed feed/messaging/groups/etc. open deliberately from the app shell and share authentication/navigation correctly.

## Final — Native/release acceptance

G/H/K/L/M tasks.

Exit condition: native integrations, compliance, device regression and signing/release preparation are complete.

---

# Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Existing API is narrower than expected | Medium | High | N-01 audit first; keep complex modules web-backed; add only minimal proven API gaps |
| API auth and retained web session do not interoperate cleanly | Medium | High | D-03/N-08 architecture before broad local migration |
| Apple views app as repackaged website | Medium | High | Local shell + local login/notifications/profile/settings + native capabilities |
| Full API rewrite threatens deadline | High | High | Explicitly prohibited for v1; progressive migration only |
| Agora/WebRTC unstable in WebView | Medium–High | High | Test under J; native remediation separate |
| Push credentials arrive late | High | High | SDK work already separated; external gates remain Blocked |
| Existing website regressions caused by mobile backend edits | Medium | High | Prefer APIs/local UI; backend/template modifications now last resort |
| Store review exceeds engineering window | Medium | Medium | Target submission-ready build, not guaranteed review completion |

---

# Change Log

| Date | Change |
|---|---|
| 2026-09-15 | Initial Capacitor hybrid backlog created and platform architecture audited. |
| 2026-09-15 | Android/iOS projects, native integrations, deep links, push scaffolding, compliance/release documentation and backend compatibility bridge implemented. |
| 2026-09-15 | Backend mobile bridge merged to backend `master`; later architecture review clarified that new mobile presentation should avoid unnecessary backend-template dependency. |
| 2026-09-15 | GitHub Actions disabled by project-owner instruction; workflow files removed from mobile and backend repositories. |
| 2026-09-15 | **Architecture pivot approved:** adopted progressive hybrid architecture. Added Epic N for API audit/service layer/local shell/local login/notifications/profile/settings/session bridge. Existing web-backed modules are retained selectively rather than defining the entire app experience. |


---

## Change decision — API-first and upgrade-safe customization (2026-09-16)

Before any further backend modification, complete an API-versus-custom audit against `sngine-fresh`. Reuse official Sngine APIs and business logic whenever sufficient. The mobile API adapter remains client-side only. Use official `POST /user/onesignal`; re-audit the notification adapter; retain feed/posts/groups/pages/search as web-backed v1 where official coverage remains unproven. A custom backend extension is admissible only for a documented, minimal security/session gap (server-only API-secret protection or JWT-to-standard-web-session transition). Preserve the stock theme; put app-only web presentation in a separately named duplicate theme selected only for official app requests. Maintain an upgrade-customization register for every retained extension.


## Implementation update — native secure JWT storage (2026-09-16)

The interim browser `sessionStorage` session has been replaced in source by in-memory state plus native protected persistence through Capacitor 8 secure storage. iOS uses a device-only unlocked Keychain item with iCloud sync disabled; Android uses Keystore-backed storage. Browser builds intentionally do not persist JWTs. Status: **Testing** pending dependency install, Capacitor sync, Android/iOS build and real-device cold-start/logout validation. No Sngine backend, API route, session bridge or theme modification was made.


**Next implementation order revised:** validate the new native secure store, configure the public OneSignal App ID and native credentials, then perform Android/iOS notification identity/delivery validation. Continue the remaining official API audit. No backend modification is authorized by this mobile-only work.


## Implementation update — official OneSignal lifecycle (2026-09-16)

Native OneSignal integration is now **Testing**: optional public app-ID configuration, authenticated external-user login, existing official `POST /user/onesignal` synchronization, logout/deletion disassociation, and a user-initiated Settings permission control are implemented. It requires FCM/APNs + physical Android/iOS validation before acceptance. No custom backend route was created.


## Implementation decision — feed API audit (2026-09-16)

Fresh Sngine API modules were re-audited before further backend work. Only data/load?get=new_people supports discovery; the official API provides no feed/timeline, post CRUD, non-chat reactions/comments, groups, pages or social-search contract. I-01 and N-09 are now **Testing** with a deliberate protected retained-web v1 path. No custom backend API is authorized for these modules.


## Implementation update — trusted notification taps (2026-09-16)

OneSignal click events now accept only same-origin ChatPalez URLs (or relative internal paths), normalize them, and pass them through the existing authenticated POST session bridge. External, malformed, and alternate-port URLs are ignored. Unit coverage was added; physical Android/iOS notification-tap validation remains required.


## Implementation decision — profile/social API audit (2026-09-16)

The official user module audit is complete: it lacks profile-read/update and social-graph retrieval routes. N-01 is now **Completed** as an API capability audit. Deep profile editing and friends/followers remain protected retained-web modules for v1; no custom backend API is authorized.


## Major milestone — local chat photo attachment (2026-09-16)

Photo selection, multipart upload and send are implemented through official Sngine data/chat routes. This remains **Testing** until deployment and physical-device validation confirm upload permissions, server limits, message rendering and failure recovery.


## Implementation update — safe chat photo rendering (2026-09-16)

The local message thread now renders validated ChatPalez-hosted photo attachments and rejects unsafe media paths. F-04 remains **Testing** pending real API/device validation.


## Major milestone — local conversation management (2026-09-16)

Conversation leave/delete, message Like reaction, and own-message deletion are implemented through the existing official chat API. Runtime acceptance remains pending.
