import fs from 'node:fs';
import path from 'node:path';
import { projectEnvValue } from './project-env.mjs';

const packageName = 'chatpalez.app.webview';
const androidFingerprint = projectEnvValue('ANDROID_APP_LINK_SHA256', '').trim().toUpperCase();
const appleTeamId = projectEnvValue('APPLE_TEAM_ID', '').trim().toUpperCase();

if (!/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(androidFingerprint)) {
  throw new Error('ANDROID_APP_LINK_SHA256 must be the 32-byte SHA-256 signing certificate fingerprint in colon-separated hexadecimal form.');
}
if (!/^[A-Z0-9]{10}$/.test(appleTeamId)) {
  throw new Error('APPLE_TEAM_ID must be the 10-character Apple Developer Team ID.');
}

const output = path.join(process.cwd(), 'artifacts', 'well-known');
fs.mkdirSync(output, { recursive: true });

const assetLinks = [{
  relation: ['delegate_permission/common.handle_all_urls'],
  target: {
    namespace: 'android_app',
    package_name: packageName,
    sha256_cert_fingerprints: [androidFingerprint]
  }
}];

const appleAssociation = {
  applinks: {
    details: [{
      appIDs: [`${appleTeamId}.${packageName}`],
      components: [{ '/': '/*', comment: 'Open first-party ChatPalez HTTPS routes in the installed app.' }]
    }]
  }
};

fs.writeFileSync(path.join(output, 'assetlinks.json'), `${JSON.stringify(assetLinks, null, 2)}\n`);
fs.writeFileSync(path.join(output, 'apple-app-site-association'), `${JSON.stringify(appleAssociation, null, 2)}\n`);

console.log('Generated artifacts/well-known/assetlinks.json');
console.log('Generated artifacts/well-known/apple-app-site-association');
