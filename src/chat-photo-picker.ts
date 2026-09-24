import { Camera, MediaTypeSelection } from '@capacitor/camera';

export async function pickNativeChatPhoto(): Promise<File | null> {
  const { results } = await Camera.chooseFromGallery({
    mediaType: MediaTypeSelection.Photo,
    allowMultipleSelection: false,
    includeMetadata: true,
    quality: 85
  });
  const photo = results[0];
  if (!photo) return null;
  if (!photo.webPath) throw new Error('The selected photo has no readable path.');
  const response = await fetch(photo.webPath);
  if (!response.ok) throw new Error('The selected photo could not be opened.');
  const blob = await response.blob();
  if (!blob.size) throw new Error('The selected photo is empty.');
  const format = String(photo.metadata?.format || 'jpeg').toLowerCase();
  const extension = format === 'png' ? 'png' : format === 'webp' ? 'webp' : 'jpg';
  return new File([blob], `chat-photo-${Date.now()}.${extension}`, {
    type: blob.type.startsWith('image/') ? blob.type : `image/${format === 'jpg' ? 'jpeg' : format}`
  });
}
