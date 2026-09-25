import type { Message } from './api/chat';

/** The engine's message field contains formatted HTML; the original decoded field is display text. */
export function chatMessageText(message: Pick<Message, 'message' | 'message_orginal' | 'message_orginal_decoded'>): string {
  if (typeof message.message_orginal_decoded === 'string') return message.message_orginal_decoded;
  const value = message.message_orginal ?? message.message ?? '';
  return value.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|amp|quot|apos|lt|gt|nbsp);/gi, (entity, code: string) => {
    const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: '\u00a0' };
    if (code[0] !== '#') return named[code.toLowerCase()] ?? entity;
    const point = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
      ? String.fromCodePoint(point) : entity;
  });
}
