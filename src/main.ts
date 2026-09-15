import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { installMobileBridge } from './bridge';
import { getAppConfig } from './config';
import { logDebug, logError, logInfo, logWarn } from './diagnostics';
import { registerNativeLifecycle } from './native-lifecycle';
import { bindWebBridgeEvents } from './web-bridge-events';
import './styles.css';

const title = document.querySelector<HTMLHeadingElement>('#state-title');
const message = document.querySelector<HTMLParagraphElement>('#state-message');
const retryButton = document.querySelector<HTMLButtonElement>('#retry-button');

function setState(stateTitle: string, stateMessage: string, canRetry = false): void {
  if (title) title.textContent = stateTitle;
  if (message) message.textContent = stateMessage;
  if (retryButton) retryButton.hidden = !canRetry;
}

async function prepareNativeChrome(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await StatusBar.setStyle({ style: Style.Light });
  } catch (error) {
    logDebug('Status bar style was not applied', {
      platform: Capacitor.getPlatform(),
      detail: error instanceof Error ? error.message : String(error ?? '')
    });
  }
}

async function bootstrap(): Promise<void> {
  setState('Opening ChatPalez', 'Checking your connection…');
  logInfo('Bootstrap started', { platform: Capacitor.getPlatform() });

  try {
    const config = getAppConfig();
    const bridge = installMobileBridge(config);
    bindWebBridgeEvents(bridge);

    logDebug('Runtime configuration loaded', {
      origin: config.origin.toString(),
      allowedHostCount: config.allowedHosts.size
    });

    await registerNativeLifecycle(config, (route) => {
      const destination = new URL(route, config.origin);
      logInfo('Opening trusted native route', { url: destination.toString() });
      window.location.assign(destination.toString());
    });

    const network = await Network.getStatus();
    if (!network.connected) {
      logWarn('Bootstrap paused because device is offline', {
        connectionType: network.connectionType
      });
      setState('You are offline', 'Connect to the internet, then try again.', true);
      return;
    }

    logInfo('Opening production origin', {
      origin: config.origin.toString(),
      connectionType: network.connectionType
    });
    setState('Opening ChatPalez', 'Connecting securely…');
    window.location.replace(config.origin.toString());
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'The app could not start.';
    logError('Bootstrap failed', error, { platform: Capacitor.getPlatform() });
    setState('Unable to start', detail, true);
  } finally {
    if (Capacitor.isNativePlatform()) {
      await SplashScreen.hide().catch((error) => {
        logDebug('Splash screen hide was unavailable', {
          detail: error instanceof Error ? error.message : String(error ?? '')
        });
      });
    }
  }
}

retryButton?.addEventListener('click', () => {
  logInfo('User requested bootstrap retry');
  void bootstrap();
});

void Network.addListener('networkStatusChange', (status) => {
  logInfo('Network state changed', {
    connected: status.connected,
    connectionType: status.connectionType
  });

  if (status.connected && retryButton && !retryButton.hidden) {
    void bootstrap();
  }
});

window.addEventListener('error', (event) => {
  logError('Unhandled window error', event.error ?? event.message, {
    source: event.filename || null,
    line: event.lineno || null,
    column: event.colno || null
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logError('Unhandled promise rejection', event.reason);
});

void prepareNativeChrome().then(bootstrap).catch((error) => {
  logError('Native bootstrap pipeline failed', error, { platform: Capacitor.getPlatform() });
});
