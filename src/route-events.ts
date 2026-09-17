export type ChatPalezRouteDetail = {
  url: string;
};

export function emitRouteRequested(url: string): void {
  window.dispatchEvent(
    new CustomEvent<ChatPalezRouteDetail>('chatpalez:route-requested', {
      detail: { url }
    })
  );
}
