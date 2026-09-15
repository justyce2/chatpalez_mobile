import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const appId = process.env.CAP_APP_ID ?? 'com.chatpalez';
const appName = process.env.CAP_APP_NAME ?? 'ChatPalez';

const config: CapacitorConfig = {
  appId,
  appName,
  webDir: 'dist',
  appendUserAgent: ' ChatPalezMobile/1.0',
  loggingBehavior: 'debug',
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
    },
    Keyboard: {
      resize: KeyboardResize.Native,
      resizeOnFullScreen: true,
      autoBackdropColor: 'auto'
    }
  }
};

export default config;
