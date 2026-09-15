# ChatPalez Mobile — Runtime QA Matrix

**Purpose:** Repeatable acceptance coverage for the Capacitor Android/iOS client before release.

**Production origin:** `https://chatpalez.com`  
**Android application ID:** `com.chatpalez`  
**iOS bundle ID in project:** `com.chatpalez` (Apple ownership/signing confirmation still required)

## Test Environments

Run the critical path on:

- Android emulator/API 35 for automated smoke coverage.
- At least one physical Android device for camera, microphone, file picker, notifications and background behavior.
- iOS Simulator for navigation/layout/session smoke coverage.
- At least one physical iPhone for camera, microphone, photos, APNs notifications and background behavior.

Use disposable test accounts for destructive/account-deletion tests.

## Severity

- **P0:** release blocker; crash, auth failure, data-loss/security issue, unusable core flow.
- **P1:** major functionality broken with no acceptable workaround.
- **P2:** degraded/non-critical behavior or visual issue.
- **P3:** polish.

## Core Container and Navigation

| ID | Platform | Test | Expected result | Severity |
|---|---|---|---|---|
| NAV-01 | Android/iOS | Cold launch app | ChatPalez loads without native crash or blank permanent screen | P0 |
| NAV-02 | Android/iOS | Open same-origin ChatPalez link | Link remains inside app | P1 |
| NAV-03 | Android/iOS | Open external HTTPS link | Link opens outside the ChatPalez app container | P1 |
| NAV-04 | Android/iOS | Open `tel:` link | OS phone handler is invoked where supported | P2 |
| NAV-05 | Android/iOS | Open `mailto:` link | OS mail handler is invoked where supported | P2 |
| NAV-06 | Android | Navigate 2+ pages, press Back | Web history moves back; root behavior does not crash | P1 |
| NAV-07 | iOS | Navigate 2+ pages and swipe from left edge | WKWebView history gesture works without creating duplicate native navigation | P2 |
| NAV-08 | Android/iOS | Trigger same-origin `_blank` link | Destination remains in app | P1 |
| NAV-09 | Android/iOS | Trigger external `_blank` link | Destination opens externally | P1 |
| NAV-10 | Android/iOS | Kill network before launch | Local connection error/offline UX appears; retry works after reconnect | P1 |

## Authentication and Session

| ID | Platform | Test | Expected result | Severity |
|---|---|---|---|---|
| AUTH-01 | Android | Standard login | User reaches authenticated home/feed | P0 |
| AUTH-02 | iOS | Standard login | User reaches authenticated home/feed | P0 |
| AUTH-03 | Android/iOS | Terminate/reopen after login | Session persists according to web session policy | P0 |
| AUTH-04 | Android/iOS | Logout | Session is cleared and user returns to signed-out experience | P0 |
| AUTH-05 | Android/iOS | Reopen after logout | User remains signed out | P0 |
| AUTH-06 | Android/iOS | Submit authenticated forms | No mobile-specific CSRF/session failures | P0 |
| AUTH-07 | Android/iOS | Let/force session expire | User is safely returned to login without redirect loop | P1 |
| AUTH-08 | Android/iOS | Enabled OAuth/social login | Provider completes and returns to valid ChatPalez session | P1 |

## Feed, Profiles and Social Actions

| ID | Platform | Test | Expected result | Severity |
|---|---|---|---|---|
| SOC-01 | Android/iOS | Load/scroll feed | Stable scrolling and content rendering | P0 |
| SOC-02 | Android/iOS | Create text post | Post submits and appears correctly | P0 |
| SOC-03 | Android/iOS | React/comment | Interaction saves and UI updates | P1 |
| SOC-04 | Android/iOS | Open/edit profile | Profile and settings remain usable | P1 |
| SOC-05 | Android/iOS | Search users/content | Results and navigation work | P1 |
| SOC-06 | Android/iOS | Friends/groups/pages | Enabled discovery/community flows work | P1 |

## Media and Files

| ID | Platform | Test | Expected result | Severity |
|---|---|---|---|---|
| MED-01 | Android | Change avatar from gallery | Picker opens and upload completes | P0 |
| MED-02 | iOS | Change avatar from Photos | Permission/picker flow works and upload completes | P0 |
| MED-03 | Android/iOS | Capture/upload image if camera option is present | Permission is contextual and upload succeeds | P1 |
| MED-04 | Android/iOS | Create post with image/video | Media upload and post complete | P0 |
| MED-05 | Android/iOS | Send message attachment | Attachment can be selected and sent | P0 |
| MED-06 | Android/iOS | Download/open supported attachment | User can access the downloaded content or OS handler | P1 |
| MED-07 | Android/iOS | Cancel picker/permission | App returns safely without error loop | P2 |

