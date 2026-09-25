import { Camera, MediaTypeSelection } from '@capacitor/camera';

export async function pickNativeChatPhoto(): Promise<File | null> {
  const { results } = await Camera.chooseFromGallery({
    mediaType: MediaTypeSelection.Photo,
    allowMultipleSelection: false,
    // Android Camera 8 decodes the whole image again to collect EXIF metadata.
    // The chat upload needs only the bounded image file, not EXIF.
    includeMetadata: false,
    quality: 72,
    targetWidth: 1280,
    targetHeight: 1280
  });
  const photo = results[0];
  if (!photo) return null;
  if (!photo.webPath) throw new Error('The selected photo has no readable path.');
  const response = await fetch(photo.webPath);
  if (!response.ok) throw new Error('The selected photo could not be opened.');
  const maximumBytes = 8 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > maximumBytes) {
    throw new Error('This photo is too large. Choose a smaller image.');
  }
  const blob = await response.blob();
  if (!blob.size) throw new Error('The selected photo is empty.');
  if (blob.size > maximumBytes) throw new Error('This photo is too large. Choose a smaller image.');
  const format = String(photo.metadata?.format || 'jpeg').toLowerCase();
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
