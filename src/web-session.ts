import type { AppConfig } from './config';

export type WebSessionTransitionOptions = {
  config: AppConfig;
  token: string;
  path: string;
  target?: string;
};

/**
 * Moves the Capacitor WebView into a retained ChatPalez web module without ever
 * placing the mobile JWT in a URL. The backend validates the JWT, establishes
 * Sngine's normal web cookies, then performs a 303 redirect to the internal path.
 */
export function openAuthenticatedWebModule(options: WebSessionTransitionOptions): void {
  const transition = createWebSessionTransition(options);
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = transition.action;
  form.style.display = 'none';
  form.autocomplete = 'off';
  if (options.target) form.target = options.target;

  form.append(hiddenInput('token', transition.token), hiddenInput('path', transition.path));
  document.body.append(form);
  form.submit();
}

export type WebSessionTransition = {
  action: string;
  path: string;
  token: string;
};

/**
 * Produces the form-only bridge contract without exposing the JWT or destination
 * in the action URL. Kept separate so the no-token-in-URL guarantee is tested.
 */
export function createWebSessionTransition(options: WebSessionTransitionOptions): WebSessionTransition {
  const token = options.token.trim();
  if (!token) throw new Error('Your ChatPalez session is unavailable. Please sign in again.');

  const path = normalizeInternalPath(options.config.origin.toString(), options.path);
  const action = new URL('/mobile-session.php', options.config.origin);
  return { action: action.toString(), path, token };
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
