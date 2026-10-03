# ChatPalez Mobile — App Store and UGC Compliance Audit

**Date:** 2026-09-15  
**Scope:** Existing ChatPalez backend + Android/iOS hybrid client  
**Status:** Implementation audit in progress

## Purpose

This document tracks mobile-store-sensitive functionality that already exists in ChatPalez and what still needs runtime verification before Android/iOS release.

## User-Generated Content Safety

### Reporting objectionable content

**Implementation evidence:** Existing backend reporting logic validates report handles/categories, records reports, and notifies administrator/moderator roles.

**Current assessment:** Implemented in backend; mobile UI visibility and end-to-end submission still require device regression testing.

**Release requirement:** A signed-in user must be able to reach the report action from relevant user-generated content in the installed app and successfully submit a report.

### Blocking abusive users

**Implementation evidence:** Existing backend block/unblock logic removes applicable relationships/subscriptions and records the user block.

**Current assessment:** Implemented in backend. Settings already exposes a dedicated Blocking section. Profile/content-level block actions still require device regression testing.

**Release requirement:** A signed-in user must be able to block another user from the installed app and observe the expected interaction restrictions.

### Moderation/filtering

**Implementation evidence:** Reports can notify admin/moderator roles and the existing social-network backend contains moderation/report infrastructure.

**Current assessment:** Backend capability exists; administrator moderation handling should be verified against the production configuration.

## Account Deletion

**Implementation evidence:**

- `includes/ajax/users/delete.php` requires an authenticated user.
- Demo accounts are protected from deletion.
- Password confirmation is required.
- Successful confirmation invokes the existing user deletion operation.
- The Settings template exposes **Delete Account** at `/settings/delete` when `delete_accounts_enabled` is enabled.

**Current assessment:** Implementation and user-facing route exist.

**Release requirement:** Confirm `delete_accounts_enabled` is enabled in the release environment and complete one end-to-end deletion test using a disposable account before submission.

## Privacy and User Controls

The existing Settings navigation exposes:

- Privacy
- Blocking
- Security settings
- Notification settings
- Delete Account when enabled

The public ChatPalez footer also exposes Privacy and Contact Us routes. Automated public retrieval has confirmed the links exist, although the crawler has not yet successfully fetched the dynamic privacy/contact page bodies, so content verification remains open.

**Current assessment:** Core user-control surfaces and public routes exist. The installed app must be checked for responsive layout, keyboard behavior, navigation/back behavior and successful form submission.

## Mobile Permissions

The hybrid client currently declares only permissions justified by existing ChatPalez functionality:

### Android

- Internet
- Camera
- Microphone

### iOS

- Camera usage description
- Microphone usage description
- Photo library usage description

No location permission has been added for the initial mobile release. The OneSignal native build is configured with its location module disabled during validation.

## Push Notifications

The web OneSignal SDK is suppressed for official `ChatPalezMobile/1.0` requests without modifying the backend's real server-side notification configuration.

The mobile repository includes the native OneSignal Capacitor SDK and the iOS Capacitor application-notification delegation setting required for native notification integration.

Implemented mobile push integration now includes:

- silent native SDK initialization when the server has a OneSignal App ID
- ChatPalez user ID mapped to OneSignal external ID on authenticated pages
- OneSignal logout when the installed app is no longer associated with an authenticated ChatPalez user
- app-only permission/status control under Notifications settings
- no automatic first-launch notification prompt
- foreground notification listener
- trusted notification-click routing back into `https://chatpalez.com`
- external HTTP(S) notification links routed outside the app container

**Still blocked or unverified:**

- Android Firebase/FCM credentials and OneSignal Android platform configuration
- Apple APNs key/capability and OneSignal iOS platform configuration
- real-device subscription registration and delivery
- background notification delivery
- notification-click routing on physical devices

No credential should be guessed or committed to the repository. A OneSignal App ID is public configuration, not a privileged secret.

## Data and Privacy Disclosure Inventory

This is a working inventory for Google Play Data Safety and Apple App Privacy forms. Final declarations must be confirmed against production configuration, enabled modules and the published privacy policy.

