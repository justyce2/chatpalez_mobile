# ChatPalez Mobile — Architecture, Scope and Delivery Design

**Repository:** `justyce2/chatpalez_mobile`  
**Target platforms:** Android and iOS  
**Delivery model:** Hybrid mobile application using Capacitor  
**Existing platform:** ChatPalez PHP/Smarty social-network backend and mobile-responsive web experience  
**Target implementation window:** 2 weeks / 10 working days for a submission-ready first release

---

## 1. Purpose

This document is the technical and delivery source of truth for converting the existing ChatPalez mobile web experience into a maintainable Android and iOS hybrid application without rewriting the social network from scratch.

The project will reuse the existing ChatPalez web platform for the majority of social-network screens and business logic, while a Capacitor-based native shell provides mobile-device integration, app lifecycle handling, notifications, deep links, permissions, native navigation behavior, and store-ready Android/iOS projects.

The goal is not to create another website wrapper. The goal is to create a hybrid mobile product that preserves the proven web platform while adding the native capabilities expected from an installed social-network application.

---

## 2. Current Platform Assessment

The existing ChatPalez platform is a server-rendered PHP application using Smarty templates. Its frontend is based on traditional web technologies, Bootstrap and JavaScript libraries rather than a standalone React, Vue or Angular SPA.

The current mobile experience appears to be implemented primarily through responsive/mobile-specific presentation inside the existing theme. The existing backend already manages core social-network functionality such as authentication, feeds, profiles, messaging, notifications, media and other platform features.

The existing backend therefore remains the system of record. The mobile application will integrate with it rather than reproduce all backend logic.

### Key architectural implication

A conventional Capacitor project normally packages local web assets. ChatPalez is server-rendered, so the mobile architecture must deliberately separate:

- the native mobile shell and bridge code;
- the existing remotely served ChatPalez application;
- native integrations that cannot rely on browser-only implementations;
- backend changes required specifically for mobile integration.

---

## 3. Target Architecture

### 3.1 High-level structure

```text
+---------------------------------------------------------+
|                  Android / iOS App                      |
|                                                         |
|  +---------------------------------------------------+  |
|  | Capacitor Native Shell                            |  |
|  |                                                   |  |
|  | - App lifecycle                                   |  |
|  | - Native navigation handling                      |  |
|  | - Push notifications                              |  |
|  | - Deep links                                      |  |
|  | - Camera / media permissions                      |  |
|  | - Share / downloads                               |  |
|  | - Status bar / splash / keyboard                  |  |
|  | - Network/offline handling                        |  |
|  | - Native bridge                                   |  |
|  +-------------------------+-------------------------+  |
|                            |                            |
|                 Secure WebView / Bridge                |
+----------------------------+----------------------------+
                             |
                             | HTTPS
                             v
+---------------------------------------------------------+
|                 Existing ChatPalez Web App              |
|                                                         |
| PHP + Smarty + JavaScript + Bootstrap                  |
| Existing mobile-responsive interface                   |
| Existing sessions / authentication                     |
| Social feed / profiles / messaging / media / calls     |
+----------------------------+----------------------------+
                             |
                             v
+---------------------------------------------------------+
|                  Existing Backend                      |
| Database / storage / notifications / social services   |
+---------------------------------------------------------+
```

### 3.2 Repository responsibility

`chatpalez_mobile` will contain both mobile platforms. A separate iOS repository is not required.

Expected structure:

