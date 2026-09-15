import type { CapacitorConfig } from '@capacitor/cli';

const appId = process.env.CAP_APP_ID ?? 'com.chatpalez.mobile';
const appName = process.env.CAP_APP_NAME ?? 'ChatPalez';

const config: CapacitorConfig = {
  appId,
  appName,
  webDir: 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
    backgroundColor: '#ffffff'
  },
  ios: {
    backgroundColor: '#ffffff',
    contentInset: 'automatic'
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
