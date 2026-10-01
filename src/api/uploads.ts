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

  /**
   * Preserve the original pre-Socket chat upload contract:
   * FormData -> native API data/upload -> source returned by the API.
   *
   * Socket.IO is deliberately not involved in attachment transport.
   */
  private async upload(
    file: File,
    type: 'photos' | 'video' | 'file' | 'audio',
    chatThumbnail = false,
    onProgress?: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<string | { source: string; thumbnail?: string }> {
    if (!file || file.size <= 0) throw new Error('The selected attachment is empty.');
    if (!file.name.trim()) throw new Error('The selected attachment has no file name.');

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

    const result = await this.api.postFormWithProgress<string | { source?: string; thumbnail?: string }>(
      'data/upload',
      form,
      (loaded, total) => {
        if (!total) return;
        onProgress?.(Math.max(0, Math.min(100, Math.round((loaded / total) * 100))));
      },
      120000,
      signal
    );

    if (typeof result === 'string' && result.trim()) return result;
    if (result && typeof result === 'object' && typeof result.source === 'string' && result.source.trim()) {
      return {
        source: result.source,
        thumbnail: typeof result.thumbnail === 'string' ? result.thumbnail : ''
      };
    }

    throw new Error('ChatPalez returned an invalid upload result.');
  }

  async uploadChatPhoto(file: File, onProgress?: (percent: number) => void, signal?: AbortSignal): Promise<string> {
    if (!file.type.startsWith('image/')) throw new Error('Choose an image file to attach.');
    const result = await this.upload(file, 'photos', false, onProgress, signal);
    return typeof result === 'string' ? result : result.source;
  }

  async uploadChatVideo(file: File, onProgress?: (percent: number) => void, signal?: AbortSignal): Promise<{ source: string; thumbnail: string }> {
    if (!file.type.startsWith('video/')) throw new Error('Choose a video file to attach.');
    const result = await this.upload(file, 'video', true, onProgress, signal);
    return typeof result === 'string'
      ? { source: result, thumbnail: '' }
      : { source: result.source, thumbnail: String(result.thumbnail || '') };
  }

  async uploadChatFile(file: File, onProgress?: (percent: number) => void, signal?: AbortSignal): Promise<string> {
    if (!file.name.trim()) throw new Error('Choose a file to attach.');
    const result = await this.upload(file, 'file', false, onProgress, signal);
    return typeof result === 'string' ? result : result.source;
  }

  async uploadChatVoice(file: File, onProgress?: (percent: number) => void, signal?: AbortSignal): Promise<string> {
    if (!file.type.startsWith('audio/')) throw new Error('Choose an audio recording to attach.');
    const result = await this.upload(file, 'audio', false, onProgress, signal);
    return typeof result === 'string' ? result : result.source;
  }
}
