import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { getAppConfig } from './config';
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
  } catch {
    // Status bar support varies by platform/version; startup must continue.
  }
}

async function openChatPalez(): Promise<void> {
  setState('Opening ChatPalez', 'Checking your connection…');

  try {
    const config = getAppConfig();
    const network = await Network.getStatus();

    if (!network.connected) {
      setState('You are offline', 'Connect to the internet, then try again.', true);
      return;
    }

    setState('Opening ChatPalez', 'Connecting securely…');
    window.location.replace(config.origin.toString());
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'The app could not start.';
    setState('Unable to start', detail, true);
  } finally {
    if (Capacitor.isNativePlatform()) {
      await SplashScreen.hide().catch(() => undefined);
    }
  }
}

retryButton?.addEventListener('click', () => {
  void openChatPalez();
});

void Network.addListener('networkStatusChange', (status) => {
  if (status.connected && retryButton && !retryButton.hidden) {
    void openChatPalez();
  }
});

void prepareNativeChrome().then(openChatPalez);
