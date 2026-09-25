import { describe, expect, it } from 'vitest';
import { chatMessageText } from './chat-message-text';

describe('chatMessageText', () => {
  it('uses the decoded original text from the engine', () => {
    expect(chatMessageText({ message: '<p>it&#039;s</p>', message_orginal_decoded: "it's" })).toBe("it's");
  });

  it('decodes older responses once while preserving literal markup as text', () => {
    expect(chatMessageText({ message: 'it&#039;s &amp; &lt;safe&gt;' })).toBe("it's & <safe>");
  });
});
