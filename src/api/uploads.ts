import type { ChatPalezApiClient } from './client';

export class UploadService {
  constructor(private readonly api: ChatPalezApiClient) {}

  async uploadChatPhoto(file: File): Promise<string> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Choose an image file to attach.');
    }

    const form = new FormData();
    form.append('file', file, file.name);
    form.append('name', file.name);
    // randomUUID is absent on several supported Android WebViews.
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    form.append('guid', `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`);
    form.append('type', 'photos');
    form.append('handle', 'chat');
    form.append('multiple', 'false');
    form.append('blur', 'false');
    form.append('chunkIndex', '0');
    form.append('totalChunks', '1');
    return this.api.postForm<string>('data/upload', form);
  }
}
