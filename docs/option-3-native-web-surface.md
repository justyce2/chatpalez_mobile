# Option 3 — Native Web Content Surface

Status: implementation complete; device validation pending.

## Architecture

The shared Capacitor document owns the persistent ChatPalez header, bottom navigation, Create sheet, and API-driven local screens. Remote Sngine pages render in a dedicated native content surface between the shared header and bottom navigation.

- Android: dedicated `WebView` exposed through `WebContentSurfacePlugin`.
- iOS: dedicated `WKWebView` exposed through the same Capacitor contract.
- No iframe or `srcdoc` retained-web surface.
- Existing authenticated `mobile-session.php` POST contract is preserved.
- Chat, Profile, and Notifications remain API/local screens and are not rewritten.

## Milestones

- [x] M1 Protect existing authentication and API/local screen contracts.
- [x] M2 Add shared TypeScript `WebContentSurface` contract.
- [x] M3 Add Android native WebView implementation and thin MainActivity registration.
- [x] M4 Connect shared shell web destinations to the native content surface.
- [x] M5 Hide/show native surface around Chat, Profile, Notifications, and Create.
- [x] M6 Add iOS WKWebView implementation using the same shared contract.
- [x] M7 Add navigation history, trusted-origin enforcement, external-link handling, and route events.
- [x] M8 Preserve native web state across local-screen transitions and reset it at login/session boundaries.
- [x] M9 Add bidirectional native-surface messaging for share, media picker, external URLs, and web-to-local Chat/Profile/Notifications transitions.
- [x] M10 Remove obsolete iframe session branch and audit relevant source for iframe/srcdoc remnants.

## Validation gate

The code milestones are complete, but release validation still requires real builds/devices:

1. `npm run build`
2. `npx cap sync android`
3. Android Gradle debug build and device/emulator smoke test.
4. Verify authenticated Home/Groups/Pages/Reels navigation inside the middle surface.
5. Verify header/footer remain visible while the native surface navigates.
6. Verify Chat/Profile/Notifications hide the web surface and preserve their current API behavior.
7. Verify Android Back traverses native web history before minimizing the app.
8. Verify media picker, sharing, external URLs, and web-to-local commands.
9. Build the iOS target in Xcode and repeat the equivalent WKWebView/safe-area/lifecycle checks.

Do not mark release validation complete until Android and iOS builds have been exercised. GitHub Actions are intentionally not required or triggered by this implementation workflow.
