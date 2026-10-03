export function normalizeNotificationRoute(origin: URL, receivedUrl: string | undefined): string | null {
  if (!receivedUrl) return null;

  try {
    const target = new URL(receivedUrl, origin);
    if (target.origin !== origin.origin) return null;
    return `${target.pathname}${target.search}${target.hash}` || '/';
  } catch {
    return null;
  }
}
