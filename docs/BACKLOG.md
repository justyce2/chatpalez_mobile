# ChatPalez Mobile — Delivery Backlog and Status Tracker

**Repository:** `justyce2/chatpalez_mobile`  
**Architecture source:** `docs/ARCHITECTURE_AND_SCOPE.md`  
**Compliance source:** `docs/APP_STORE_COMPLIANCE.md`  
**Target:** Android + iOS hybrid mobile application using Capacitor  
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
| Total tracked tasks | 99 |
| Completed | 15 |
| In Progress | 0 |
| Testing | 34 |
| Blocked | 9 |
| Planned | 41 |
| Deferred | 0 |

> Update rule: whenever a feature or task changes state, update its row, the overall counts, notes and—where relevant—the commit/PR reference. Items that cannot proceed without external input must be marked **Blocked**, not left as Planned.

---

# EPIC A — Discovery and Architecture

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| A-01 | Inspect existing ChatPalez backend architecture | Completed | Backend/frontend architecture and mobile implementation approach identified | Access to `chatpalez-backend-2` | Existing PHP/Smarty/Bootstrap architecture reviewed |
| A-02 | Define mobile architecture and scope | Completed | Architecture, scope, delivery phases, risks and DoD documented | A-01 | See `ARCHITECTURE_AND_SCOPE.md` and ADR-001 |
| A-03 | Validate production/staging web origin strategy | Completed | Approved URL(s), SSL behavior and environment approach documented | Backend URL/access | Production origin verified as `https://chatpalez.com`; controlled remote-origin approach documented |
| A-04 | Confirm Android application ID | Completed | Existing store package identity preserved | Existing Android listing | Verified existing package and native project use `com.chatpalez` |
| A-05 | Confirm iOS bundle identifier | Blocked | Final bundle ID is owned/approved in Apple Developer account | Apple Developer account | Native project uses `com.chatpalez`; final Apple ownership/signing confirmation still required |
| A-06 | Confirm app display name and branding assets | Blocked | Final name, icon source and splash assets approved | Client/source branding assets | Display name is ChatPalez; no definitive store-ready source icon/splash asset found in repository |
| A-07 | Confirm minimum Android/iOS support targets | Completed | Minimum supported versions recorded in release policy | Product/release decision | v1 support policy documented: Android API 24+ / target+compile API 36 and iOS 15+ |

---

# EPIC B — Project Foundation

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| B-01 | Initialize Node/TypeScript project | Completed | `package.json`, TypeScript config and scripts committed | None | TypeScript + Vite foundation committed on `develop` |
| B-02 | Install and configure Capacitor core/CLI | Completed | Capacitor initialized with valid config | B-01 | Capacitor 8 configuration and CI validation pass |
| B-03 | Create minimal local app shell | Testing | Local shell renders loading/error/offline states | B-02 | Shell plus connection fallback implemented; device verification pending |
| B-04 | Add Android Capacitor project | Completed | `android/` project generated, synced and builds | B-02 | CI generates/syncs and successfully compiles Android debug app |
| B-05 | Add iOS Capacitor project | Completed | `ios/` project generated, synced and builds without signing | B-02 | macOS CI passes unsigned simulator Xcode build |
| B-06 | Add environment/config abstraction | Completed | Dev/prod origins and non-secret config separated cleanly | B-02 | Production origin and public runtime configuration isolated from secrets |
| B-07 | Add `.gitignore` and secret-safety rules | Completed | Native build artifacts, local configs and credentials excluded | B-01 | APNs, Firebase, signing files, local env and native build outputs excluded |
| B-08 | Add project README/build instructions | Completed | Fresh developer can understand setup/build flow | B-01–B-07 | Setup, native generation, sync, environments and branch strategy documented |

---

