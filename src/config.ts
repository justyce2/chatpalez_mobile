const rawOrigin = import.meta.env.VITE_CHATPALEZ_ORIGIN?.trim();
const rawOneSignalAppId = import.meta.env.VITE_ONESIGNAL_APP_ID?.trim();
const rawChatSocketUrl = import.meta.env.VITE_CHAT_SOCKET_URL?.trim();
const rawUploadsBaseUrl = import.meta.env.VITE_CHAT_UPLOADS_BASE_URL?.trim();
const allowedHosts = (import.meta.env.VITE_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host: string) => host.trim().toLowerCase())
  .filter(Boolean);

export type AppConfig = {
  origin: URL;
  allowedHosts: ReadonlySet<string>;
  oneSignalAppId?: string;
  chatSocketUrl: URL;
  uploadsBaseUrl?: URL;
};

export function getAppConfig(): AppConfig {
  if (!rawOrigin) {
    throw new Error('VITE_CHATPALEZ_ORIGIN is not configured.');
  }

  const origin = new URL(rawOrigin);
  if (origin.protocol !== 'https:' && origin.hostname !== 'localhost') {
    throw new Error('ChatPalez origin must use HTTPS outside localhost.');
  }

  const hosts = new Set<string>(allowedHosts);
  hosts.add(origin.hostname.toLowerCase());

  const chatSocketUrl = rawChatSocketUrl ? new URL(rawChatSocketUrl) : new URL(origin.origin);
  if (chatSocketUrl.protocol !== 'https:' && chatSocketUrl.hostname !== 'localhost') {
    throw new Error('Chat socket URL must use HTTPS outside localhost.');
  }

  const uploadsBaseUrl = rawUploadsBaseUrl
    ? new URL(rawUploadsBaseUrl)
    : origin.hostname === 'chatpalez.com'
      ? new URL('https://cloud.chatpalez.com/uploads/')
      : new URL('uploads/', origin);
  if (uploadsBaseUrl.protocol !== 'https:' && uploadsBaseUrl.hostname !== 'localhost') {
    throw new Error('Chat uploads URL must use HTTPS outside localhost.');
  }
  if (!uploadsBaseUrl.pathname.endsWith('/uploads/')) {
    throw new Error('Chat uploads URL must end with /uploads/.');
  }
  if (uploadsBaseUrl.username || uploadsBaseUrl.password || uploadsBaseUrl.search || uploadsBaseUrl.hash) {
    throw new Error('Chat uploads URL must be a plain uploads path.');
  }

  return {
    origin,
    allowedHosts: hosts,
    oneSignalAppId: rawOneSignalAppId || undefined,
    chatSocketUrl,
    uploadsBaseUrl
  };
}

export function isTrustedUrl(url: URL, config: AppConfig): boolean {
  return url.protocol === 'https:' && config.allowedHosts.has(url.hostname.toLowerCase());
}
