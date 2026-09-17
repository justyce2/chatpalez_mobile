export function getChatPhotoUrl(origin: URL, source: string | undefined): string | null {
  if (!source || !/^photos\/\d{4}\/\d{2}\/[A-Za-z0-9._-]+\.[A-Za-z0-9]+$/.test(source)) {
    return null;
  }
  return new URL(`uploads/${source}`, origin).toString();
}