# EPIC C — Secure Web Container and Navigation

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| C-01 | Load approved ChatPalez origin in app | Testing | App consistently opens correct mobile experience | B-03, A-03 | `https://chatpalez.com` configured as controlled Capacitor app origin; live Android bridge assertion queued |
| C-02 | Implement trusted-host allow-list | Testing | Only approved ChatPalez origin is treated as internal | C-01 | URL policy unit tests pass; backend/native UI guards restrict internal origin |
| C-03 | Implement external URL interception | Testing | External links open outside the app container | C-02 | App-only native UI bridge intercepts external HTTP(S) anchors/window opens |
| C-04 | Handle `tel:` / `mailto:` / app links | Testing | Supported URI schemes hand off to OS correctly | C-03 | AppLauncher integration implemented for `tel:` and `mailto:`; device test pending |
| C-05 | Implement popup/new-window handling | Testing | New-window links do not fail silently or escape policy | C-03 | Same-origin `_blank` stays in app; external `_blank` routes externally; runtime/OAuth testing pending |
| C-06 | Implement Android back-button behavior | Testing | Back navigates history correctly and root behavior is predictable | C-01 | Capacitor App back handler implemented; device behavior pending |
| C-07 | Define iOS navigation/back behavior | Testing | Web history and native gestures produce acceptable UX | C-01 | WKWebView back/forward swipe behavior implemented and Xcode-compiled; runtime gesture acceptance pending |
| C-08 | Implement loading state | Testing | User sees intentional loading UI before content is ready | B-03, C-01 | Startup/loading state exists; device verification pending |
| C-09 | Implement server/error state | Testing | SSL/load/server errors show recoverable UI | B-03, C-01 | `errorPath` uses local `error.html` with retry to production origin |
| C-10 | Implement offline state and reconnect | Testing | Offline state shown and app can recover | C-01 | Network listener/retry flow implemented; device verification pending |

---

# EPIC D — Authentication and Session Lifecycle

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| D-01 | Verify standard login in Android WebView | Planned | Login succeeds and lands on expected authenticated screen | C-01 | Requires runtime test account/device |
| D-02 | Verify standard login in iOS WKWebView | Planned | Login succeeds and lands on expected authenticated screen | C-01, B-05 | Requires iOS runtime |
| D-03 | Verify session persistence after app restart | Planned | Authenticated user remains signed in as expected | D-01, D-02 | Session audit confirms Secure+HttpOnly HTTPS baseline; runtime cookie persistence still required |
| D-04 | Verify logout synchronization | Planned | Server logout clears mobile session correctly | D-01, D-02 | Native push identity bridge also detaches OneSignal external user on logged-out pages |
| D-05 | Handle expired/invalid server session | Planned | User is redirected safely to login when session expires | D-03 | No redirect loops |
| D-06 | Verify CSRF/session-token compatibility | Planned | Posting/forms/actions work without mobile-specific CSRF failures | D-01, D-02 | Backend fix only if runtime test identifies issue |
| D-07 | Test enabled social/OAuth login flows | Planned | Enabled providers return correctly to app/session | C-05, D-01, D-02 | OAuth/new-window behavior is high-priority runtime test |
| D-08 | Add official-mobile-shell detection mechanism | Testing | Backend/client reliably distinguishes official app context | Backend integration | Backend PR #1 merged to `master` as `2bc9488`; production contract + emulator bridge assertion must verify live deployment |

---

# EPIC E — Native UI Integration

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| E-01 | Configure splash screen | Blocked | Correct final splash displays on Android and iOS | A-06 | Base splash behavior exists; final brand asset needed |
| E-02 | Configure app icons | Blocked | Required Android/iOS icon sets generated and applied | A-06 | Native scaffolds still need final ChatPalez source artwork |
| E-03 | Configure status bar | Testing | Status bar does not clash with app UI | B-04, B-05 | StatusBar plugin/bootstrap handling implemented; runtime confirmation pending |
| E-04 | Configure safe-area handling | Testing | Content avoids notches/home indicators | C-01 | `viewport-fit=cover` and safe-area variables implemented for official shell |
| E-05 | Configure keyboard behavior | Testing | Forms/messages remain usable when keyboard opens | C-01 | Capacitor Keyboard installed; native resize configured; bridge emits show/hide and height state |
| E-06 | Define orientation behavior | Completed | App orientation policy documented/configured | Product decision | Portrait + landscape retained for media/calling; policy documented in `PLATFORM_SUPPORT.md` |
| E-07 | Validate Android edge-to-edge behavior | Planned | No content clipping on current Android UI modes | B-04 | Requires emulator/device visual test |

