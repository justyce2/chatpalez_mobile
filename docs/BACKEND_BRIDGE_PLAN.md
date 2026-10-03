# ChatPalez Backend Bridge Plan

The mobile app requires a thin backend integration layer so the existing PHP/Smarty mobile experience can cooperate with native Android/iOS capabilities without duplicating the social network frontend.

## Backend changes required

1. Detect the official mobile shell presentation token (`ChatPalezMobile/1.0`) from the user agent.
2. Expose a Smarty boolean such as `$is_chatpalez_mobile_app` for presentation only.
3. Include a small `mobile-app-bridge.js` asset only when that flag is true.
4. Add a CSS/body marker for app-specific safe-area or navigation fixes where required.
5. Never use the mobile-app marker to grant authentication or authorization.
6. Keep all normal browser behavior as the fallback when no native bridge is present.

## Initial web-to-native events

- `chatpalez:share` — request native share sheet.
- `chatpalez:open-external` — request safe external URL open.
- `chatpalez:route-changed` — report current route to native shell.
- `chatpalez:bridge-ready` — native bridge has become available.
- `chatpalez:app-state` — app foreground/background state changed.

## Implementation policy

Backend integration should be isolated so it can be removed without changing the core social-network business logic. Existing login, feed, posting, messaging and profile workflows remain server-owned.
