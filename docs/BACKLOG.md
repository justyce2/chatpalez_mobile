# ChatPalez Mobile — Delivery Backlog and Status Tracker

**Repository:** `justyce2/chatpalez_mobile`  
**Architecture source:** `docs/ARCHITECTURE_AND_SCOPE.md`  
**Target:** Android + iOS hybrid mobile application using Capacitor  
**Initial delivery window:** 2 weeks / 10 working days

---

## Status Legend

| Status | Meaning |
|---|---|
| Planned | Accepted but not started |
| In Progress | Actively being implemented |
| Blocked | Waiting on a dependency, account, key, decision or backend change |
| Testing | Implemented and undergoing verification |
| Completed | Implemented and acceptance checks passed |
| Deferred | Deliberately moved beyond the initial release |

---

## Overall Progress

| Metric | Current |
|---|---:|
| Total tracked tasks | 63 |
| Completed | 7 |
| In Progress | 5 |
| Testing | 12 |
| Blocked | 0 |
| Planned | 39 |
| Deferred | 0 |

> Update rule: whenever a feature or task is completed, update its row, completion count, notes and—where relevant—the commit/PR reference.

---

# EPIC A — Discovery and Architecture

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| A-01 | Inspect existing ChatPalez backend architecture | Completed | Backend/frontend architecture and mobile implementation approach identified | Access to `chatpalez-backend-2` | Existing PHP/Smarty/Bootstrap architecture reviewed |
| A-02 | Define mobile architecture and scope | Completed | Architecture, scope, delivery phases, risks and DoD documented | A-01 | See `ARCHITECTURE_AND_SCOPE.md` |
| A-03 | Validate production/staging web origin strategy | In Progress | Approved URL(s), SSL behavior and environment approach documented | Backend URL/access | Production architecture recorded in ADR-001; final approved origin still required |
| A-04 | Confirm Android application ID | Planned | Final unique package ID approved | Client/product decision | `com.chatpalez.mobile` is provisional only |
| A-05 | Confirm iOS bundle identifier | Planned | Final unique bundle ID approved | Apple Developer account | `com.chatpalez.mobile` is provisional only; must match App Store configuration |
| A-06 | Confirm app display name and branding assets | Planned | Name, icon source and splash assets approved | Client assets | Working display name is ChatPalez; final source assets still required |
| A-07 | Confirm minimum Android/iOS support targets | Planned | Minimum supported versions recorded in project docs/config | Capacitor version decision | Capacitor 8 selected; generated projects will define final platform values |

---

# EPIC B — Project Foundation

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| B-01 | Initialize Node/TypeScript project | Completed | `package.json`, TypeScript config and scripts committed | None | TypeScript + Vite foundation committed on `develop` |
| B-02 | Install and configure Capacitor core/CLI | Completed | Capacitor initialized with valid config | B-01, A-04, A-05 | Capacitor 8 config passes CI build and `cap doctor`; store identifiers remain provisional |
| B-03 | Create minimal local app shell | Testing | Local shell renders loading/error/offline states | B-02 | Shell, retry flow, safe-area layout and startup states implemented; device verification pending |
| B-04 | Add Android Capacitor project | In Progress | `android/` project generated and sync succeeds | B-02 | CI has generated/synced Android successfully; debug Gradle build is running before scaffold is accepted |
| B-05 | Add iOS Capacitor project | In Progress | `ios/` project generated and sync succeeds | B-02 | macOS CI job running; Xcode simulator build without signing is the acceptance gate |
| B-06 | Add environment/config abstraction | Completed | Dev/prod origins and non-secret config separated cleanly | B-02 | `.env.example` and validated public runtime configuration committed |
| B-07 | Add `.gitignore` and secret-safety rules | Completed | Native build artifacts, local configs and credentials excluded | B-01 | APNs, Firebase, signing files, local env and native build outputs excluded |
| B-08 | Add project README/build instructions | Completed | Fresh developer can understand setup/build flow | B-01–B-07 | Setup, native generation, sync, environments and branch strategy documented |

---

