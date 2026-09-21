import fs from 'node:fs';
import path from 'node:path';
import { projectEnvValue } from './project-env.mjs';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function match(content, regex, label) {
  const result = content.match(regex);
  if (!result) throw new Error(`Unable to resolve ${label}`);
  return result[1];
}

const packageJson = JSON.parse(read('package.json'));
const androidGradle = read('android/app/build.gradle');
const androidVariables = read('android/variables.gradle');
const iosProject = read('ios/App/App.xcodeproj/project.pbxproj');
const capacitorConfig = read('capacitor.config.ts');
const appConfig = read('src/config.ts');

const androidVersionCode = Number(projectEnvValue('CHATPALEZ_VERSION_CODE', '1', root));
const androidVersionName = projectEnvValue('CHATPALEZ_VERSION_NAME', '1.0', root);
const androidApplicationId = match(androidGradle, /applicationId\s+"([^"]+)"/, 'Android applicationId');
const iosBundleId = match(iosProject, /PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/, 'iOS bundle identifier');
const productionOrigin = match(
  appConfig,
  /const\s+rawOrigin\s*=.*?(?:\|\||\?\?)\s*['"]([^'"]+)['"]/s,
  'production origin fallback'
);
const capacitorAppId = match(capacitorConfig, /process\.env\.CAP_APP_ID\s*\?\?\s*'([^']+)'/, 'Capacitor app ID');

const metadata = {
  generatedAt: new Date().toISOString(),
  git: {
    sha: process.env.GITHUB_SHA || process.env.GIT_COMMIT || 'local',
    ref: process.env.GITHUB_REF_NAME || process.env.GIT_BRANCH || 'local'
  },
  package: {
    name: packageJson.name,
    version: packageJson.version
  },
  identity: {
    capacitorAppId,
    androidApplicationId,
    iosBundleId,
    productionOrigin
  },
  android: {
    versionCode: androidVersionCode,
    versionName: androidVersionName,
    minSdk: Number(match(androidVariables, /minSdkVersion\s*=\s*(\d+)/, 'Android minSdkVersion')),
    targetSdk: Number(match(androidVariables, /targetSdkVersion\s*=\s*(\d+)/, 'Android targetSdkVersion')),
    compileSdk: Number(match(androidVariables, /compileSdkVersion\s*=\s*(\d+)/, 'Android compileSdkVersion'))
  },
  ios: {
    marketingVersion: match(iosProject, /MARKETING_VERSION = ([^;]+);/, 'iOS marketing version'),
    buildNumber: Number(match(iosProject, /CURRENT_PROJECT_VERSION = (\d+);/, 'iOS build number')),
    minimumVersion: match(iosProject, /IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);/, 'iOS deployment target')
  }
};

const expectedAppId = 'chatpalez.app.webview';
if (metadata.identity.capacitorAppId !== expectedAppId) {
  throw new Error(`Unexpected Capacitor app ID: ${metadata.identity.capacitorAppId}`);
}
if (metadata.identity.androidApplicationId !== expectedAppId) {
  throw new Error(`Unexpected Android application ID: ${metadata.identity.androidApplicationId}`);
}
if (metadata.identity.iosBundleId !== expectedAppId) {
  throw new Error(`Unexpected iOS bundle ID: ${metadata.identity.iosBundleId}`);
}
if (metadata.identity.productionOrigin !== 'https://chatpalez.com') {
  throw new Error(`Unexpected production origin: ${metadata.identity.productionOrigin}`);
}
if (metadata.android.versionName !== metadata.ios.marketingVersion) {
  console.warn(
    `Marketing-version note: Android/iOS differ (${metadata.android.versionName} vs ${metadata.ios.marketingVersion}). Align them before store release.`
  );
}
if (!Number.isInteger(metadata.android.versionCode) || metadata.android.versionCode < 1) {
  throw new Error('Android versionCode must be a positive integer');
}
if (!Number.isInteger(metadata.ios.buildNumber) || metadata.ios.buildNumber < 1) {
  throw new Error('iOS build number must be a positive integer');
}
if (metadata.android.versionCode === 1) {
  console.warn('Android versionCode 1 is a development placeholder. Do not use it for a Play Store update unless Play confirms it is greater than the current maximum.');
}

const outputDir = path.join(root, 'artifacts');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'build-metadata.json');
fs.writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);

console.log(`Wrote ${path.relative(root, outputPath)}`);
console.log(JSON.stringify(metadata, null, 2));
