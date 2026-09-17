import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

// This must remain the package already published in Google Play so the hybrid
// Capacitor release is accepted as an update to the existing ChatPalez listing.
const appId = process.env.CAP_APP_ID ?? 'chatpalez.app.webview';
const appName = process.env.CAP_APP_NAME ?? 'ChatPalez';

const config: CapacitorConfig = {
  appId,
  appName,
  webDir: 'dist',
  appendUserAgent: ' ChatPalezMobile/1.0',
  loggingBehavior: 'debug',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0066B2',
    initialFocus: true
  },
  ios: {
    backgroundColor: '#0066B2',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    allowsLinkPreview: false,
    handleApplicationNotifications: false
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      showSpinner: false,
      backgroundColor: '#0066B2'
    },
    StatusBar: {
      overlaysWebView: false
    },
    Keyboard: {
      resize: KeyboardResize.Native,
      resizeOnFullScreen: true,
      autoBackdropColor: 'auto'
    }
  }
};

export default config;
