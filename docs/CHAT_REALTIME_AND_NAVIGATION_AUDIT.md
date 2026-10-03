# Chat realtime and navigation audit — 2026-09-24

## Decision state

The navigation and header changes described below are implemented in the mobile source. The production two-account message delivery gate remains unverified until disposable credentials and a conversation are available. The findings and target model below are retained as the design record.

## Implementation verification

The shell now records ChatList, NewChat, and ChatThread as distinct destinations. Top Back and Android Back use the same destination stack; the new-chat Back delegates to it. Entering a web destination clears thread mode and restores the footer before the native web frame is measured. Native web open/hide calls are queued to prevent a late open from covering a local screen. A thread displays its participant identity and presence in the shared top header and its More action there.

### UI regression review

The follow-up source audit found and corrected four transition risks: overlapping tab requests could render an obsolete local page; delayed Profile/Notifications API responses could repaint a screen after navigation; an old chat room event could overwrite the current header; and the Chat tab from NewChat could leave a duplicate NewChat entry in Back history. The thread now keeps group participant status when message history refreshes, and the header More action has a 44px touch target. These are source-level checks; visual layout, keyboard behavior, native WebView frame sizing, and hardware Back still require an installed Android or iOS build. No browser engine or emulator was available in the audit workspace.

`npm run build`, 74 unit tests, `npm run verify:native` (24 checks), and `npx cap sync android` passed in the implementation workspace. APK assembly and device navigation remain to be checked on a machine with the Gradle distribution and Android SDK available. The `scripts/verify-chat-delivery.mjs` gate requires two disposable JWTs and a disposable conversation; no credentials were available during implementation. It verifies both directions through authenticated socket connects, room acknowledgements, sender acknowledgements, recipient events, and matching message IDs in both users' HTTP histories. A database row count and installed APK behavior still require separate verification.

## Evidence and limits

| Area | Observed evidence | Status |
| --- | --- | --- |
| Production Engine.IO | `GET /socket.io/?EIO=4&transport=polling` returned an Engine.IO open packet; a WebSocket upgrade returned HTTP 101 through Cloudflare on 2026-09-24. | Transport endpoint reachable; authenticated delivery unverified. |
| Mobile authentication | `ChatRealtimeService.connect()` supplies the API JWT as `auth.token`. The Node middleware accepts `handshake.auth.token` and looks up its session in `users_sessions`. | Source contract aligns; deployed Node version and session/DB configuration unverified. |
| Sending | `src/main.ts` uses Socket.IO for plain text only when connected. It otherwise uses HTTP; photo upload/messages use HTTP. `event_client_send_message` in `sockets/node/socket.js` invokes `post_conversation_message()` and acknowledges with a conversation after that call succeeds. | Source path exists; runtime send/ack unverified. |
| Persistence and receipt | The Node chat trait inserts `conversations_messages`, updates `last_message_id`, and returns the conversation. The socket server emits `event_server_message_received` to online recipients. The mobile receiver refreshes history through HTTP when it sees that event. | Code path aligns; no two-account production proof yet. |
| Failed/ambiguous send | The client falls back to HTTP when disconnected before submitting. A disconnect or missing acknowledgement after submission is treated as uncertain and does not automatically resend. | Source behavior; needs controlled duplicate test. |
| Recent mobile build | An earlier `npm run build` failed, followed by raw `npx cap sync android`, which copied a previous `dist`. The current source has an immediate pending bubble, long-press actions, connection status, and a last-delivery transport label. | Installed APK identity remains unverified. |

The public handshake does not prove that a mobile JWT authenticates, a message is persisted, or another user receives it. Do not call Socket.IO production-ready until the runtime checks below pass.

## Navigation defect: confirmed source path

1. The shell records `messages` as one destination. Opening a conversation changes only `ChatScreen` state; the shell stack has no thread destination.
2. `ChatScreen` marks the layout `is-active-conversation` and sets `nav.hidden = true` for the thread.
3. The top header Back button calls the shell's `navigateBack()`. It does not first ask the chat screen to leave the thread.
4. The shell pops the previous destination, commonly web Home. `renderDestination()` calls `showRetainedModule()` directly, bypassing `selectTab()` and therefore bypassing `chatScreen.deactivate()`.
5. The thread class and hidden footer remain. `showRetainedModule()` empties the middle content, then opens the native web surface. `currentFrame()` computes its bottom boundary from the hidden footer, which can yield a zero-height surface. This explains the blank middle with only the header visible.
6. Subsequent navigation is vulnerable to split state: the shell destination, chat thread state, footer visibility, and asynchronous native web surface are managed separately. The reported persistent footer loss needs device verification after the primary route fix; source alone does not prove every observed transition.

