import { describe, expect, it, vi } from 'vitest';
import { UploadService } from './uploads';
import type { ChatPalezApiClient } from './client';

describe('UploadService', () => {
  it('rejects non-image attachments before they reach the API', async () => {
    const postForm = vi.fn();
    const api = { postForm } as unknown as ChatPalezApiClient;
    const uploads = new UploadService(api);

    await expect(uploads.uploadChatPhoto(new File(['text'], 'note.txt', { type: 'text/plain' })))
      .rejects.toThrow('Choose an image file to attach.');
    expect(postForm).not.toHaveBeenCalled();
  });

  it('uses the official one-part chat-photo upload contract', async () => {
    const postForm = vi.fn().mockResolvedValue('photos/2026/09/photo.jpg');
    const api = { postForm } as unknown as ChatPalezApiClient;
    const uploads = new UploadService(api);

    await expect(uploads.uploadChatPhoto(new File(['image'], 'photo.jpg', { type: 'image/jpeg' })))
      .resolves.toBe('photos/2026/09/photo.jpg');

    const [path, form] = postForm.mock.calls[0] as [string, FormData];
    expect(path).toBe('data/upload');
    expect(form.get('name')).toBe('photo.jpg');
    expect(form.get('type')).toBe('photos');
    expect(form.get('handle')).toBe('chat');
    expect(form.get('multiple')).toBe('false');
    expect(form.get('chunkIndex')).toBe('0');
    expect(form.get('totalChunks')).toBe('1');
  });
});
