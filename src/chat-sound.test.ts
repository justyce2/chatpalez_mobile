import { afterEach, describe, expect, it, vi } from 'vitest';
import { isChatSoundEnabled, setChatSoundEnabled } from './chat-sound';

afterEach(() => vi.unstubAllGlobals());

describe('chat sound setting', () => {
  it('honors the off setting immediately even when WebView storage is unavailable', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => { throw new Error('Storage blocked'); },
        setItem: () => { throw new Error('Storage blocked'); }
      }
    });
    setChatSoundEnabled('storage-blocked-user', false);
    expect(isChatSoundEnabled('storage-blocked-user')).toBe(false);
  });
});
