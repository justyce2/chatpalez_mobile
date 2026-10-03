export function getChatMediaUrl(origin: URL, source: string | undefined, allowedHosts: ReadonlySet<string> = new Set([origin.hostname.toLowerCase()]), uploadsBaseUrl: URL = new URL('uploads/', origin)): string | null {
  if (!source) return null;
  // Sngine chat uploads are returned by the API as paths relative to the site
  // upload tree, e.g. files/2026/10/example.txt. They live under
  // /content/uploads, not under the mobile app's optional CDN uploads root.
  if (/^(?:photos|videos|files|sounds)\/\d{4}\/\d{2}\/[A-Za-z0-9._/-]+$/i.test(source)) {
    return new URL('content/uploads/' + source, origin).toString();
  }
  try { const url = new URL(source, origin); const uploadsHost = url.origin === uploadsBaseUrl.origin && url.pathname.startsWith(uploadsBaseUrl.pathname); if (url.protocol !== 'https:' || (!allowedHosts.has(url.hostname.toLowerCase()) && !uploadsHost) || url.username || url.password) return null; if (!/^\/(?:uploads|content\/uploads)\/[A-Za-z0-9_./%-]+$/i.test(url.pathname) || url.pathname.split('/').includes('..')) return null; return url.toString(); } catch { return null; }
}

export function getChatPhotoUrl(
  origin: URL,
  source: string | undefined,
  allowedHosts: ReadonlySet<string> = new Set([origin.hostname.toLowerCase()]),
  uploadsBaseUrl: URL = new URL('uploads/', origin)
): string | null {
  if (!source) return null;
  if (/^photos\/\d{4}\/\d{2}\/[A-Za-z0-9._-]+\.(?:jpe?g|png|gif|webp|avif)$/i.test(source)) {
    return new URL(source, uploadsBaseUrl).toString();
  }

  try {
    const url = new URL(source, origin);
    const uploadsHost = url.origin === uploadsBaseUrl.origin && url.pathname.startsWith(uploadsBaseUrl.pathname);
    if (url.protocol !== 'https:' || (!allowedHosts.has(url.hostname.toLowerCase()) && !uploadsHost) || url.username || url.password) return null;
    if (!/^\/(?:uploads|content\/themes|content\/uploads)\/[A-Za-z0-9_./%-]+\.(?:jpe?g|png|gif|webp|avif)$/i.test(url.pathname)) return null;
    if (url.pathname.split('/').includes('..')) return null;
    return url.toString();
  } catch {
    return null;
  }
}