### Account and profile data

Existing sign-up/account flows collect or can contain:

- first name and last name
- username
- email address
- password credential handled by the server
- birth date
- profile/account attributes configured by the social network
- profile image and other user-selected media

Potential store disclosure category: **Personal Info**.

### User-generated content

ChatPalez is a social network and therefore processes content users choose to create or send, including potentially:

- posts and comments
- reactions and social relationships
- messages/conversations
- photos and videos
- voice/audio content where enabled
- profile/account content
- groups/pages/community activity
- reports submitted about content/users

Potential store disclosure categories: **User Content**, **Messages**, **Photos or Videos**, **Audio Data**, depending on final enabled production features.

### Device and app activity data

The existing web/backend architecture can process operational data needed for sessions, security and functionality, including:

- authenticated session/cookie state
- IP/network request metadata handled by the server/web stack
- app/web route activity necessary to render requested content
- OneSignal native push subscription/device identifiers once push is configured
- notification permission/subscription state

Potential store disclosure categories: **Identifiers**, **App Activity**, or **Diagnostics**, depending on what is retained and linked in production.

### Native diagnostics

The mobile integration includes a small in-memory diagnostics ring buffer for official-app requests. It is designed to avoid privileged data:

- URL query strings and fragments are not retained in route entries
- bearer values are redacted
- token/access-token/auth-key/session/secret/password query values are redacted
- only a short recent event buffer is retained in memory
- diagnostics are not currently uploaded to a third-party analytics service

If this changes before release, the privacy disclosure inventory must be updated.

### Camera, microphone and photos

The installed app declares camera/microphone/photo access because existing ChatPalez functionality can include media upload, voice/video communication and profile/content media selection. These permissions should be requested only when a user invokes a relevant feature.

Potential store disclosure categories: **Photos or Videos** and **Audio Data** if selected/captured content is uploaded to ChatPalez.

### Location

The initial mobile release does **not** add a native location permission and OneSignal location support is disabled in native CI. Do not declare native precise/coarse location collection solely because the OneSignal SDK is present.

If the existing web application has an optional browser geolocation feature enabled in production, that must be reviewed separately before completing store declarations.

### Advertising, payments and optional modules

The backend contains optional social-network modules and third-party integrations. Before final submission, confirm which production features are enabled because they can alter disclosure requirements, especially:

- advertising/measurement integrations
- payment or wallet features
- social/OAuth login providers
- calling/live video providers
- optional geolocation/maps
- analytics scripts configured by administrators

The mobile wrapper must not make a narrower privacy declaration than the actual production service it presents.

## Store Release Gates

The following must be verified before marking the mobile app store-ready:

1. Reporting is reachable and submits correctly in the installed app.
2. Blocking is reachable and works in the installed app.
3. Account deletion is enabled and completes successfully from the installed app.
4. Privacy policy and support/contact page bodies are live and reachable.
5. Camera, microphone and photo permissions appear only when the related feature is used.
6. Push credentials are configured outside source control and notification delivery/click routing is tested.
7. Final privacy/data-safety disclosures match actual production data collection, enabled modules, third-party SDKs and device permissions.
8. Android release signing and iOS team/signing/capabilities are configured using client-controlled store accounts.
9. Final app icon/splash artwork is supplied and applied.
10. Android/iOS regression passes cover login/session, posting/media, messaging, settings/privacy/deletion and enabled calling/live features.

## Current Conclusion

The existing ChatPalez backend already contains the major UGC safety and account-deletion capabilities needed by a social-network mobile app. The hybrid client now adds meaningful native functionality around the existing web product: native lifecycle/back/deep-link behavior, Share, Browser/AppLauncher intents, Keyboard integration, Haptics, native OneSignal plumbing and app-only diagnostics.

The largest remaining uncertainties are runtime/device regression, enabled production feature/privacy verification, FCM/APNs/OneSignal platform credentials, release signing/store accounts and final branding assets rather than construction of the core mobile shell itself.