# EPIC C — Secure Web Container and Navigation

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| C-01 | Load approved ChatPalez origin in app | In Progress | App consistently opens correct mobile experience | B-03, A-03 | Remote-origin loading strategy is being moved into controlled native-container integration; do not use Capacitor `server.url` in production |
| C-02 | Implement trusted-host allow-list | Testing | Only approved ChatPalez origins can remain inside app WebView | C-01 | HTTPS/trusted-host policy and navigation classification implemented; native delegate enforcement still needs runtime verification |
| C-03 | Implement external URL interception | Testing | External links open with appropriate system/browser behavior | C-02 | Safe HTTP/HTTPS external-open helper and backend bridge hooks implemented; native runtime verification pending |
| C-04 | Handle `tel:` / `mailto:` / app links | Testing | Supported URI schemes hand off to OS correctly | C-03 | `tel:` and `mailto:` accepted by safe scheme policy; device handoff still requires testing |
| C-05 | Implement popup/new-window handling | Planned | Links using new window do not fail silently | C-03 | Common with OAuth/social links |
| C-06 | Implement Android back-button behavior | Testing | Back navigates history correctly and root behavior is predictable | C-01 | Capacitor App back handler implemented; real WebView history behavior still needs Android runtime test |
| C-07 | Define iOS navigation/back behavior | Planned | Web history and native gestures produce acceptable UX | C-01 | Validate WKWebView behavior after iOS scaffold is generated |
| C-08 | Implement loading state | Testing | User sees intentional loading UI before remote content is ready | B-03, C-01 | Local startup loading state implemented; native runtime verification pending |
| C-09 | Implement server/error state | Planned | SSL/load/server errors show recoverable UI | B-03, C-01 | Configuration/startup errors handled; native remote-load failure handling still required |
| C-10 | Implement offline state and reconnect | Testing | Offline state shown; app can recover after network returns | C-01 | Network plugin listener/retry flow implemented; device verification pending |

---

# EPIC D — Authentication and Session Lifecycle

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| D-01 | Verify standard login in Android WebView | Planned | Login succeeds and lands on expected authenticated screen | C-01 | Use real test account after native container is operational |
| D-02 | Verify standard login in iOS WKWebView | Planned | Login succeeds and lands on expected authenticated screen | C-01, B-05 | Requires iOS runtime |
| D-03 | Verify session persistence after app restart | Planned | Authenticated user remains signed in as expected | D-01, D-02 | Review cookie/session behavior |
| D-04 | Verify logout synchronization | Planned | Server logout clears mobile session correctly | D-01, D-02 | No stale authenticated WebView |
| D-05 | Handle expired/invalid server session | Planned | User is redirected safely to login when session expires | D-03 | No redirect loops |
| D-06 | Verify CSRF/session-token compatibility | Planned | Posting/forms/actions work without mobile-specific CSRF failures | D-01, D-02 | Backend fix if needed |
| D-07 | Test enabled social/OAuth login flows | Planned | Enabled providers return correctly to app/session | C-05, D-01, D-02 | May require callback/deep-link work |
| D-08 | Add official-mobile-shell detection mechanism | Testing | Backend/client can reliably distinguish official app context | Backend change if required | `ChatPalezMobile/1.0` presentation marker and backend bridge implemented on backend draft PR #1; integration test pending |

---

# EPIC E — Native UI Integration

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| E-01 | Configure splash screen | Planned | Correct splash displays on Android and iOS | A-06, B-04, B-05 | Base Capacitor behavior configured; final branding pending |
| E-02 | Configure app icons | Planned | Required Android/iOS icon sets generated and applied | A-06 | Store-ready sizes |
| E-03 | Configure status bar | Testing | Status bar does not clash with app UI | B-04, B-05 | StatusBar plugin/bootstrap handling implemented; runtime confirmation pending |
| E-04 | Configure safe-area handling | Testing | Content avoids notches/home indicators | C-01 | Local CSS safe-area handling plus backend `viewport-fit=cover`/safe-area variables implemented; iOS runtime verification pending |
| E-05 | Configure keyboard behavior | Planned | Forms/messages remain usable when keyboard opens | C-01 | Test chat composer and login |
| E-06 | Define orientation behavior | Planned | App orientation policy documented and configured | Product decision | Likely portrait-first unless calls/media require otherwise |
| E-07 | Validate Android edge-to-edge behavior | Planned | No content clipping on current Android UI modes | B-04 | Device/emulator testing |

