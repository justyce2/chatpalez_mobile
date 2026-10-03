import { describe, expect, it } from 'vitest';
import { chatProfilePath } from './chat-profile-route';

describe('chat profile navigation', () => {
  it('uses the engine username route', () => {
    expect(chatProfilePath(' justice.c ')).toBe('/justice.c');
  });

  it('does not accept missing usernames or paths', () => {
    for (const value of [undefined, '', '..', 'pages/admin', 'user?view=settings', 'a#b']) {
      expect(chatProfilePath(value)).toBeNull();
    }
  });
});