---

# EPIC F — Media, Camera and File Handling

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| F-01 | Test profile/avatar upload on Android | Planned | Camera/gallery/file upload succeeds | D-01 | Existing HTML input first |
| F-02 | Test profile/avatar upload on iOS | Planned | Camera/gallery upload succeeds | D-02 | WKWebView/photo permission behavior |
| F-03 | Test feed/post media upload | Planned | Image/video upload works in social posting flow | F-01, F-02 | Validate large files |
| F-04 | Test messaging attachments | Planned | Attachments can be selected and sent | F-01, F-02 | Chat flow regression |
| F-05 | Add native camera/gallery bridge if required | Planned | Native fallback exists only if web input is insufficient | F-01–F-04 | Avoid unnecessary native complexity |
| F-06 | Configure permission descriptions | Testing | Android/iOS declare accurate camera/photo/microphone reasons | Native builds | Android camera/mic and iOS camera/mic/photo usage descriptions committed and build-validated |
| F-07 | Implement download/file-open handling | Planned | Supported downloads can be accessed by the user | C-03 | Dedicated backend download flow not yet proven; avoid unnecessary filesystem plugin until runtime audit |

---

# EPIC G — Push Notifications and Deep Links

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| G-01 | Confirm/create OneSignal mobile configuration | Blocked | OneSignal app has Android/iOS platform configuration | OneSignal account access | Existing server App ID is passed to native bridge; Android/iOS platform credentials still need configuration |
| G-02 | Configure Android Firebase/FCM | Blocked | Android push credentials accepted and test device registers | Firebase access | No private credential committed; Firebase/OneSignal setup required |
| G-03 | Configure Apple APNs | Blocked | APNs key/cert and capability setup valid | Apple Developer access | Requires Apple team, APNs and final signing capability |
| G-04 | Install OneSignal Capacitor SDK | Testing | SDK initializes on Android/iOS without runtime errors | Native builds | SDK installed, location module disabled, Android/iOS native builds pass; device initialization still pending |
| G-05 | Implement notification permission UX | Testing | Permission request occurs at an appropriate user-controlled time | G-04 | App-only Notifications settings control implemented; no automatic first-launch prompt |
| G-06 | Associate device/subscription with logged-in user | Testing | OneSignal identity follows ChatPalez login/logout | D-08, G-04 | Native bridge calls OneSignal login with ChatPalez user ID and logout when no authenticated user; device verification pending |
| G-07 | Handle foreground notifications | Testing | Foreground notification behavior defined/tested | G-04 | Native foreground listener implemented and proceeds with display; device test pending |
| G-08 | Handle background notifications | Planned | Background-delivered notifications work reliably | G-02, G-03, G-04 | Requires configured push credentials and device testing |
| G-09 | Implement notification-click routing | Testing | Tap opens correct ChatPalez destination | G-04, C-01 | Native click listener validates same-origin ChatPalez URLs and routes external HTTP(S) outside app |
| G-10 | Implement deep-link parsing/validation | Testing | Only valid/approved routes are opened | C-02 | `chatpalez://open` registered on Android+iOS; same-origin validation/rejection tests implemented; emulator OS-delivery test queued |
| G-11 | Configure notification badges where applicable | Planned | Badge counts update/reset predictably | G-04 | Platform support/runtime behavior still to implement |

---

# EPIC H — Native Share and Device Actions

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| H-01 | Implement native share bridge | Testing | Supported ChatPalez content invokes OS share sheet | B-02, C-01 | Capacitor Share + backend bridge implemented; runtime test pending |
| H-02 | Validate phone/email/external-app intents | Testing | Intent links launch safely | C-04 | AppLauncher/native routing implemented for `tel:` and `mailto:`; runtime test pending |
| H-03 | Add haptic feedback selectively | Testing | Haptics used only for appropriate native interactions | B-02 | Light feedback limited to phone/mail handoff and push-permission success; device feel check pending |

---

