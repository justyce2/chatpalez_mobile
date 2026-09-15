import fs from 'node:fs';
import path from 'node:path';

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
    androidApplicationId: match(androidGradle, /applicationId\s+"([^"]+)"/, 'Android applicationId'),
    iosBundleId: match(iosProject, /PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/, 'iOS bundle identifier'),
    productionOrigin: match(capacitorConfig, /process\.env\.CAP_SERVER_URL \?\? '([^']+)'/, 'production origin')
  },
  android: {
    versionCode: Number(match(androidGradle, /versionCode\s+(\d+)/, 'Android versionCode')),
    versionName: match(androidGradle, /versionName\s+"([^"]+)"/, 'Android versionName'),
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

if (metadata.identity.androidApplicationId !== 'com.chatpalez') {
  throw new Error(`Unexpected Android application ID: ${metadata.identity.androidApplicationId}`);
}

if (metadata.identity.iosBundleId !== 'com.chatpalez') {
  throw new Error(`Unexpected iOS bundle ID: ${metadata.identity.iosBundleId}`);
}

if (metadata.identity.productionOrigin !== 'https://chatpalez.com') {
  throw new Error(`Unexpected production origin: ${metadata.identity.productionOrigin}`);
}

if (metadata.android.versionName !== metadata.ios.marketingVersion) {
  throw new Error(
    `Android/iOS marketing versions differ (${metadata.android.versionName} vs ${metadata.ios.marketingVersion})`
  );
}

if (!Number.isInteger(metadata.android.versionCode) || metadata.android.versionCode < 1) {
  throw new Error('Android versionCode must be a positive integer');
}

if (!Number.isInteger(metadata.ios.buildNumber) || metadata.ios.buildNumber < 1) {
  throw new Error('iOS build number must be a positive integer');
}

const outputDir = path.join(root, 'artifacts');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'build-metadata.json');
fs.writeFileSync(outputPath, `${JSON.stringify(metadata, null, 2)}\n`);

console.log(`Wrote ${path.relative(root, outputPath)}`);
console.log(JSON.stringify(metadata, null, 2));
