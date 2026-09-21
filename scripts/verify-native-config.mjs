import { readFile } from 'node:fs/promises';

const checks = [
  ['capacitor config is bundled (no remote app root)', 'capacitor.config.ts', (s) => !/\bserver\s*:/.test(s)],
  ['published Android application ID is retained', 'capacitor.config.ts', (s) => s.includes("'chatpalez.app.webview'")],
  ['Android Gradle package matches the published application ID', 'android/app/build.gradle', (s) => s.includes('namespace = "chatpalez.app.webview"') && s.includes('applicationId "chatpalez.app.webview"')],
  ['mobile user agent is configured for the session bridge', 'capacitor.config.ts', (s) => s.includes('ChatPalezMobile/1.0')],
  ['mixed content is disabled', 'capacitor.config.ts', (s) => s.includes('allowMixedContent: false')],
  ['native splash cannot remain indefinitely on startup failure', 'capacitor.config.ts', (s) => s.includes('launchAutoHide: true')],
  ['production origin has a safe local-build fallback', 'src/config.ts', (s) => s.includes("'https://chatpalez.com'")],
  ['Android cleartext traffic is disabled', 'android/app/src/main/AndroidManifest.xml', (s) => s.includes('android:usesCleartextTraffic="false"')],
  ['Android deep link is declared', 'android/app/src/main/AndroidManifest.xml', (s) => s.includes('android:scheme="chatpalez"') && s.includes('android:host="open"')],
  ['Android camera permission is declared', 'android/app/src/main/AndroidManifest.xml', (s) => s.includes('android.permission.CAMERA')],
  ['Android microphone permission is declared', 'android/app/src/main/AndroidManifest.xml', (s) => s.includes('android.permission.RECORD_AUDIO')],
  ['iOS deep link is declared', 'ios/App/App/Info.plist', (s) => s.includes('<string>chatpalez</string>')],
  ['iOS camera explanation is declared', 'ios/App/App/Info.plist', (s) => s.includes('NSCameraUsageDescription')],
  ['iOS microphone explanation is declared', 'ios/App/App/Info.plist', (s) => s.includes('NSMicrophoneUsageDescription')],
  ['iOS photo-library explanation is declared', 'ios/App/App/Info.plist', (s) => s.includes('NSPhotoLibraryUsageDescription')],
  ['ChatPalez launcher icon is provisioned', 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', (s) => s.length > 0],
  ['ChatPalez iOS app icon is provisioned', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', (s) => s.length > 0],
  ['local welcome screen uses the ChatPalez icon asset', 'src/app-shell.ts', (s) => s.includes("/brand/chatpalez-app-icon.png")],
  ['mobile client contains no Sngine server API secret', 'src', (s) => !s.includes('system_api_secret')],
  ['JWT session persistence has no browser-storage fallback', 'src/auth/session.ts', (s) => !/\b(?:sessionStorage|localStorage)\s*[.\[]/.test(s)],
  ['retained-web bridge posts without a JWT query string', 'src/web-session.ts', (s) => s.includes("form.method = 'POST'") && !/mobile-session\.php\?.*token/.test(s)]
];

const files = new Map();
for (const [, path] of checks) {
  if (!files.has(path)) {
    if (path === 'src') {
      const { readdir } = await import('node:fs/promises');
      const collect = async (directory) => {
        const entries = await readdir(directory, { withFileTypes: true });
        const contents = await Promise.all(entries.map(async (entry) => entry.isDirectory()
          ? collect(`${directory}/${entry.name}`)
          : readFile(`${directory}/${entry.name}`, 'utf8')));
        return contents.flat().join('\n');
      };
      files.set(path, await collect(path));
    } else {
      files.set(path, await readFile(path, 'utf8'));
    }
  }
}

const failures = checks
  .filter(([, path, predicate]) => !predicate(files.get(path)))
  .map(([description, path]) => `- ${description} (${path})`);

if (failures.length) {
  console.error('Native configuration verification failed:\n' + failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Native configuration verified: ${checks.length} checks passed.`);
}
