# ChatPalez Deep-Link Domain Association

The mobile projects now declare:

- Android verified App Links for `https://chatpalez.com/...`;
- iOS Associated Domains for `applinks:chatpalez.com` and `applinks:www.chatpalez.com`;
- the existing custom `chatpalez://open` scheme on both platforms.

## External values still required

Verified HTTPS links cannot be completed safely from source alone because the domain files must include release-signing identities.

### Android

Publish:

`https://chatpalez.com/.well-known/assetlinks.json`

with:

- package name: `chatpalez.app.webview`;
- SHA-256 certificate fingerprint for the actual Google Play/App Signing certificate used by the installed release.

Do not use a guessed debug fingerprint for production.

### iOS

Publish:

`https://chatpalez.com/.well-known/apple-app-site-association`

with:

- Apple Team ID from the client Apple Developer account;
- bundle ID: `chatpalez.app.webview`.

The app-side entitlement is already configured. The server association file must be completed after the Apple Team ID is confirmed.

## Acceptance

After publishing the association files:

1. install a signed Android build and open a normal ChatPalez HTTPS URL from another app;
2. confirm Android opens ChatPalez directly without a browser chooser after domain verification;
3. install the signed iOS build and open a normal ChatPalez HTTPS URL;
4. confirm iOS opens the app through Universal Links;
5. verify untrusted external hosts still open outside ChatPalez.
