import { describe, expect, it } from 'vitest';
import { appendRetainedHistory, normalizeRetainedPath, resolveShellRoute, retainedBack } from './shell-navigation';

const origin = 'https://chatpalez.com';

describe('shell route policy', () => {
  it('routes core app-owned surfaces natively', () => {
    expect(resolveShellRoute('/messages?thread=7', origin)).toEqual({ kind: 'messages' });
    expect(resolveShellRoute('/people/friend_requests', origin)).toEqual({ kind: 'people', view: 'requests' });
    expect(resolveShellRoute('/posts/42', origin)).toEqual({ kind: 'post', id: '42' });
    expect(resolveShellRoute('/events/19', origin)).toEqual({ kind: 'event', id: '19' });
  });

  it('keeps unsupported same-origin content in controlled fallback', () => {
    expect(resolveShellRoute('/blogs/new?draft=1#editor', origin))
      .toEqual({ kind: 'fallback', path: '/blogs/new?draft=1#editor' });
  });

  it('rejects external and malformed destinations', () => {
    expect(resolveShellRoute('https://evil.example/phish', origin)).toEqual({ kind: 'invalid' });
    expect(normalizeRetainedPath('//evil.example/phish', origin)).toBeNull();
  });
});

describe('retained navigation history', () => {
  it('deduplicates consecutive locations and caps retained history', () => {
    let history: string[] = [];
    history = appendRetainedHistory(history, '/one', 3);
    history = appendRetainedHistory(history, '/one', 3);
    history = appendRetainedHistory(history, '/two', 3);
    history = appendRetainedHistory(history, '/three', 3);
    history = appendRetainedHistory(history, '/four', 3);
    expect(history).toEqual(['/two', '/three', '/four']);
  });

  it('walks backward without mutating the input history', () => {
    const history = ['/one', '/two', '/three'];
    expect(retainedBack(history)).toEqual({ history: ['/one', '/two'], previous: '/two' });
    expect(history).toEqual(['/one', '/two', '/three']);
    expect(retainedBack(['/one'])).toEqual({ history: [], previous: null });
  });
});
