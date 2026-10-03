# ChatPalez Mobile — Implementation Notes

## 2026-09-15 — Foundation continuation

- Added production hybrid-container ADR.
- Removed dependence on Capacitor `server.url`/`allowNavigation` as a production strategy.
- Added stable `ChatPalezMobile/1.0` user-agent token for official-shell presentation detection only.
- Added trusted URL helpers and safe external URL handling.
- Added native lifecycle listeners for app URL opens, Android hardware back, app restore and app state changes.
- Added versioned `window.ChatPalezMobile` bridge with native share and route-change events.
- Wired bridge/lifecycle initialization into application bootstrap.
- Added CI workflow for Node 22, TypeScript/Vite build and Capacitor validation.

## Current architecture note

The existing PHP/Smarty mobile experience remains the source of truth for social-network screens. Native functionality is layered around it instead of duplicating feed/profile/chat logic in a second frontend during the initial delivery window.

The next code slice is backend integration for official-shell detection, followed by native platform generation and runtime testing.