---

# EPIC F — Media, Camera and File Handling

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| F-01 | Test profile/avatar upload on Android | Planned | Camera/gallery/file upload succeeds | D-01 | Existing HTML input first |
| F-02 | Test profile/avatar upload on iOS | Planned | Camera/gallery upload succeeds | D-02 | WKWebView/photo permission behavior |
| F-03 | Test feed/post media upload | Planned | Image/video upload works in social posting flow | F-01, F-02 | Validate large files |
| F-04 | Test messaging attachments | Planned | Attachments can be selected and sent | F-01, F-02 | Chat flow regression |
| F-05 | Add native camera/gallery bridge if required | Planned | Native fallback exists only if web input is insufficient | F-01–F-04 | Avoid unnecessary native complexity |
| F-06 | Configure permission descriptions | Planned | Android/iOS declare accurate camera/photo/microphone reasons | F-01–F-05 | Required for store review |
| F-07 | Implement download/file-open handling | Planned | Supported downloads can be accessed by the user | C-03 | Platform-specific handling may differ |

---

# EPIC G — Push Notifications and Deep Links

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| G-01 | Confirm/create OneSignal mobile app | Planned | Mobile OneSignal app/config available | Account access | Existing web push is not sufficient |
| G-02 | Configure Android Firebase/FCM | Planned | Android push credentials accepted and test device registers | Firebase access, B-04 | Do not commit private credentials |
| G-03 | Configure Apple APNs | Planned | APNs key/cert and capability setup valid | Apple Developer access, B-05 | Bundle ID must be final |
| G-04 | Install OneSignal Capacitor SDK | Planned | SDK initializes on Android/iOS without runtime errors | G-01–G-03 | Shared integration |
| G-05 | Implement notification permission UX | Planned | Permission request occurs at an appropriate time | G-04 | iOS and recent Android behavior differ |
| G-06 | Associate device/subscription with logged-in user | Planned | Backend can target the correct ChatPalez user/device | D-08, G-04 | May require backend endpoint/change |
| G-07 | Handle foreground notifications | Planned | Foreground notification behavior defined and tested | G-04 | Avoid disruptive duplicates |
| G-08 | Handle background notifications | Planned | Background-delivered notifications work reliably | G-04 | Device testing required |
| G-09 | Implement notification-click routing | Planned | Tap opens correct ChatPalez destination | G-04, C-01 | Key native value-add |
| G-10 | Implement deep-link parsing/validation | Testing | Only valid/approved routes are opened | G-09, C-02 | App URL listener and trusted-route normalization implemented; universal/app-link configuration and runtime test pending |
| G-11 | Configure notification badges where applicable | Planned | Badge counts update/reset predictably | G-04 | Platform support differs |

---

# EPIC H — Native Share and Device Actions

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| H-01 | Implement native share bridge | Testing | Supported ChatPalez content invokes OS share sheet | B-02, C-01 | Capacitor Share bridge plus backend/web bridge contract implemented; native runtime test pending |
| H-02 | Validate phone/email/external-app intents | Planned | Intent links launch safely | C-04 | Android+iOS runtime verification |
| H-03 | Add haptic feedback selectively | Planned | Haptics used only for appropriate native interactions | B-02 | Optional polish, not overused |

---