## Keyboard and Layout

| ID | Platform | Test | Expected result | Severity |
|---|---|---|---|---|
| UI-01 | Android/iOS | Focus login fields | Active input is visible above keyboard | P0 |
| UI-02 | Android/iOS | Open chat composer | Composer remains usable while keyboard is visible | P0 |
| UI-03 | Android/iOS | Dismiss keyboard | Layout returns without stuck offset | P1 |
| UI-04 | iPhone with notch/home indicator | Navigate key screens | Content respects safe areas | P1 |
| UI-05 | Modern Android edge-to-edge device | Navigate key screens | No clipped toolbar/composer/content | P1 |
| UI-06 | Android/iOS | Status bar on light/dark content | System status area stays legible | P2 |

## Messaging and Audio/Video

| ID | Platform | Test | Expected result | Severity |
|---|---|---|---|---|
| CHAT-01 | Android/iOS | Open existing conversation | Conversation loads normally | P0 |
| CHAT-02 | Android/iOS | Send/receive text message | Message flow works without duplicate sends | P0 |
| CHAT-03 | Android/iOS | Notification/chat sounds | Audio behavior is acceptable for foreground state | P2 |
| CALL-01 | Android/iOS | Start voice call | Microphone permission is contextual; call connects if feature enabled | P0 |
| CALL-02 | Android/iOS | Start video call | Camera/mic initialize and call connects if enabled | P0 |
| CALL-03 | Android/iOS | Receive call while app foregrounded | Existing Agora/WebRTC flow is usable | P1 |
| CALL-04 | Android/iOS | Background/resume around call | State does not corrupt or crash | P1 |

## Native Push

Run these only after OneSignal + FCM/APNs are configured.

| ID | Platform | Test | Expected result | Severity |
|---|---|---|---|---|
| PUSH-01 | Android/iOS | Open Notifications settings | App-only native push control is visible | P1 |
| PUSH-02 | Android/iOS | Tap Enable | OS prompt appears only after explicit action | P1 |
| PUSH-03 | Android/iOS | Grant permission | Control reports enabled state | P1 |
| PUSH-04 | Android/iOS | Login | OneSignal external ID matches current ChatPalez user ID | P0 |
| PUSH-05 | Android/iOS | Logout | Native push identity is detached | P0 |
| PUSH-06 | Android/iOS | Receive foreground push | Defined foreground display behavior occurs once | P1 |
| PUSH-07 | Android/iOS | Receive background push | OS notification is delivered | P0 |
| PUSH-08 | Android/iOS | Tap internal notification link | Correct same-origin ChatPalez destination opens | P0 |
| PUSH-09 | Android/iOS | Tap external notification URL | URL leaves app container | P1 |

## App Lifecycle and Resilience

| ID | Platform | Test | Expected result | Severity |
|---|---|---|---|---|
| LIFE-01 | Android/iOS | Cold launch | Valid state; no native crash | P0 |
| LIFE-02 | Android/iOS | Background 30–60s then resume | Session/page remains valid | P1 |
| LIFE-03 | Android/iOS | OS terminates/relaunches app | App returns to a valid navigation/session state | P1 |
| LIFE-04 | Android/iOS | Lose network while active | UI fails recoverably and can reconnect | P1 |
| LIFE-05 | Android/iOS | Backend unavailable | Local error path prevents permanent blank screen | P1 |

## Safety, Privacy and Account Controls

| ID | Platform | Test | Expected result | Severity |
|---|---|---|---|---|
| SAFE-01 | Android/iOS | Report objectionable content/user | Report submits successfully | P0 |
| SAFE-02 | Android/iOS | Block user | Block takes effect and restricted interactions stop | P0 |
| SAFE-03 | Android/iOS | Open Privacy settings | Controls render and save correctly | P1 |
| SAFE-04 | Android/iOS | Open Delete Account | Deletion route is visible when feature is enabled | P0 |
| SAFE-05 | Android/iOS | Delete disposable account | Password-confirmed deletion completes | P0 |
| SAFE-06 | Android/iOS | Inspect permission timing | Camera/mic/photos/notifications are requested contextually | P0 |
| SAFE-07 | Android/iOS | Trigger diagnostic errors | Diagnostic buffer contains no password/session/access-token secrets | P0 |

## Release Gates

A release candidate must not be marked ready while any P0 test fails. P1 failures require an explicit accepted workaround or fix before submission. Store signing, APNs/FCM, final artwork and store metadata remain separate external-input gates.
