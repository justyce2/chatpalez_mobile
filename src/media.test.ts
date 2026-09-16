import { describe, expect, it } from 'vitest';
import { getChatPhotoUrl } from './media';

describe('chat photo URL', () => {
  const origin = new URL('https://chatpalez.com');

  it('builds a ChatPalez uploads URL from a valid photo source', () => {
    expect(getChatPhotoUrl(origin, 'photos/2026/09/image.png')).toBe('https://chatpalez.com/uploads/photos/2026/09/image.png');
  });

  it('rejects malformed and non-photo sources', () => {
    expect(getChatPhotoUrl(origin, '../secrets.png')).toBeNull();
    expect(getChatPhotoUrl(origin, 'https://attacker.example/a.png')).toBeNull();
    expect(getChatPhotoUrl(origin, 'videos/2026/09/movie.mp4')).toBeNull();
  });
});
