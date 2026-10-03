import { describe, expect, it } from 'vitest';
import { canForwardMessage, displayChatMessage, forwardedText } from './chat-forward';

describe('chat forwarding', () => {
  it('keeps one visible label across repeated forwards and decoded API history', () => {
    const stored = forwardedText("it's ready");
    expect(forwardedText(stored)).toBe(stored);
    expect(displayChatMessage({ message_orginal_decoded: stored })).toEqual({ text: "it's ready", forwarded: true });
    expect(displayChatMessage({ message_orginal_decoded: forwardedText('') })).toEqual({ text: '', forwarded: true });
  });

  it('excludes engine media that the ordinary message endpoint cannot safely recreate', () => {
    expect(canForwardMessage({ image: 'photos/2026/09/a.jpg' })).toBe(true);
    expect(canForwardMessage({ message_orginal_decoded: 'Hello' })).toBe(true);
    expect(canForwardMessage({ image: 'photos/2026/09/a.jpg', is_paid: '1' })).toBe(false);
    expect(canForwardMessage({ video: 'videos/a.mp4' })).toBe(false);
  });
});
