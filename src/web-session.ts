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

  if (options.target) {
    const frame = document.querySelector<HTMLIFrameElement>(`iframe[name="${cssEscape(options.target)}"]`);
    if (!frame) throw new Error('ChatPalez could not find the retained web surface.');

    frame.srcdoc = createSelfSubmittingDocument(transition);
    return;
  }

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = transition.action;
  form.style.display = 'none';
  form.autocomplete = 'off';
  form.append(hiddenInput('token', transition.token), hiddenInput('path', transition.path));
  document.body.append(form);
  form.submit();
  window.setTimeout(() => form.remove(), 0);
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


function createSelfSubmittingDocument(transition: WebSessionTransition): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body>
<form id="cp-session" method="post" action="${escapeHtml(transition.action)}">
<input type="hidden" name="token" value="${escapeHtml(transition.token)}">
<input type="hidden" name="path" value="${escapeHtml(transition.path)}">
</form>
<script>document.getElementById('cp-session').submit();<\/script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function cssEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
