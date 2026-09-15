# ADR-001 — Hybrid Web Container Strategy

**Status:** Accepted — revised after native bridge validation  
**Date:** 2026-09-15

## Context

ChatPalez is a server-rendered PHP/Smarty social network. Its mobile experience is not a separately built SPA that can simply be copied into Capacitor's `webDir`.

Capacitor v8 documents `server.url` as primarily intended for live-reload/development and not as its preferred production architecture. We initially planned to load the remote ChatPalez origin after a local Capacitor shell started.

During implementation we verified an important runtime constraint: Capacitor injects its JavaScript/native bridge for the configured application origin. Loading an unrelated remote origin after the bridge starts can leave that page without reliable Capacitor plugin bindings. That would undermine native share, push, lifecycle and other features we are specifically adding.

## Decision

For the initial ChatPalez hybrid release we will deliberately use a single, controlled HTTPS remote application origin as Capacitor's configured app origin:

`https://chatpalez.com`

This is an intentional exception to Capacitor's preferred bundled-web-assets model because the existing product is server-rendered and a full frontend rewrite is outside the two-week scope.

We will **not** use `server.allowNavigation` to create a broad navigation whitelist. Same-origin ChatPalez navigation remains inside the container; third-party navigation should leave the app through controlled external-link behavior.

The native project also retains bundled local assets for an error/fallback page.

## Production Identity

- Android application ID: `com.chatpalez`
- App display name: `ChatPalez`
- Production origin: `https://chatpalez.com`
- Official-shell user-agent token: `ChatPalezMobile/1.0`

The Android application ID intentionally matches the existing Google Play application so this work can upgrade the current app rather than create an unrelated listing.

## Responsibility Split

The native/Capacitor layer owns:

- application lifecycle
- Android hardware back behavior
- deep-link entry
- notification routing
- native share/device integrations
- error/offline fallback behavior
- app/store identity
- native permissions and signing

The ChatPalez backend owns:

- authentication/session state
- server-rendered social-network UI
- feed, profile, messages, groups/pages and settings workflows
- server-side authorization and CSRF controls
- the official-mobile-app bridge script and app-specific presentation hooks

## Identification

The official app appends:

`ChatPalezMobile/1.0`

The backend also exposes an `$is_chatpalez_mobile_app` presentation flag. Neither the user-agent token nor that flag is authorization. Authentication and authorization remain server-controlled.

## Bridge Contract

Capacitor injects its native runtime into the configured ChatPalez origin. The server-rendered application exposes a compatibility wrapper:

`window.ChatPalezMobileWeb`

Current bridge capabilities include:

- `isOfficialShell()`
- `platform()`
- `share(payload)`
- `openExternal(url)`
- `notifyRouteChanged()`

The bridge may use directly injected Capacitor plugin APIs when present and must retain browser-safe fallbacks.

## Security Rules

1. Production app content uses the verified HTTPS origin `https://chatpalez.com`.
2. No broad `allowNavigation` pattern or wildcard is configured.
3. `javascript:`, `data:` and other unsafe schemes are never treated as trusted application navigation.
4. Authentication remains server-controlled; the mobile marker never grants privilege.
5. Privileged credentials must never be embedded in Vite variables or committed native configuration.
6. Third-party web destinations should open outside the main social-network container unless a specific reviewed integration requires otherwise.
7. The remote-origin exception must not become a mechanism for silently replacing the native product with unrelated remotely delivered functionality.

## Store/Review Mitigation

Because a remote web origin can look like a thin website wrapper, the release must contain meaningful installed-app value beyond the website itself. The v1 scope therefore includes native push notifications, deep-link routing, native share, lifecycle/back handling, device/media integration where needed, app-specific safe-area/keyboard behavior and store-compliant permissions.

## Consequences

This decision preserves the existing mobile web product and keeps the two-week delivery target realistic while retaining Capacitor plugin binding. The trade-off is that ChatPalez availability remains dependent on the web service and the architecture requires stricter regression testing when backend UI changes are deployed.

A future standalone SPA/native frontend remains possible, but it is not required for this initial Android/iOS hybrid release.
