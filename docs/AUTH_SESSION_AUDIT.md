# ChatPalez Mobile — Authentication and Session Audit

**Scope:** Existing ChatPalez PHP session/auth behavior as used by the Capacitor remote-origin client.

## Architecture Observation

The mobile app loads the production ChatPalez origin (`https://chatpalez.com`) as the active WebView origin rather than copying authentication state into a separate native token store. That means the existing PHP web session remains the primary authentication mechanism for the initial hybrid release.

This is intentional for v1: it minimizes changes to a mature social-network backend and avoids creating a second authentication system that could drift from browser behavior.

## Existing PHP Session Security

`includes/functions.php::init_system_session()` currently:

- enables `session.cookie_httponly`;
- enables `session.cookie_secure` whenever the request protocol is HTTPS;
- starts the PHP session;
- creates the existing server-side session secret when absent.

Because the approved mobile production origin is HTTPS, the normal mobile session cookie should therefore be Secure + HttpOnly.

## SameSite Assessment

The application code does not explicitly set `session.cookie_samesite` in `init_system_session()`.

For the standard login flow this is not automatically a blocker because the app is loading and submitting against the same ChatPalez HTTPS origin. However, SameSite behavior can matter around external OAuth/social-login redirects, especially when a provider returns through a cross-site callback or POST.

**Decision:** do not change the existing website-wide SameSite policy speculatively during the mobile conversion. Test the enabled OAuth providers in the installed Android/iOS app first. If a provider fails specifically because the expected PHP session cookie is not returned, scope the smallest provider/session fix with browser regression coverage.

## Mobile Authentication Risks to Test

1. **Standard login** — username/email + password establishes the normal PHP session.
2. **Session persistence** — terminating/reopening the app retains the expected authenticated WebView cookie store.
3. **Logout** — server logout removes authenticated state and the native OneSignal bridge detaches the external user identity on the resulting logged-out page.
4. **Expired session** — protected pages/actions return safely to login without a loop.
5. **CSRF/session secret** — posting, messaging, profile editing and settings actions continue to use the existing server session/secret successfully.
6. **OAuth/social login** — enabled providers return to a usable ChatPalez session after leaving/re-entering the app/web context.
7. **Account switching** — if the production feature is enabled, ensure push identity and browser session represent the same active user after a switch.
8. **Cookie-domain redirects** — avoid introducing `www.chatpalez.com` ↔ `chatpalez.com` redirects that split or unexpectedly replace session cookies.

## Native Push Identity Relationship

Native push identity is not the authentication mechanism. The mobile bridge reads the authenticated ChatPalez user ID rendered by the server and calls the OneSignal native login/external-ID API. On logged-out pages it detaches the previously associated push identity.

The `ChatPalezMobile/1.0` user-agent marker must never be used as proof that a request is authenticated or authorized.

## Acceptance Criteria

Authentication/session work can move to Completed only after the runtime QA matrix proves:

- Android standard login;
- iOS standard login;
- authenticated form/CSRF actions;
- restart persistence;
- logout + post-logout restart;
- session expiry behavior;
- every OAuth provider that will remain enabled in the release.

Any untested OAuth provider should either be tested before release or disabled in the release configuration; it should not be assumed compatible from browser behavior alone.
