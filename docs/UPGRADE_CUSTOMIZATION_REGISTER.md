# ChatPalez Mobile — Upgrade Customization Register

**Purpose:** Track every retained non-stock Sngine/mobile extension so future Sngine upgrades can preserve only justified work. This register contains no credentials, JWTs, API secrets or signing material.

## Admission rule

A customization remains only when the official Sngine API/function audit proves it is necessary. Prefer official routes and business logic. Where an exception is retained, it must be isolated, documented and revalidated against every upstream Sngine update.

## Current entries

| ID | Area | Upstream capability audited | Why the extension exists | Current implementation | Status |
|---|---|---|---|---|---|
| CUS-001 | Mobile API request access | Fresh Sngine API validates requests using an HMAC derived from server-only `system_api_secret`; authenticated API requests validate the Sngine JWT/session. | A distributed Android/iOS app cannot contain the server HMAC secret. | Small mobile-aware request-validation path in `apis/php/utils/functions.php`; retains normal Sngine HMAC behavior for server-to-server callers and relies on normal JWT/session validation for protected mobile requests. | Audit/Isolation Pending |
| CUS-002 | Local app → retained-web authentication | Fresh Sngine API returns/accepts JWT authentication, but no stock endpoint was identified that converts the JWT into normal web session cookies for a controlled WebView transition. | Retained web modules need a normal Sngine web session without exposing a JWT in a URL. | `mobile-session.php` receives POST-only token/path input, validates server-side, establishes normal Sngine cookies and redirects only to a validated internal path. | Testing |
| CUS-003 | Notification list API | Fresh Sngine exposes the existing user method `get_notifications()`, but no stock route was identified in the fresh API modules. | The local Alerts screen needs the existing notification data without duplicating its business logic. | Minimal `apis/php/modules/notifications` route/controller delegates directly to `$user->get_notifications(...)`. | Testing / Re-audit on update |

## Explicit non-custom work

- Mobile TypeScript API services: client-side adapters over official Sngine routes; not backend APIs.
- OneSignal user/device association: use the official `POST /user/onesignal` route; do not create a duplicate endpoint.
- Auth, signup, activation, onboarding, 2FA, password recovery, account deletion, blocked users, upload/reporting and messaging: use confirmed official Sngine routes.
- App-specific retained-web styling: duplicate theme only; not part of these backend extensions.

## Upgrade procedure

1. Import the new Sngine release into a clean reference branch; do not overwrite production or current ChatPalez customizations.
2. Audit the new official API/routes for each register entry. Remove an entry when Sngine now provides an equivalent safe capability.
3. Diff only the named files/paths above against the new upstream release.
4. Reapply the smallest necessary isolated change; never merge an entire old core file over the new upstream version.
5. Run the applicable contract and device tests:
   - CUS-001: public bootstrap/auth and protected JWT request authorization;
   - CUS-002: POST-only transition, rejected external destinations, cookie continuity and logout/expiry;
   - CUS-003: pagination, notification rendering and authorization.
6. Update this register with the upstream version, implementation commit, retained/removed decision and test result.

## Next audit actions

1. Determine whether CUS-001 can be moved from the stock utility file into a more isolated server integration boundary without weakening request validation.
2. Reconfirm CUS-002 remains necessary after the v1 retained-web module list is finalized.
3. Re-audit CUS-003 against every new Sngine API release before retaining it.