```text
chatpalez_mobile/
├── android/
├── ios/
├── src/
│   ├── bridge/
│   ├── navigation/
│   ├── notifications/
│   ├── lifecycle/
│   └── platform/
├── public/
├── docs/
│   ├── ARCHITECTURE_AND_SCOPE.md
│   └── BACKLOG.md
├── capacitor.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

Platform-specific configuration remains in `android/` and `ios/`. Shared bridge and application behavior remains in the shared source directories.

---

## 4. Recommended Technology Stack

### Mobile runtime

- Capacitor
- TypeScript
- Minimal local HTML/CSS/JavaScript shell

### Android

- Capacitor Android
- Android Studio / Gradle
- Kotlin/Java only where a native plugin or platform-specific fix requires it
- Firebase Cloud Messaging through the selected push provider

### iOS

- Capacitor iOS
- Xcode
- Swift/Objective-C only where native integration requires it
- Apple Push Notification service through the selected push provider

### Push notifications

Recommended first-release approach: OneSignal Capacitor SDK backed by FCM for Android and APNs for iOS.

The existing web OneSignal service-worker files are not a replacement for native mobile push. Native registration and device-token handling must be configured independently.

---

## 5. Core Design Principles

1. **Do not rewrite working social-network functionality unnecessarily.** Reuse the existing platform where doing so does not compromise mobile usability, security or store compliance.
2. **Native where it matters.** Notifications, permissions, deep links, lifecycle events, sharing, app navigation and selected device integrations should behave like a mobile application.
3. **Backend remains authoritative.** Existing ChatPalez business logic, content, users and sessions remain controlled by the current backend.
4. **Shared Android/iOS code first.** Platform-specific code should be introduced only when required.
5. **Secure navigation.** The application must restrict WebView navigation to trusted ChatPalez origins and intentionally open unsupported external destinations outside the app.
6. **No embedded secrets.** API secrets, Apple private keys, server credentials and privileged tokens must never be committed to the mobile repository.
7. **Store readiness is part of engineering.** App-review requirements are considered during development rather than after the build is finished.

---

## 6. Functional Scope

### 6.1 Project foundation

We will:

- initialize the Capacitor/TypeScript project;
- create Android and iOS native projects;
- define application ID/bundle identifier once client ownership details are confirmed;
- establish development and production configuration;
- configure the trusted ChatPalez web origin;
- establish a bridge layer between web content and native functionality;
- create environment/configuration rules that avoid committing secrets.

### 6.2 Web application container

The mobile app will:

- load the approved ChatPalez mobile experience securely;
- maintain authenticated sessions correctly;
- support internal ChatPalez navigation;
- prevent unintended external sites from taking over the app WebView;
- open suitable external links using the operating system/browser when required;
- provide loading, error, no-network and retry states;
- handle SSL/navigation failures gracefully.

### 6.3 Authentication and session handling

Initial implementation will reuse the proven web authentication/session flow unless inspection shows a mobile-specific blocker.

Work includes:

- login/logout verification;
- session-cookie persistence;
- CSRF/session compatibility;
- app restart/session restoration;
- social/OAuth callback testing where currently enabled;
- expired-session handling;
- safe navigation back to login when the server invalidates a session.

A fully token-native authentication rewrite is outside the initial two-week scope unless the existing platform makes it unavoidable.

### 6.4 Native navigation behavior

We will implement:

- Android hardware/system back-button behavior;
- internal history navigation;
- exit confirmation or root-screen handling where appropriate;
- external URL interception;
- deep-link routing;
- opening notification destinations inside the correct ChatPalez screen;
- safe handling of popup/new-window links.

### 6.5 Push notifications

We will implement the native notification foundation for both platforms:

- OneSignal Capacitor integration;
- FCM setup for Android;
- APNs setup for iOS;
- runtime notification permission flow where required;
- device registration;
- user/device association strategy;
- foreground notification handling;
- background notification handling;
- notification click/open behavior;
- deep linking from a notification to relevant ChatPalez content;
- notification badge handling where supported.

Backend modifications may be required so the installed-app identity can be associated with the logged-in ChatPalez user.

### 6.6 Camera, gallery and file handling

We will verify and implement the mobile behavior required for:

- profile/avatar upload;
- post photo upload;
- messaging attachments;
- camera capture;
- gallery/photo-library selection;
- file selection;
- permission handling;
- upload progress/failure scenarios where supported by the existing web flow.

Existing HTML file inputs will be reused where reliable. Native plugins will only be introduced where the WebView implementation is insufficient.

### 6.7 Sharing and external actions

The mobile bridge should support appropriate native handling for:

- system share sheet;
- `tel:` links;
- `mailto:` links;
- supported messaging links;
- maps/external browser links where applicable;
- downloadable files where the existing WebView does not provide an acceptable user experience.

### 6.8 Mobile UI integration

Native/container-level work includes:

- splash screen;
- app icon configuration;
- status bar behavior;
- safe-area handling;
- keyboard behavior;
- orientation policy;
- Android edge-to-edge compatibility where applicable;
- iOS safe-area/notch compatibility;
- loading indicator/screen;
- offline/error screen.

This project does not include a full redesign of the existing ChatPalez website. Mobile-web CSS/template defects that directly prevent acceptable app operation may be fixed in the backend as integration work.

### 6.9 Messaging, audio/video and real-time functionality

Existing messaging and communication features must be regression-tested inside the native WebView.

Testing will cover, where enabled on the platform:

- real-time/chat updates;
- notification sounds;
- audio playback;
- microphone permission;
- camera permission;
- Agora/browser calling behavior;
- incoming/outgoing call flows;
- foreground/background transitions during calls.

If a browser/WebView implementation cannot provide a stable calling experience, a native calling integration is treated as a separate remediation item and may exceed the first-release two-week scope.

### 6.10 App lifecycle and resilience

We will handle:

- first launch;
- cold start;
- foreground/background transitions;
- app resume;
- connectivity loss;
- connectivity recovery;
- process/app restart;
- invalid session;
- server unavailable state;
- navigation state restoration where practical.

### 6.11 Security hardening

Work includes:

- HTTPS-only production communication;
- trusted-host allow-listing;
- external navigation controls;
- preventing privileged secrets from entering the bundle;
- minimal permissions;
- secure cookie/session compatibility review;
- safe deep-link validation;
- production logging review;
- disabling unnecessary development/debug behavior in release builds.

### 6.12 User-generated-content and store-compliance review

Because ChatPalez is a social network, the release review must verify the platform's existing mechanisms for:

- reporting objectionable content;
- blocking abusive users;
- moderation/filtering capabilities;
- published support/contact information;
- privacy policy availability;
- account deletion capability where required;
- appropriate permission-purpose descriptions;
- data/privacy disclosures required by Google Play and Apple.

Backend/product changes required to satisfy these rules will be recorded in the backlog rather than silently excluded.

---

## 7. Non-Functional Scope

### Performance

- Avoid unnecessary duplicate reloads.
- Keep native startup shell lightweight.
- Optimize initial loading feedback.
- Validate media-heavy screens on realistic mobile connections.

### Reliability

- App should recover from temporary connection loss.
- Invalid URLs must not strand the user on blank screens.
- Native bridge calls must fail safely.

### Maintainability

- Shared functionality should not be duplicated separately in Android and iOS.
- Native integrations should be encapsulated behind bridge/service modules.
- Configuration should be documented.
- Backlog and architecture documents stay inside the repository.

### Compatibility target

Exact minimum Android/iOS versions will be finalized when the Capacitor version and client distribution requirements are locked. We will favor currently supported platform versions rather than unnecessarily broad legacy support.

---

## 8. Backend Integration Scope

Some changes may belong in `chatpalez-backend-2` rather than this repository. These may include:

- adding a reliable way for the web application to detect that it is running inside the official mobile shell;
- mapping native push subscription/device IDs to authenticated users;
- exposing safe mobile bridge hooks/events;
- correcting OAuth redirects for app-originated login;
- deep-link route support;
- mobile-specific logout/session synchronization;
- mobile UI fixes needed for WebView behavior;
- app-store compliance gaps discovered during audit.

Any backend modification must remain compatible with the existing website unless a deliberate breaking change is approved.

---

## 9. Out of Scope for the Initial Two-Week Release

Unless a blocker makes one mandatory, the following are not part of the initial conversion:

- rebuilding the complete social network in Flutter, React Native, Swift or Kotlin;
- replacing the PHP/Smarty backend;
- rewriting every page as a local SPA;
- redesigning the full website;
- migrating the database;
- replacing the current real-time/chat architecture;
- writing a complete new REST API for all ChatPalez features;
- a fully native Agora calling implementation;
- guaranteed Apple App Store or Google Play approval date.

These can become later phases after the hybrid release is stable.

---

## 10. Delivery Phases

### Phase 1 — Foundation and architecture

- repository setup;
- Capacitor initialization;
- configuration model;
- Android project;
- iOS project;
- local native shell;
- secure ChatPalez navigation.

### Phase 2 — Core application behavior

- authentication/session verification;
- back/navigation behavior;
- external link handling;
- keyboard/status bar/safe areas;
- error and offline states;
- uploads and permissions.

### Phase 3 — Native integrations

- OneSignal;
- FCM;
- APNs;
- notification routing;
- deep links;
- native share;
- selected file/download integrations.

### Phase 4 — Social-network regression testing

- feed;
- profile;
- reactions/comments;
- messaging;
- media;
- notifications;
- authentication;
- account settings;
- calls/audio/video where enabled.

### Phase 5 — Release engineering

- Android release build/AAB;
- iOS archive;
- TestFlight build;
- icons/splash;
- release configuration;
- store metadata/readiness checklist;
- privacy and permission review;
- final regression test.

---

## 11. Two-Week Working Schedule

### Working days 1–2

Architecture validation, Capacitor bootstrap, Android/iOS generation, secure container/navigation and first successful platform builds.

### Working days 3–4

Authentication/session behavior, back navigation, external URLs, keyboard, status bar, uploads, camera/gallery/file permissions and resilience states.

### Working days 5–6

Native push setup, FCM/APNs wiring, user-device association, notification click routing and deep links.

### Working days 7–8

End-to-end social-network regression testing, messaging/media/calling investigation, lifecycle fixes and platform-specific defects.

### Working days 9–10

Release hardening, Android AAB, iOS archive/TestFlight preparation, compliance checks, documentation and submission-ready packaging.

This schedule is a delivery target, not a guarantee of store-review completion. Apple and Google control their own review timelines.

---

## 12. Effort Estimate

The initial hybrid conversion is estimated at approximately **10–15 engineering days of effort**, concentrated into a two-week implementation window where possible.

The effort distribution is expected to be approximately:

| Area | Estimated effort |
|---|---:|
| Architecture/project setup | 1–1.5 days |
| Android/iOS shell and navigation | 1–2 days |
| Authentication/session/lifecycle | 1–1.5 days |
| Permissions/uploads/device integration | 1–1.5 days |
| Push notifications/deep links | 2–3 days |
| Social/messaging/media regression and fixes | 2–3 days |
| Release QA/store packaging | 1.5–2 days |

Some activities overlap. The largest uncertainty is not Capacitor itself; it is how existing web behaviors—particularly authentication redirects, media/calling, permissions and notification identity—behave inside iOS WKWebView and Android WebView.

---

## 13. Required Accounts, Keys and Access

Implementation may require the following from the client/project owner:

- production/staging ChatPalez URL;
- Apple Developer Program membership;
- App Store Connect access;
- final iOS bundle identifier;
- Google Play Console access;
- final Android application ID;
- Firebase project / Android FCM configuration;
- Apple APNs key/certificate configuration;
- OneSignal application access or a new mobile OneSignal application;
- final app name;
- production app icon and splash assets;
- privacy-policy URL;
- support/contact URL or details;
- physical Android/iOS testing access where available.

Secrets should be supplied through secure configuration channels and must not be committed to Git.

---

## 14. Definition of Done for Initial Release

The first mobile release is considered engineering-complete when:

- Android and iOS projects build successfully;
- the app loads only the approved ChatPalez experience;
- login, logout and persisted sessions behave correctly;
- primary social-network flows work in the mobile container;
- back navigation and external links behave correctly;
- essential camera/gallery/file permissions work;
- native push works on Android and iOS test devices;
- notification taps route correctly;
- offline/server-error states do not leave a blank unusable screen;
- release configuration contains no development secrets/debug configuration;
- Android release artifact can be produced;
- iOS archive/TestFlight build can be produced;
- critical defects in the project backlog are closed or explicitly accepted;
- store-readiness/compliance checks are completed.

Store approval itself is not part of the engineering Definition of Done because approval timing and final decisions are controlled by Apple and Google.

---

## 15. Delivery Governance

`docs/BACKLOG.md` is the living execution document for this architecture. Every implementation task should have a status. As work is completed, its status will be changed to **Completed** and relevant implementation/verification notes will be added.

Any newly discovered blocker or required scope item should be added to the backlog rather than being left undocumented.

Status definitions:

- **Planned** — accepted work not yet started.
- **In Progress** — implementation is actively underway.
- **Blocked** — work cannot continue until a dependency or external requirement is resolved.
- **Testing** — implementation exists and is undergoing verification.
- **Completed** — implementation and the applicable acceptance checks are complete.
- **Deferred** — intentionally moved out of the initial release scope.

---

## 16. Future Phase Opportunities

After the hybrid release is stable, ChatPalez can progressively replace selected high-value web screens with native/local experiences without changing the overall backend immediately. Potential candidates include native onboarding, notification center, media creation, chat, calls, offline caching and other high-frequency flows.

This progressive approach preserves delivery speed now while leaving a path toward a more deeply native product later.
