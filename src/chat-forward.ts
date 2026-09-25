import type { Message } from './api/chat';
import { chatMessageText } from './chat-message-text';

// Stored in the engine's ordinary message field, so the label survives reloads
// without changing its database or replacing its chat endpoints.
const marker = '↪ Forwarded\n';

export function forwardedText(message: string): string {
  return marker + stripForwardedLabel(message);
}

export function stripForwardedLabel(message: string): string {
  return message.startsWith(marker) ? message.slice(marker.length) : message;
}

export function displayChatMessage(message: Message): { text: string; forwarded: boolean } {
  const text = chatMessageText(message);
  return { text: stripForwardedLabel(text), forwarded: text.startsWith(marker) };
}

export function canForwardMessage(message: Message): boolean {
  if (message.is_paid === true || message.is_paid === 1 || message.is_paid === '1'
    || message.video || message.voice_note || message.product_post_id) return false;
  return Boolean(displayChatMessage(message).text || message.image || message.photo);
}
