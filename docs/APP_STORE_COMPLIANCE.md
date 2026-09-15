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

**Release requirement:** A signed-in user must be able to reach the report action from the relevant user-generated content in the installed app and successfully submit a report.

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

**Current assessment:** Core user-control surfaces exist. The installed app must be checked for responsive layout, keyboard behavior, navigation/back behavior and successful form submission.

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

**Not yet complete:**

- final OneSignal mobile App ID
- Android Firebase/FCM configuration
- Apple APNs key/capability setup
- permission-prompt UX
- logged-in ChatPalez user ↔ native push subscription association
- notification-click routing verification on real devices

No credential or App ID should be guessed or committed to the repository.

## Store Release Gates

The following must be verified before marking the mobile app store-ready:

1. Reporting is reachable and submits correctly in the installed app.
2. Blocking is reachable and works in the installed app.
3. Account deletion is enabled and completes successfully from the installed app.
4. Privacy policy and support/contact routes are live and reachable.
5. Camera, microphone and photo permissions appear only when the related feature is used.
6. Push credentials are configured outside source control and notification delivery/click routing is tested.
7. Final privacy/data-safety disclosures match actual data collection and device permissions.
8. Android release signing and iOS team/signing/capabilities are configured using client-controlled store accounts.

## Current Conclusion

The existing ChatPalez backend already contains the major UGC safety and account-deletion capabilities needed by a social-network mobile app. The remaining work is primarily mobile UI/runtime verification, production configuration checks, native push credentials/integration, and release metadata/signing rather than building those compliance systems from scratch.
