import type { CapacitorConfig } from '@capacitor/cli';

const appId = process.env.CAP_APP_ID ?? 'com.chatpalez';
const appName = process.env.CAP_APP_NAME ?? 'ChatPalez';
const serverUrl = process.env.CAP_SERVER_URL ?? 'https://chatpalez.com';

const config: CapacitorConfig = {
  appId,
  appName,
  webDir: 'dist',
  appendUserAgent: ' ChatPalezMobile/1.0',
  loggingBehavior: 'debug',
  // ChatPalez is a server-rendered PHP/Smarty application rather than a bundled SPA.
  // A single verified HTTPS origin is configured so Capacitor can inject and retain
  // its native bridge for the remote application. We deliberately do not use
  // allowNavigation; non-origin navigation should leave the app container.
  server: {
    url: serverUrl,
    cleartext: false,
    errorPath: 'error.html'
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#ffffff',
    initialFocus: true
  },
  ios: {
    backgroundColor: '#ffffff',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    allowsLinkPreview: false,
    handleApplicationNotifications: false
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      showSpinner: false,
      backgroundColor: '#FFFFFFFF'
    },
    StatusBar: {
      overlaysWebView: false
    }
  }
};

export default config;
