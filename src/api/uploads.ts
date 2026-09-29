import type { ChatPalezApiClient } from './client';

export class UploadService {
  constructor(private readonly api: ChatPalezApiClient) {}

  private makeGuid(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }

  private async upload(file: File, type: 'photos' | 'videos' | 'files' | 'audio', onProgress?: (percent: number) => void, chatThumbnail = false): Promise<unknown> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('name', file.name);
    form.append('guid', this.makeGuid());
    form.append('type', type);
    form.append('handle', 'chat');
    form.append('multiple', 'false');
    form.append('blur', 'false');
    form.append('chunkIndex', '0');
    form.append('totalChunks', '1');
    if (chatThumbnail) form.append('chat_thumbnail', '1');
    return this.api.postFormWithProgress<string>('data/upload', form, (loaded, total) => {
      if (total && total > 0) onProgress?.(Math.round((loaded / total) * 100));
    });
  }

  async uploadChatPhoto(file: File, onProgress?: (percent: number) => void): Promise<string> {
    if (!file.type.startsWith('image/')) throw new Error('Choose an image file to attach.');
    return this.upload(file, 'photos', onProgress) as Promise<string>;
  }

  async uploadChatVideo(file: File, onProgress?: (percent: number) => void): Promise<{ source: string; thumbnail: string }> {
    if (!file.type.startsWith('video/')) throw new Error('Choose a video file to attach.');
    const result = await this.upload(file, 'videos', onProgress, true) as string | { source?: string; thumbnail?: string };
    return typeof result === 'string' ? { source: result, thumbnail: '' } : { source: String(result.source || ''), thumbnail: String(result.thumbnail || '') };
  }

  async uploadChatFile(file: File, onProgress?: (percent: number) => void): Promise<string> {
    return this.upload(file, 'files', onProgress) as Promise<string>;
  }
  async uploadChatVoice(file: File, onProgress?: (percent: number) => void): Promise<string> {
    if (!file.type.startsWith('audio/')) throw new Error('Choose an audio recording to attach.');
    return this.upload(file, 'audio', onProgress) as Promise<string>;
  }
}
