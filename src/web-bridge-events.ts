import type { ChatPalezMobileBridge, SharePayload } from './bridge';

type ShareEvent = CustomEvent<SharePayload>;
type ExternalEvent = CustomEvent<{ url: string }>;

export function bindWebBridgeEvents(bridge: ChatPalezMobileBridge): void {
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
}
