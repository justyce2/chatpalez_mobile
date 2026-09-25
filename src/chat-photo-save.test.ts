import { describe, expect, it, vi } from 'vitest';

const { save } = vi.hoisted(() => ({ save: vi.fn().mockResolvedValue({}) }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({ save })
}));

import { saveChatPhoto } from './chat-photo-save';

describe('chat photo save', () => {
  it('opens the native document saver for a trusted chat image', async () => {
    await saveChatPhoto('https://cloud.chatpalez.com/uploads/photos/2026/09/image.jpg');
    expect(save).toHaveBeenCalledWith({ url: 'https://cloud.chatpalez.com/uploads/photos/2026/09/image.jpg' });
  });

  it('does not send arbitrary network locations to the native downloader', async () => {
    await expect(saveChatPhoto('https://evil.example/uploads/photos/a.jpg')).rejects.toThrow('untrusted');
    await expect(saveChatPhoto('http://chatpalez.com/uploads/photos/a.jpg')).rejects.toThrow('untrusted');
    expect(save).toHaveBeenCalledTimes(1);
  });
});
