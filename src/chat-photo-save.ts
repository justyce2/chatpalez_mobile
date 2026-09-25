import { Capacitor, registerPlugin } from '@capacitor/core';

const saver = registerPlugin<{ save(options: { url: string }): Promise<{ cancelled?: boolean }> }>('ChatPhotoSaver');

export async function saveChatPhoto(url: string): Promise<void> {
  const source = new URL(url);
  if (source.protocol !== 'https:' || source.port || source.username || source.password
      || !['chatpalez.com', 'cloud.chatpalez.com'].includes(source.hostname.toLowerCase())
      || !/^\/uploads\/photos\//.test(source.pathname)) {
    throw new Error('This photo cannot be saved from an untrusted location.');
  }
  if (Capacitor.isNativePlatform()) {
    await saver.save({ url: source.toString() });
    return;
  }
  const response = await fetch(source.toString());
  if (!response.ok) throw new Error('The photo could not be downloaded.');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('The photo is unavailable.');
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = source.pathname.split('/').pop() || 'chatpalez-photo.jpg';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
