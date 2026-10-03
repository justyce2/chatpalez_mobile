import { describe, expect, it, vi } from 'vitest';
import { UploadService } from './uploads';
import type { ChatPalezApiClient } from './client';

describe('UploadService', () => {
  it('rejects non-image attachments before they reach the API', async () => {
    const postFormWithProgress = vi.fn();
    const api = { postFormWithProgress } as unknown as ChatPalezApiClient;
    const uploads = new UploadService(api);

    await expect(uploads.uploadChatPhoto(new File(['text'], 'note.txt', { type: 'text/plain' })))
      .rejects.toThrow('Choose an image file to attach.');
    expect(postFormWithProgress).not.toHaveBeenCalled();
  });


  it('uses the profile-picture upload contract without hardcoding the production host', async () => {
    const postFormWithProgress = vi.fn().mockResolvedValue('123-profile.jpg');
    const api = { postFormWithProgress } as unknown as ChatPalezApiClient;
    const uploads = new UploadService(api);

    await expect(
      uploads.uploadProfilePicture(new File(['image'], 'profile-picture.jpg', { type: 'image/jpeg' }))
    ).resolves.toBe('123-profile.jpg');

    const [path, form] = postFormWithProgress.mock.calls[0] as [string, FormData];
    expect(path).toBe('data/upload');
    expect(form.get('name')).toBe('profile-picture.jpg');
    expect(form.get('type')).toBe('photos');
    expect(form.get('handle')).toBe('picture-user');
    expect(form.get('multiple')).toBe('false');
    expect(form.get('chunkIndex')).toBe('0');
    expect(form.get('totalChunks')).toBe('1');
  });

  it('rejects an oversized profile picture before upload', async () => {
    const postFormWithProgress = vi.fn();
    const api = { postFormWithProgress } as unknown as ChatPalezApiClient;
    const uploads = new UploadService(api);

    const oversized = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'profile.jpg', { type: 'image/jpeg' });
    await expect(uploads.uploadProfilePicture(oversized)).rejects.toThrow('too large');
    expect(postFormWithProgress).not.toHaveBeenCalled();
  });

  it('uses the official one-part chat-photo upload contract', async () => {
    const postFormWithProgress = vi.fn().mockResolvedValue('photos/2026/09/photo.jpg');
    const api = { postFormWithProgress } as unknown as ChatPalezApiClient;
    const uploads = new UploadService(api);

    await expect(uploads.uploadChatPhoto(new File(['image'], 'photo.jpg', { type: 'image/jpeg' })))
      .resolves.toBe('photos/2026/09/photo.jpg');

    const [path, form] = postFormWithProgress.mock.calls[0] as [string, FormData];
    expect(path).toBe('data/upload');
    expect(form.get('name')).toBe('photo.jpg');
    expect(form.get('type')).toBe('photos');
    expect(form.get('handle')).toBe('chat');
    expect(form.get('multiple')).toBe('false');
    expect(form.get('chunkIndex')).toBe('0');
    expect(form.get('totalChunks')).toBe('1');
  });
});