# EPIC I — Social Network Regression Testing

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| I-01 | Feed/home regression test | Planned | Feed loads, scrolls and refreshes without critical issues | C/D complete | Android+iOS |
| I-02 | Post creation regression test | Planned | Text/media post flows work | F complete | Android+iOS |
| I-03 | Reactions/comments regression test | Planned | Interaction controls function correctly | I-01 | Android+iOS |
| I-04 | Profile/account regression test | Planned | Profile viewing/editing works | D/F complete | Android+iOS |
| I-05 | Messaging regression test | Planned | Conversations, send/receive and composer behave correctly | D/E/F complete | High priority |
| I-06 | Notifications screen regression test | Planned | In-app notification center works | D complete | Includes app-only native push control |
| I-07 | Search/friends/groups/pages regression test | Planned | Primary discovery/community flows work | C/D complete | Based on enabled product features |
| I-08 | Settings/privacy regression test | Planned | Key account/settings flows function | D complete | Include blocking/logout/deletion paths |

---

# EPIC J — Audio, Video and Calling

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| J-01 | Test audio playback and notification sounds | Planned | Audio plays predictably on both platforms | E complete | Check silent/background behavior |
| J-02 | Test microphone permission/use | Planned | Voice/call features can request and use mic | F-06 | Android+iOS |
| J-03 | Test camera use during calling | Planned | Video call camera can initialize if feature is enabled | F-06 | Android+iOS |
| J-04 | Test existing Agora/WebRTC call flow | Planned | Incoming/outgoing call behavior assessed and documented | J-01–J-03 | Major uncertainty |
| J-05 | Implement WebView-specific call fixes | Planned | Fixes applied if feasible inside initial architecture | J-04 | Scope depends on findings |
| J-06 | Decide native-calling remediation if WebView is insufficient | Planned | Decision recorded; native rewrite deferred or scoped | J-04 | Can become post-v1 work |

---

# EPIC K — App Lifecycle and Reliability

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| K-01 | Test cold start | Testing | App launches reliably from terminated state | Core build | Android instrumentation now tests real container launch; latest emulator acceptance run queued; iOS runtime still pending |
| K-02 | Test foreground/background transitions | Planned | App resumes without broken/duplicated state | Core build | Android+iOS |
| K-03 | Test process/app restart | Planned | App returns to valid session/navigation state | D-03 | Android+iOS |
| K-04 | Test connectivity loss during active session | Planned | User receives recoverable behavior | C-10 | Android+iOS |
| K-05 | Test backend/server unavailable state | Planned | App does not remain blank or crash | C-09 | Android+iOS |
| K-06 | Add production-safe logging/error diagnostics | Completed | Useful diagnostics without exposing sensitive data | Core build | Local and server-rendered bridges use bounded in-memory buffers with recursive token/password/session redaction; redaction tests added |

---

# EPIC L — Security and Compliance

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| L-01 | Review permissions for least privilege | Testing | Only required permissions remain | F/G/J complete | Camera/mic/photo are justified; OneSignal location disabled; no broad storage/location permission added |
| L-02 | Review HTTPS and navigation restrictions | Testing | Production app does not allow unsafe/untrusted internal navigation | C complete | HTTPS origin policy and URL unit tests implemented; Android cleartext disabled, iOS ATS arbitrary-load override prohibited; runtime verification pending |
| L-03 | Review embedded config for secrets | Testing | Release bundle/repo contains no privileged secret | B/G complete | Credential files excluded; OneSignal App ID is public configuration, FCM/APNs/signing secrets remain external |
| L-04 | Verify content-reporting flow | Testing | User can report objectionable UGC | Backend feature | Backend reporting engine verified; installed-app UI submission still needs runtime regression |
| L-05 | Verify user-blocking flow | Testing | User can block abusive users | Backend feature | Backend block/unblock logic and Settings Blocking surface verified; runtime regression pending |
| L-06 | Verify moderation/filtering capability | Testing | Existing moderation path documented/tested | Backend/admin | Reporting/admin-moderator infrastructure documented in `APP_STORE_COMPLIANCE.md`; production admin handling still to test |
| L-07 | Verify support/contact information | Planned | User-accessible support/contact route exists | Client/backend | Public footer route identified; live page-body verification remains |
| L-08 | Verify privacy-policy route | Planned | Valid privacy policy accessible | Client/backend | Existing templates reference `/static/privacy`; final live-content verification still required |
| L-09 | Verify account-deletion flow | Testing | Account deletion requirement is satisfied | Backend feature | Authenticated/password-confirmed delete endpoint and Settings `/settings/delete` UI verified; disposable-account device test pending |
| L-10 | Prepare privacy/data disclosure inventory | Completed | Collected data/device permissions mapped for store forms | L-01–L-09 | Data categories, UGC/media/messages, device identifiers, diagnostics and optional modules documented in `APP_STORE_COMPLIANCE.md` |

