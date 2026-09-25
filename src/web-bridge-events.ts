import type { AppConfig } from './config';
import type { ChatPalezMobileBridge, MediaPickerPayload, SharePayload } from './bridge';

type ShareEvent = CustomEvent<SharePayload>;
type ExternalEvent = CustomEvent<{ url: string }>;

type RetainedMessage = {
  source?: string;
  type?: string;
  requestId?: string;
  payload?: unknown;
};

export function bindWebBridgeEvents(bridge: ChatPalezMobileBridge, config: AppConfig): void {
  window.addEventListener('chatpalez:share', (event) => {
    const payload = (event as ShareEvent).detail;
    if (!payload) return;
    void bridge.share(payload);
  });

  window.addEventListener('chatpalez:open-external', (event) => {
    const url = (event as ExternalEvent).detail?.url;
    if (!url) return;
    void bridge.openExternal(url);
  });

  window.addEventListener('message', (event) => {
    if (event.origin !== config.origin.origin) return;
    if (!event.data || typeof event.data !== 'object') return;

    const message = event.data as RetainedMessage;
    if (message.source !== 'chatpalez-retained') return;

    if (message.type === 'share') {
      void bridge.share((message.payload ?? {}) as SharePayload);
      return;
    }

    if (message.type === 'pick-media' && message.requestId) {
      const payload = (message.payload ?? {}) as MediaPickerPayload;
      void bridge.pickMedia(payload).then((items) => {
        const target = event.source as Window | null;
        target?.postMessage({
          source: 'chatpalez-shell',
          type: 'media-result',
          requestId: message.requestId,
          items
        }, event.origin);
      });
    }
  });
}
