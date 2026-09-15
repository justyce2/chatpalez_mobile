# ADR-001 — Hybrid Web Container Strategy

**Status:** Accepted  
**Date:** 2026-09-15

## Context

ChatPalez is a server-rendered PHP/Smarty social network. Its mobile experience is not a separately built SPA that can simply be copied into Capacitor's `webDir`.

Capacitor provides `server.url` and `server.allowNavigation`, but its v8 documentation explicitly describes those options as intended for live-reload/development and not production. The production app therefore must not depend on those options as its permanent architecture.

## Decision

The mobile app will use a local Capacitor application shell plus a controlled native web-container integration for the existing ChatPalez mobile experience.

The native shell owns:

- application lifecycle
- Android hardware back behavior
- deep-link entry
- notification routing
- native share/haptics/device integrations
- native error/offline presentation
- trusted-origin policy
- release configuration and store identity

The ChatPalez backend owns:

- authentication/session state
- server-rendered social-network UI
- feed, profile, messages, groups/pages and settings workflows
- server-side authorization and CSRF controls
- a small official-mobile-app bridge script when the request is from the official shell

## Identification

The official app will append a stable user-agent token:

`ChatPalezMobile/1.0`

The backend may use that token only to alter presentation/integration behavior. It must never treat the token as proof of authentication or authorization.

## Bridge Contract

The bridge is versioned. Web pages may emit custom events for supported native actions and may listen for app lifecycle/navigation events.

Initial bridge namespace:

`window.ChatPalezMobile`

Initial capabilities:

- `isNativeApp()`
- `platform()`
- `bridgeVersion`
- `share(payload)`
- `openExternal(url)`
- `notifyRouteChanged(url)`

Unsupported actions must fail safely and leave normal web behavior available.

## Security Rules

1. Only HTTPS ChatPalez production/staging origins may be treated as internal.
2. `javascript:`, `data:`, unapproved custom schemes and untrusted HTTP(S) hosts must never be loaded as internal content.
3. Authentication remains server-controlled. The native shell must not fabricate login state.
4. The mobile user-agent token is identification, not authorization.
5. Secrets must not be embedded in Vite/JavaScript configuration.

## Consequences

This approach preserves the existing mobile web product and avoids a full React Native/Flutter rewrite inside the two-week window. It does require a thin integration layer in the ChatPalez backend and platform-specific web-container verification on Android and iOS.
