import { readFile } from 'node:fs/promises';

const checks = [
  ['capacitor config is bundled (no remote app root)', 'capacitor.config.ts', (s) => !/\bserver\s*:/.test(s)],
  ['mobile user agent is configured for the session bridge', 'capacitor.config.ts', (s) => s.includes('ChatPalezMobile/1.0')],
  ['mixed content is disabled', 'capacitor.config.ts', (s) => s.includes('allowMixedContent: false')],
  ['Android cleartext traffic is disabled', 'android/app/src/main/AndroidManifest.xml', (s) => s.includes('android:usesCleartextTraffic="false"')],
  ['Android deep link is declared', 'android/app/src/main/AndroidManifest.xml', (s) => s.includes('android:scheme="chatpalez"') && s.includes('android:host="open"')],
  ['Android camera permission is declared', 'android/app/src/main/AndroidManifest.xml', (s) => s.includes('android.permission.CAMERA')],
  ['Android microphone permission is declared', 'android/app/src/main/AndroidManifest.xml', (s) => s.includes('android.permission.RECORD_AUDIO')],
  ['iOS deep link is declared', 'ios/App/App/Info.plist', (s) => s.includes('<string>chatpalez</string>')],
  ['iOS camera explanation is declared', 'ios/App/App/Info.plist', (s) => s.includes('NSCameraUsageDescription')],
  ['iOS microphone explanation is declared', 'ios/App/App/Info.plist', (s) => s.includes('NSMicrophoneUsageDescription')],
  ['iOS photo-library explanation is declared', 'ios/App/App/Info.plist', (s) => s.includes('NSPhotoLibraryUsageDescription')]
];

const files = new Map();
for (const [, path] of checks) {
  if (!files.has(path)) files.set(path, await readFile(path, 'utf8'));
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
