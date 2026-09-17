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
    form.append('guid', crypto.randomUUID());
    form.append('type', 'photos');
    form.append('handle', 'chat');
    form.append('multiple', 'false');
    form.append('blur', 'false');
    form.append('chunkIndex', '0');
    form.append('totalChunks', '1');
    return this.api.postForm<string>('data/upload', form);
  }
}
