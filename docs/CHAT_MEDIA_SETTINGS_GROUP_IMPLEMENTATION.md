# Chat media, settings and group implementation — 2026-09-24

## Contracts found in the backend

- `get_conversation()` returns direct-chat `picture` from `get_picture()`, often an absolute first-party URL. Multi-recipient ad hoc chats return `picture_left` and `picture_right` and no editable name/photo. A Sngine Group chatbox has `node_type=group` and uses the separate social Group title and picture.
- `chat/message` accepts an uploaded `photo` source. Persisted rows and `chat/messages` expose that source as `image`, not `photo`. `data/upload` supplies the source.
- `mobile/account` exposes `privacy.user_chat_enabled` and `privacy.user_privacy_chat`, saved by `mobile/account/privacy`. `app/settings` exposes site-wide `chat_photos_enabled`, `chat_typing_enabled`, `chat_seen_enabled`, and `chat_socket_enabled`. These are site capabilities, not per-user switches. The web `notifications_sound` endpoint is a separate browser setting; this app uses its own per-device chat sound preference.
- Ad hoc multi-recipient chats are created by `chat/message` with JSON `recipients`. The Socket.IO send handler persists the same conversation message and broadcasts to online recipients. Source paths and unit tests are not a substitute for the two-account live gate.

## Changes

- First-party avatar URLs and uploaded message `image` values render in chat; initials appear when a source is absent, rejected, or fails to load.
- Installed apps use Capacitor Camera's native gallery selection, convert its returned `webPath` into an uploadable `File`, and show a removable preview above the composer. Browser builds retain file input selection. A photo send uses HTTP upload plus `chat/message`; plain text keeps the existing Socket.IO path.
- Chat settings include a device-only send/receive sound switch and server-backed chat availability/audience privacy. Site-wide photos, typing, seen, and realtime status are displayed as read-only capabilities.
- Named ad hoc group chats use `GET /chat/group/capabilities`, `GET /chat/group/metadata`, and `POST /chat/group/metadata`. The server checks active membership, distinguishes social Group chatboxes, validates name/photo, and stores metadata in `mobile_chat_group_metadata`. Active group threads refresh metadata every 30 seconds while visible. Social Group chatboxes retain their existing Group management route and are not renamed through this endpoint.

## Deployment order

1. Back up the production database. Apply `database/migrations/2026_09_24_mobile_chat_group_metadata.sql` from the backend repository using the site's database administration process. The table is additive; existing conversations remain intact.
2. Deploy the changed `apis/php/modules/chat/controller.php` and `router.php` from backend branch `sngine-fresh` to the actual VPS document root. The VPS directory reported an unborn `master`, so do not assume `git pull` there updates the running code. Run `php -l` on both deployed PHP files.
3. Verify `GET /apis/php/chat/group/capabilities` with an authenticated disposable session returns `customizable: true`, then create a disposable multi-person chat, save its title/photo, and read the same metadata as two members.
4. Pull the mobile `develop` branch on the build machine. Run `npm ci`, `npm run cap:sync`, and then `./gradlew assembleDebug` from `android` (on Windows: `.\gradlew assembleDebug`). Install the new APK; a raw Capacitor sync after a failed build can copy stale `dist` assets.
5. Test direct-avatar image loading, photo selection/preview/removal/send, sound off/on, privacy save, named group creation and edit, Back/footer navigation, and a two-account Socket.IO delivery gate. The checker supports `CHAT_EXPECT_GROUP=1`, optional `CHAT_EXPECT_GROUP_NAME`, and `CHAT_EXPECT_GROUP_PICTURE=1` with a disposable group conversation and two member JWTs supplied in process environment. Never paste tokens into a document or log.

## Runtime limits

No production JWTs, device emulator, or PHP interpreter were available in the implementation workspace. The TypeScript build and API contract tests verify code shape, but native gallery selection, production upload, group database persistence, and two-account Socket.IO delivery require the post-deployment checks above. Group metadata changes become visible in another already-open group thread on its next metadata refresh (up to 30 seconds); this route does not introduce a new Socket.IO metadata event.