---

# EPIC M — Release Engineering

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| M-01 | Configure Android signing/release build | Blocked | Release signing strategy configured securely | Google/client signing credentials | Unsigned release AAB compiles; existing Play highest `versionCode` and upload signing key are required before final signing |
| M-02 | Produce Android AAB | Planned | Installable/store-ready AAB produced successfully | M-01, regression complete | CI already proves unsigned `bundleRelease`; final store-ready AAB remains blocked by M-01 |
| M-03 | Configure iOS signing/team/capabilities | Blocked | Xcode resolves signing and required capabilities | Apple Developer access | Unsigned simulator build passes; Apple team/APNs/signing required |
| M-04 | Produce iOS archive | Planned | Release archive builds without critical errors | M-03, regression complete | Requires signed macOS/Xcode environment |
| M-05 | Prepare TestFlight build | Planned | Build uploads/validates for TestFlight | M-04, App Store Connect | External Apple processing may take time |
| M-06 | Final Android/iOS regression pass | Planned | No unresolved release-blocking defect | All critical epics | Physical devices preferred |
| M-07 | Prepare store-readiness checklist | Testing | Icons, privacy, permissions, descriptions and support links checked | L complete | `RELEASE_CHECKLIST.md`, `RELEASE_INPUTS.md`, runtime QA matrix and build-metadata gate exist; final assets/URLs/accounts remain |
| M-08 | Tag/document initial release candidate | Planned | Release candidate version and commit recorded | M-02–M-07 | Build metadata generation is implemented; tag waits for signed/runtime-accepted candidate |

---

# External Dependencies / Inputs Required

| Dependency | Needed for | Current status |
|---|---|---|
| Production ChatPalez URL | Web container integration | Verified: `https://chatpalez.com`; production mobile contract check added |
| Backend mobile integration | Official shell/native bridge | PR #1 merged to backend `master` as `2bc9488`; live-server deployment verification queued |
| Android application ID | Existing Play app identity | Verified: `com.chatpalez` |
| Android existing version history | Store update versioning | Need highest existing Google Play `versionCode`; development `versionCode 1` must not ship as update |
| iOS bundle ID ownership | App Store identity/signing | Awaiting Apple Developer account confirmation; native project currently uses `com.chatpalez` |
| Apple Developer Program access | iOS signing/APNs/TestFlight | Blocked pending access |
| App Store Connect access | TestFlight/submission | Needed before release upload |
| Firebase/FCM access | Android native push | Blocked pending credentials/configuration |
| OneSignal access/mobile platform configuration | Cross-platform native push | Blocked pending Android/iOS platform configuration; SDK integration is implemented |
| Google Play Console/signing access | Android release/publishing | Blocked before signed release |
| Final app icon/source branding | Native branding | Blocked pending definitive source artwork |
| Privacy policy/support URL/content | Store compliance | Routes/content still being verified |

---

# Two-Week Execution View

## Days 1–2 — Foundation

Primary backlog: A-03–A-07, B-01–B-08, C-01–C-03.

Current result: native Android/iOS projects exist, compile in CI, production origin/package identity and platform floors are established, and the hybrid bridge architecture is implemented.

## Days 3–4 — Core mobile behavior

Primary backlog: C-04–C-10, D-01–D-08, E-01–E-07, initial F tasks.

