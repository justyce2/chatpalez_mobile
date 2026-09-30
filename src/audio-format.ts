export type AudioFormat = { mime: string; extension: string };

const MIME_BY_EXTENSION: Record<string, string> = {
  aac: 'audio/aac',
  adts: 'audio/aac',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  wav: 'audio/wav',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  mp3: 'audio/mpeg',
  amr: 'audio/amr',
  flac: 'audio/flac',
  caf: 'audio/x-caf'
};

const EXTENSION_BY_MIME: Record<string, string> = {
  'audio/aac': 'aac',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/mpeg': 'mp3',
  'audio/amr': 'amr',
  'audio/flac': 'flac',
  'audio/x-caf': 'caf',
  'audio/3gpp': '3gp'
};

export function normalizeAudioMime(value: string): string {
  return value.trim().toLowerCase().split(';', 1)[0] || '';
}

export function normalizeAudioExtension(value: string): string {
  return value.trim().toLowerCase().replace(/^\./, '');
}

export function detectAudioFormat(bytes: Uint8Array): AudioFormat | null {
  const ascii = (offset: number, length: number): string => {
    if (bytes.length < offset + length) return '';
    return String.fromCharCode(...bytes.slice(offset, offset + length));
  };
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') return { mime: 'audio/wav', extension: 'wav' };
  if (ascii(0, 4) === 'OggS') return { mime: 'audio/ogg', extension: 'ogg' };
  if (ascii(0, 4) === 'fLaC') return { mime: 'audio/flac', extension: 'flac' };
  if (ascii(0, 6) === '#!AMR\\n') return { mime: 'audio/amr', extension: 'amr' };
  if (ascii(0, 3) === 'ID3') return { mime: 'audio/mpeg', extension: 'mp3' };
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return { mime: 'audio/aac', extension: 'aac' };
  if (ascii(0, 4) === '\x1aE\xdf\xa3') return { mime: 'audio/webm', extension: 'webm' };
  if (bytes.length >= 12 && ascii(4, 4) === 'ftyp') {
    const brand = ascii(8, 4).toLowerCase();
    if (brand.startsWith('3gp')) return { mime: 'audio/3gpp', extension: '3gp' };
    return { mime: 'audio/mp4', extension: 'm4a' };
  }
  return null;
}

export function resolveAudioFormat(bytes: Uint8Array, declaredMime = '', declaredExtension = ''): AudioFormat {
  const mime = normalizeAudioMime(declaredMime);
  const extension = normalizeAudioExtension(declaredExtension);
  const detected = detectAudioFormat(bytes);
  const resolvedMime = mime || MIME_BY_EXTENSION[extension] || detected?.mime || '';
  const resolvedExtension = extension || EXTENSION_BY_MIME[resolvedMime] || detected?.extension || '';
  if (!resolvedMime.startsWith('audio/') || !resolvedExtension) {
    throw new Error('The recording format could not be identified. Please try recording again.');
  }
  return { mime: resolvedMime, extension: resolvedExtension };
}
