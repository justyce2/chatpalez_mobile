import type { AppConfig } from './config';

export type WebSessionTransitionOptions = {
  config: AppConfig;
  token: string;
  path: string;
};

/**
 * Moves the Capacitor WebView into a retained ChatPalez web module without ever
 * placing the mobile JWT in a URL. The backend validates the JWT, establishes
 * Sngine's normal web cookies, then performs a 303 redirect to the internal path.
 */
export function openAuthenticatedWebModule(options: WebSessionTransitionOptions): void {
  const token = options.token.trim();
  if (!token) throw new Error('Your ChatPalez session is unavailable. Please sign in again.');

  const destination = normalizeInternalPath(options.config.origin, options.path);
  const action = new URL('/mobile-session.php', options.config.origin);
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action.toString();
  form.style.display = 'none';
  form.autocomplete = 'off';

  form.append(hiddenInput('token', token), hiddenInput('path', destination));
  document.body.append(form);
  form.submit();
}

export function normalizeInternalPath(origin: string, requestedPath: string): string {
  const trustedOrigin = new URL(origin);
  const destination = new URL(requestedPath || '/', trustedOrigin);
  if (destination.origin !== trustedOrigin.origin) {
    throw new Error('ChatPalez blocked an untrusted web-module destination.');
  }
  return `${destination.pathname}${destination.search}${destination.hash}` || '/';
}

function hiddenInput(name: string, value: string): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'hidden';
  input.name = name;
  input.value = value;
  return input;
}