# EPIC I — Social Network Regression Testing

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| I-01 | Feed/home regression test | Planned | Feed loads, scrolls and refreshes without critical issues | C/D complete | Android+iOS |
| I-02 | Post creation regression test | Planned | Text/media post flows work | F complete | Android+iOS |
| I-03 | Reactions/comments regression test | Planned | Interaction controls function correctly | I-01 | Android+iOS |
| I-04 | Profile/account regression test | Planned | Profile viewing/editing works | D/F complete | Android+iOS |
| I-05 | Messaging regression test | Planned | Conversations, send/receive and composer behave correctly | D/E/F complete | High priority |
| I-06 | Notifications screen regression test | Planned | In-app notification center works | D complete | Distinct from native push |
| I-07 | Search/friends/groups/pages regression test | Planned | Primary discovery/community flows work | C/D complete | Based on enabled product features |
| I-08 | Settings/privacy regression test | Planned | Key account/settings flows function | D complete | Include logout/deletion paths |

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
| K-01 | Test cold start | Planned | App launches reliably from terminated state | Core build | Android+iOS |
| K-02 | Test foreground/background transitions | Planned | App resumes without broken/duplicated state | Core build | Android+iOS |
| K-03 | Test process/app restart | Planned | App returns to valid session/navigation state | D-03 | Android+iOS |
| K-04 | Test connectivity loss during active session | Planned | User receives recoverable behavior | C-10 | Android+iOS |
| K-05 | Test backend/server unavailable state | Planned | App does not remain blank or crash | C-09 | Android+iOS |
| K-06 | Add production-safe logging/error diagnostics | In Progress | Useful diagnostics without exposing sensitive data | Core build | Diagnostics helper and security rules added; integrate into remaining failure paths before completion |

---

# EPIC L — Security and Compliance

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| L-01 | Review permissions for least privilege | Planned | Only required permissions remain | F/G/J complete | Store/security requirement |
| L-02 | Review HTTPS and navigation restrictions | Planned | Production app does not allow unsafe/untrusted navigation | C complete | Security-critical |
| L-03 | Review embedded config for secrets | Planned | Release bundle/repo contains no privileged secret | B/G complete | Security-critical |
| L-04 | Verify content-reporting flow | Planned | User can report objectionable UGC | Backend feature | App Store UGC requirement |
| L-05 | Verify user-blocking flow | Planned | User can block abusive users | Backend feature | App Store UGC requirement |
| L-06 | Verify moderation/filtering capability | Planned | Existing moderation path documented/tested | Backend/admin | App Store UGC requirement |
| L-07 | Verify support/contact information | Planned | User-accessible support/contact route exists | Client/backend | Store readiness |
| L-08 | Verify privacy-policy route | Planned | Valid privacy policy accessible | Client/backend | Store metadata dependency |
| L-09 | Verify account-deletion flow | Planned | Account deletion requirement is satisfied or remediation scoped | Backend feature | Apple policy-sensitive |
| L-10 | Prepare privacy/data disclosure inventory | Planned | Collected data and device permissions mapped for store forms | L-01–L-09 | Google/Apple declarations |

---

# EPIC M — Release Engineering

| ID | Task | Status | Acceptance / Definition of Done | Dependencies | Notes |
|---|---|---|---|---|---|
| M-01 | Configure Android signing/release build | Planned | Release signing strategy configured securely | Google/client credentials | Do not commit keystore secrets |
| M-02 | Produce Android AAB | Planned | Installable/store-ready AAB produced successfully | M-01, regression complete | Final build artifact |
| M-03 | Configure iOS signing/team/capabilities | Planned | Xcode resolves signing and required capabilities | Apple Developer access | Push capability included |
| M-04 | Produce iOS archive | Planned | Release archive builds without critical errors | M-03, regression complete | Requires macOS/Xcode |
| M-05 | Prepare TestFlight build | Planned | Build uploads/validates for TestFlight | M-04, App Store Connect | External Apple processing may take time |
| M-06 | Final Android/iOS regression pass | Planned | No unresolved release-blocking defect | All critical epics | Physical devices preferred |
| M-07 | Prepare store-readiness checklist | Planned | Icons, privacy, permissions, descriptions and support links checked | L complete | Submission preparation |
| M-08 | Tag/document initial release candidate | Planned | Release candidate version and commit recorded | M-02–M-07 | End of engineering phase |

---

# External Dependencies / Inputs Required

