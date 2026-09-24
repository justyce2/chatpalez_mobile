import { describe, expect, it, vi } from 'vitest';

const { chooseFromGallery } = vi.hoisted(() => ({ chooseFromGallery: vi.fn() }));
vi.mock('@capacitor/camera', () => ({
  Camera: { chooseFromGallery }, MediaTypeSelection: { Photo: 'photo' }
}));

import { pickNativeChatPhoto } from './chat-photo-picker';

describe('native chat photo picker', () => {
  it('turns the chosen media into a sendable image File', async () => {
    chooseFromGallery.mockResolvedValueOnce({ results: [{ webPath: 'https://localhost/_capacitor_file_/selected', metadata: { format: 'jpeg' } }] });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true, blob: async () => new Blob(['image-bytes'], { type: 'image/jpeg' })
    } as Response);

    const file = await pickNativeChatPhoto();
    expect(file).toBeInstanceOf(File);
    expect(file?.type).toBe('image/jpeg');
    expect(file?.size).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith('https://localhost/_capacitor_file_/selected');
    fetchMock.mockRestore();
  });
});
