export type ShellRoute =
  | { kind: 'feed'; view: 'newsfeed' }
  | { kind: 'reels' }
  | { kind: 'watch' }
  | { kind: 'search' }
  | { kind: 'people'; view: 'discover' | 'requests' }
  | { kind: 'pages' }
  | { kind: 'groups' }
  | { kind: 'events' }
  | { kind: 'notifications' }
  | { kind: 'messages' }
  | { kind: 'settings' }
  | { kind: 'post'; id: string }
  | { kind: 'event'; id: string }
  | { kind: 'fallback'; path: string }
  | { kind: 'invalid' };

export function normalizeRetainedPath(rawPath: string, trustedOrigin?: string): string | null {
  if (!trustedOrigin) return null;
  try {
    const trusted = new URL(trustedOrigin);
    const destination = new URL(rawPath || '/', trusted);
    if (destination.origin !== trusted.origin) return null;
    return `${destination.pathname}${destination.search}${destination.hash}` || '/';
  } catch {
    return null;
  }
}

export function resolveShellRoute(rawPath: string, trustedOrigin?: string): ShellRoute {
  const normalized = normalizeRetainedPath(rawPath || '/', trustedOrigin);
  if (!normalized) return { kind: 'invalid' };

  const url = new URL(normalized, trustedOrigin);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (path === '/' || path === '/index') return { kind: 'feed', view: 'newsfeed' };
  if (path === '/reels') return { kind: 'reels' };
  if (path === '/watch') return { kind: 'watch' };
  if (path === '/search') return { kind: 'search' };
  if (path === '/people') return { kind: 'people', view: 'discover' };
  if (path === '/people/friend_requests') return { kind: 'people', view: 'requests' };
  if (path === '/pages') return { kind: 'pages' };
  if (path === '/groups') return { kind: 'groups' };
  if (path === '/events') return { kind: 'events' };
  if (path === '/notifications') return { kind: 'notifications' };
  if (path === '/messages' || path === '/chat') return { kind: 'messages' };
  if (path === '/settings') return { kind: 'settings' };

  const postMatch = path.match(/^\/posts\/(\d+)$/);
  if (postMatch) return { kind: 'post', id: postMatch[1] };

  const eventMatch = path.match(/^\/events\/(\d+)$/);
  if (eventMatch) return { kind: 'event', id: eventMatch[1] };

  return { kind: 'fallback', path: normalized };
}

export function appendRetainedHistory(history: string[], path: string, maxEntries = 40): string[] {
  const next = history.slice();
  if (next[next.length - 1] !== path) next.push(path);
  if (next.length > maxEntries) next.splice(0, next.length - maxEntries);
  return next;
}

export function retainedBack(history: string[]): { history: string[]; previous: string | null } {
  if (history.length <= 1) return { history: [], previous: null };
  const next = history.slice(0, -1);
  return { history: next, previous: next[next.length - 1] ?? null };
}
