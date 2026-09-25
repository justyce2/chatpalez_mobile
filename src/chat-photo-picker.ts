import { Camera, MediaTypeSelection } from '@capacitor/camera';
import { Capacitor, registerPlugin } from '@capacitor/core';

const androidPicker = registerPlugin<{ pick(): Promise<{ uri?: string; type?: string }> }>('ChatPhotoPicker');

export async function pickNativeChatPhoto(): Promise<File | null> {
  const selected = Capacitor.getPlatform() === 'android'
    ? await androidPicker.pick()
    : await Camera.chooseFromGallery({
    mediaType: MediaTypeSelection.Photo,
    allowMultipleSelection: false,
    // Android Camera 8 decodes the whole image again to collect EXIF metadata.
    // The chat upload needs only the bounded image file, not EXIF.
    includeMetadata: false,
    quality: 72,
    targetWidth: 1280,
    targetHeight: 1280
    });
  const photo = 'results' in selected ? selected.results[0] : selected;
  if (!photo || !('webPath' in photo ? photo.webPath : photo.uri)) return null;
  const webPath = 'webPath' in photo ? photo.webPath : Capacitor.convertFileSrc(photo.uri!);
  const response = await fetch(webPath!);
  if (!response.ok) throw new Error('The selected photo could not be opened.');
  const maximumBytes = 8 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > maximumBytes) {
    throw new Error('This photo is too large. Choose a smaller image.');
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error('The selected photo is empty.');
  if (blob.size > maximumBytes) throw new Error('This photo is too large. Choose a smaller image.');
  const format = 'metadata' in photo ? String(photo.metadata?.format || 'jpeg').toLowerCase() : 'jpeg';
  const type = blob.type.startsWith('image/') ? blob.type : `image/${format === 'jpg' ? 'jpeg' : format}`;
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif'
  };
  const extension = extensions[type];
  if (!extension) throw new Error('This image format is not supported for chat.');
  return new File([blob], `chat-photo-${Date.now()}.${extension}`, {
    type
  });
}