These are not implementation tasks by themselves, but delays here can block implementation:

| Dependency | Needed for | Current status |
|---|---|---|
| Final ChatPalez staging/production URL | Web container integration | Needed; env/config and architecture support implemented |
| Android application ID | Native project/store identity | Needed; provisional `com.chatpalez.mobile` in development config |
| iOS bundle ID | Native project/App Store identity | Needed; provisional `com.chatpalez.mobile` in development config |
| Apple Developer Program access | iOS signing/APNs/TestFlight | Needed before release work |
| App Store Connect access | TestFlight/submission | Needed before release work |
| Firebase/FCM access | Android native push | Needed before push phase |
| OneSignal access/new mobile app | Cross-platform native push | Needed before push phase |
| Google Play Console access | Android publishing | Needed before submission |
| App icon/source branding | Native branding | Needed before release packaging |
| Privacy policy/support URL | Store compliance | Needed before submission |

---

# Two-Week Execution View

## Days 1–2 — Foundation

Primary backlog: A-03–A-07, B-01–B-08, C-01–C-03.

Exit condition: both native platform projects exist, basic app container works and first builds are possible.

## Days 3–4 — Core mobile behavior

Primary backlog: C-04–C-10, D-01–D-08, E-01–E-07, initial F tasks.

Exit condition: navigation, login/session, offline/error handling, keyboard/safe-area and core media-selection paths operate acceptably.

## Days 5–6 — Native integrations

Primary backlog: F completion, G-01–G-11, H-01–H-03.

Exit condition: push/device registration and notification routing work in test environments, subject to external credentials being available.

## Days 7–8 — Social-network regression

Primary backlog: I-01–I-08, J-01–J-06, K-01–K-06.

Exit condition: major existing social functionality has been exercised on both platforms and critical WebView-specific defects are resolved or explicitly scoped.

## Days 9–10 — Security, release and submission readiness

Primary backlog: L-01–L-10, M-01–M-08.

Exit condition: release artifacts can be produced and the application is engineering-ready for TestFlight/Google Play submission.

---

# Risk Register

| Risk | Probability | Impact | Mitigation / Tracking |
|---|---|---|---|
| Existing web auth/OAuth redirects behave differently in WKWebView/Android WebView | Medium | High | Test early under Epic D |
| Existing Agora/WebRTC calling is unstable in mobile WebViews | Medium–High | High | Investigate under Epic J; do not hide a native rewrite inside v1 scope |
| Native push requires backend user-device association work | High | Medium–High | Track G-06 + backend changes explicitly |
| Apple rejects a thin website wrapper | Medium | High | Deliver meaningful native integrations and verify social-network compliance |
| Apple/Firebase/OneSignal access arrives late | Medium | High | Core app can progress, but push/release items become Blocked |
| Existing mobile templates have WebView-specific layout/input defects | Medium | Medium | Fix only integration-critical backend/mobile CSS issues during v1 |
| Store review extends beyond two-week engineering window | Medium | Medium | Define goal as submission-ready build, not guaranteed approval date |

---

# Change Log

| Date | Change |
|---|---|
| 2026-09-15 | Initial backlog created. Architecture review and architecture/scope document marked Completed. All implementation tasks initialized for the two-week delivery plan. |
| 2026-09-15 | Implementation started on `develop`. Added TypeScript/Vite/Capacitor 8 foundation, environment abstraction, secret-safety rules, local startup/offline shell, trusted-host configuration and README/build workflow. B-01/B-06/B-07/B-08 marked Completed; B-02/B-03/C-08/C-10 moved to Testing; A-03/C-02 moved to In Progress. |
| 2026-09-15 | Mobile CI now passes. Added trusted navigation helpers, native lifecycle/back/deep-link handling, native share bridge, backend official-shell bridge on draft backend PR #1, safe-area bootstrap and native scaffold CI. B-02 marked Completed; B-04/B-05/C-01/K-06 moved to In Progress; C-02/C-03/C-04/C-06/D-08/E-03/E-04/G-10/H-01 moved to Testing. |