The thread's own Back button calls `ChatScreen.render()` and returns to the list. The top Back button and Android Back use the shell path. They must share one route decision.

## Target navigation model

Make destinations explicit: `Home/Web`, `ChatList`, `NewChat`, `ChatThread(conversation)`, `Profile`, and `Notifications`. The shell owns the destination and the chrome state; `ChatScreen` renders the selected chat state and reports thread metadata. It must not independently leave the shell in a hidden-footer state.

| Current state | Action | Target | Chrome rule |
| --- | --- | --- | --- |
| ChatThread | Top Back, thread Back, or Android Back | ChatList | Restore standard header and footer before rendering list. |
| NewChat | Top Back or Android Back | ChatList | Restore list state and footer. |
| ChatList | Back | Previous shell destination, then Home | Standard header/footer. |
| ChatThread | Global Profile/Notifications navigation | Selected destination | Exit thread chrome, show footer, hide native web surface as needed. Preserve a valid return destination in the shell stack. |
| Profile/Notifications reached from ChatThread | Back | ChatThread if still accessible, otherwise ChatList | Rebuild contextual header and room subscription exactly once. |
| Any local destination | Web destination | Web page | Clear thread state, show footer, then measure and open the native web surface. |

Back precedence: dismiss an open action sheet; leave a chat thread or new-chat form; traverse web history when on a web destination; pop the shell destination; finally return Home. Top Back and Android Back call the same dispatcher.

The route transition should be serialized: deactivate old screen and socket room, apply header/footer state, hide or show the native web surface, render destination, then measure/sync its frame. Reject or coalesce rapid repeated taps while a transition is in progress. Never calculate a web surface frame from a hidden footer.

## Contextual thread header

Keep the existing two-row shell dimensions and visual language. In a thread, replace the brand/title area with the other participant's photo and display name, or the group photo/name and member count. Show presence/last-seen below the name when supplied. The left Back control returns to ChatList. The right side contains the thread's More action; global Discover/Groups/Pages actions are hidden while the thread is active. The global header returns unchanged on ChatList and other destinations. Remove the duplicate in-content thread title/back controls after the contextual header is functional.

The participant block is display-only in the first implementation. A future tap-to-profile action requires a separately verified route and permission model. Provide a text fallback for missing photos and an accessible name for Back and More. The footer is hidden only in `ChatThread`, not in ChatList or NewChat.

## Programmatic delivery gate

Use two disposable accounts A and B and a disposable conversation. Keep credentials and JWTs in process memory; never paste or log them. Record only redacted IDs and a unique test marker.

1. On the VPS, run `npm run check`, `npm run readiness`, and `npm run status` from `sockets/node`; confirm the running process and database/session configuration without printing secrets.
2. Sign in both accounts through the mobile API and connect two Socket.IO clients to `https://chatpalez.com` with `auth.token`. Assert both connect, not just Engine.IO handshake.
3. Have both join the conversation and assert the room acknowledgements.
4. A sends a unique text marker. Assert the send acknowledgement has the expected conversation and last-message ID. B must receive `event_server_message_received` for that conversation without a manual refresh.
5. Query chat history as A and B and confirm the same message ID/text. Query the disposable conversation's message row count on the server, if read access is available, and confirm exactly one row for the marker.
6. Repeat B to A. Verify typing, seen, and reconnect/room rejoin.
7. Disconnect before submission: confirm one HTTP fallback send and one stored row. Interrupt after submission before acknowledgement: confirm no automatic HTTP duplicate, then reconcile through history.
8. Reject unauthenticated/revoked tokens and unauthorized conversation access. Confirm an existing browser chat remains functional.

Pass requires sender ack, recipient event, persisted history for both accounts, and a single stored row for each marker. If any differs, retain the exact failed stage and sanitized server/client logs. The public WebSocket 101 and source inspection alone are not a pass.

## Implementation sequence after design review

1. Establish runtime delivery evidence with the two-account gate and identify the exact APK commit/build. Stop on a failing transport/auth/persistence stage and fix that stage first.
2. Add one shell-owned chat route state and unified Back dispatcher. Remove the path that jumps from an active thread directly to an empty retained web destination.
3. Centralize footer visibility and native web-surface show/hide/frame updates in serialized transitions. Verify Home → ChatList → Thread → Back → ChatList, plus Thread → Profile/Notifications → Back.
4. Add contextual thread header and remove duplicate in-content title/back controls while preserving the existing styling and layout dimensions.
5. Verify on Android: rapid Back taps, hardware Back, photo/group/direct conversations, keyboard open/close, background/foreground, network loss, and app restart. Confirm one live message, one fallback message, reactions/delete, footer restoration, and no blank content.

No database migration or Redis purchase is part of this navigation design. Do not mark implementation complete from source tests alone; the installed APK and two-account runtime evidence are required.