Current result: backend mobile integration is merged to `master`, native shell detection/bridge code is in place, iOS navigation policy is implemented, and Android live-WebView contract tests are now part of instrumentation. Remaining focus is live deployment + authenticated runtime verification.

## Days 5–6 — Native integrations

Primary backlog: F completion, G-01–G-11, H-01–H-03.

Current result: OneSignal SDK, identity bridge, permission UX, click/foreground routing, native Share, AppLauncher, Keyboard, Haptics and custom deep links are implemented. Delivery testing is blocked on FCM/APNs/OneSignal mobile platform configuration.

## Days 7–8 — Social-network regression

Primary backlog: I-01–I-08, J-01–J-06, K-01–K-06.

Current focus: production-contract gate, Android runtime bridge assertion, then authenticated feed/profile/media/messaging/settings/call regression.

## Days 9–10 — Security, release and submission readiness

Primary backlog: L-01–L-10, M-01–M-08.

Current progress: compliance/privacy inventory, release-input runbook, platform support policy, go/no-go checklist, build metadata and unsigned release AAB are in place. Signing, store accounts, final assets and physical-device acceptance remain external gates.

---

# Risk Register

| Risk | Probability | Impact | Mitigation / Tracking |
|---|---|---|---|
| Existing web auth/OAuth redirects behave differently in WKWebView/Android WebView | Medium | High | Session architecture audited; runtime-test early under Epic D; external/new-window policy already implemented |
| Existing Agora/WebRTC calling is unstable in mobile WebViews | Medium–High | High | Investigate under Epic J; do not hide a native rewrite inside v1 scope |
| Native push credentials/config arrive late | High | High | SDK/bridge work completed independently; G-01–G-03 explicitly Blocked until credentials arrive |
| Apple rejects a thin website wrapper | Medium | High | Native push/share/intents/lifecycle/keyboard/deep-link integrations plus UGC compliance evidence are being delivered |
| Existing mobile templates have WebView-specific layout/input defects | Medium | Medium | Safe-area and keyboard integration implemented; device regression required |
| CI validation overwrites newer native source | Low | High | Fixed: native workflows are read-only; obsolete artifact-persist job removed and concurrency cancels stale runs |
| Backend master is not yet deployed to public server | Medium | High | Production contract workflow probes normal-vs-official UA responses and bridge assets before integration is marked complete |
| Store review extends beyond two-week engineering window | Medium | Medium | Goal remains submission-ready engineering build, not guaranteed approval date |

---

# Change Log

| Date | Change |
|---|---|
| 2026-09-15 | Initial backlog created. Architecture review and architecture/scope document marked Completed. |
| 2026-09-15 | Added TypeScript/Vite/Capacitor 8 foundation, environment abstraction, secret-safety rules, local startup/offline shell, trusted-host configuration and README/build workflow. |
| 2026-09-15 | Added native lifecycle/back/deep-link handling, native share bridge, backend official-shell integration, safe-area bootstrap and native scaffold CI. |
| 2026-09-15 | Native Android and iOS projects persisted and validated. Production package identity corrected to `com.chatpalez`; Android debug and iOS unsigned simulator builds pass. |
| 2026-09-15 | Added OneSignal Capacitor SDK, app-only web-SDK suppression, ChatPalez-user identity sync, permission UX, foreground/click routing, media permission descriptions and location-module exclusion. |
| 2026-09-15 | Added AppLauncher and Keyboard plugins plus app-only intent/external-link/keyboard bridge. Added App Store/UGC compliance audit. Reconciled tracker from incorrect 63-task summary to the actual 99 backlog rows and marked external-dependency items Blocked. |
| 2026-09-15 | Major integration milestone: backend mobile PR merged to `master` (`2bc9488`); Android/iOS deep-link registration and security hardening added; unsigned release AAB proven; diagnostics/privacy/release runbooks completed. |
| 2026-09-15 | Fixed native CI stale-artifact write-back race by making validation read-only and removing automatic native-project commits; added concurrency cancellation for obsolete runs. |
| 2026-09-15 | Added production mobile contract workflow plus Android live-WebView assertions for official UA, production origin, mobile bridge objects and OS custom-scheme delivery. |
