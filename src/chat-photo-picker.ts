import { Camera, CameraResultType, CameraSource, MediaTypeSelection } from '@capacitor/camera';
import { Capacitor, registerPlugin } from '@capacitor/core';

const androidPicker = registerPlugin<{ pick(): Promise<{ uri?: string; type?: string }> }>('ChatPhotoPicker');

async function photoToFile(photo: { webPath?: string; uri?: string; metadata?: { format?: string } } | null): Promise<File | null> {
  if (!photo || !(photo.webPath || photo.uri)) return null;
  const webPath = photo.webPath || Capacitor.convertFileSrc(photo.uri!);
  const response = await fetch(webPath!);
  if (!response.ok) throw new Error('The selected photo could not be opened.');
  const maximumBytes = 8 * 1024 * 1024;
  if (Number(response.headers.get('content-length')) > maximumBytes) {
    throw new Error('This photo is too large. Choose a smaller image.');
  }
  const advertisedLength = Number(response.headers.get('content-length') || 0);
  if (advertisedLength > 8 * 1024 * 1024) throw new Error('This photo is too large. Choose a smaller image.');
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
  return new File([blob], `chat-photo-${Date.now()}.${extension}`, { type });
}

export async function pickNativeChatPhoto(): Promise<File | null> {
  const selected = Capacitor.getPlatform() === 'android'
    ? await androidPicker.pick()
    : await Camera.chooseFromGallery({
      mediaType: MediaTypeSelection.Photo,
      allowMultipleSelection: false,
      includeMetadata: false,
      quality: 72,
      targetWidth: 1280,
      targetHeight: 1280
    });
  const photo = 'results' in selected ? selected.results[0] : selected;
  return photoToFile(photo as { webPath?: string; uri?: string; metadata?: { format?: string } });
}

export async function pickNativeChatPhotoWithChoice(): Promise<File | null> {
  const source = window.confirm('Take a picture now?\nChoose Cancel to select a photo from your gallery.');
  if (!source) return pickNativeChatPhoto();
  const photo = await Camera.getPhoto({ source: CameraSource.Camera, resultType: CameraResultType.Uri, quality: 72, width: 1280, height: 1280, correctOrientation: true, saveToGallery: false });
  return photoToFile(photo as { webPath?: string; uri?: string; metadata?: { format?: string } });
}
