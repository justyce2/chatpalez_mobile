// Production has a safe built-in origin so a local build cannot crash before
// the recovery UI simply because .env was not copied. .env can still override
// this for controlled development environments.
const rawOrigin = import.meta.env.VITE_CHATPALEZ_ORIGIN?.trim() || 'https://chatpalez.com';
const rawOneSignalAppId = import.meta.env.VITE_ONESIGNAL_APP_ID?.trim();
const allowedHosts = (import.meta.env.VITE_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host: string) => host.trim().toLowerCase())
  .filter(Boolean);

export type AppConfig = {
  origin: URL;
  allowedHosts: ReadonlySet<string>;
  oneSignalAppId?: string;
};

export function getAppConfig(): AppConfig {
  const origin = new URL(rawOrigin);
  if (origin.protocol !== 'https:' && origin.hostname !== 'localhost') {
    throw new Error('ChatPalez origin must use HTTPS outside localhost.');
  }

  const hosts = new Set<string>(allowedHosts);
  hosts.add(origin.hostname.toLowerCase());

  return {
    origin,
    allowedHosts: hosts,
    oneSignalAppId: rawOneSignalAppId || undefined
  };
}

export function isTrustedUrl(url: URL, config: AppConfig): boolean {
  return url.protocol === 'https:' && config.allowedHosts.has(url.hostname.toLowerCase());
}
