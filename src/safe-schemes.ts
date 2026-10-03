export const SAFE_EXTERNAL_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function isSafeExternalScheme(protocol: string): boolean {
  return SAFE_EXTERNAL_SCHEMES.has(protocol.toLowerCase());
}
