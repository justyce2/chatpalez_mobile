# Chat media, settings and community group integration — 2026-09-24

## Engine contracts and app behavior

- The mobile app uses the engine's `chat/conversations`, `chat/messages`, `chat/message`, `chat/reactions/react`, `chat/actions/typing`, `chat/actions/seen`, and `data/upload` endpoints. Plain text may use the engine's Socket.IO message event when connected; uploads use the existing HTTP API.
- Direct conversations expose a `picture` from the correspondent. A community Group chatbox (`node_type=group`) exposes the Group record's title and picture through the same conversation APIs and Socket.IO. An ad hoc multi-recipient conversation is a different engine object with a generated participant name and `picture_left`/`picture_right`.
- New chat in this app starts a direct conversation. The Groups control opens the retained engine `/groups` module for community Group creation and membership. Its enabled chatbox appears in the mobile conversation list and sends messages through the standard engine chat contract. The thread's More menu can open its community Group page.
- Photo messages use the native Capacitor gallery picker on installed devices, display a removable local preview, and upload a `File` through `data/upload` before sending the source through `chat/message`. Message history exposes that photo as `image`.
- Chat settings expose existing `mobile/account` chat privacy fields and show `app/settings` chat capabilities. The sound switch is an app-local, per-device preference; it does not change the web notification sound preference.

## Upgrade boundary

No group metadata PHP endpoint or custom table is required for this mobile flow. The earlier `mobile_chat_group_metadata` migration may already have been applied on the VPS; it is additive and can remain unused. Backend commit `7f905ce3` reverts the custom `chat/group/metadata` endpoints and restores the engine chat controller/router in Git. If the prior files were copied into the VPS document root, restore the pre-extension backups or install the reverted files. Do not drop the table without separately checking for data.

## Verification

Run `npm run build`, `npm test`, `npm run verify:native`, then `npx cap sync android` and build a new APK on the build machine. Confirm direct avatar images, native photo selection/preview/send, sound and privacy settings, shell Back/footer navigation, and an existing community Group chatbox's title/photo/message send. The two-account `scripts/verify-chat-delivery.mjs` checker can use `CHAT_EXPECT_GROUP=1`, optional `CHAT_EXPECT_GROUP_NAME`, and `CHAT_EXPECT_GROUP_PICTURE=1` for a disposable engine community Group chatbox. It requires two member JWTs supplied as process environment variables. Do not paste tokens into reports or logs.

Source checks and unit tests are not a live delivery proof. Native gallery selection, production upload and two-account Socket.IO delivery require device and server testing.
