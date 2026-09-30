import { describe, expect, it } from 'vitest';
import { resolveAudioFormat } from './audio-format';

describe('audio format resolution', () => {
  it('accepts AAC when the recorder declares it', () => {
    expect(resolveAudioFormat(new Uint8Array([0xff, 0xf1]), 'audio/aac', 'aac')).toEqual({ mime: 'audio/aac', extension: 'aac' });
  });

  it('accepts WAV from a recorder that reports a WAV extension', () => {
    const bytes = new Uint8Array(12);
    bytes.set([...new TextEncoder().encode('RIFF')], 0);
    bytes.set([...new TextEncoder().encode('WAVE')], 8);
    expect(resolveAudioFormat(bytes, '', 'wav')).toEqual({ mime: 'audio/wav', extension: 'wav' });
  });

  it('detects WAV when metadata is missing', () => {
    const bytes = new Uint8Array(12);
    bytes.set([...new TextEncoder().encode('RIFF')], 0);
    bytes.set([...new TextEncoder().encode('WAVE')], 8);
    expect(resolveAudioFormat(bytes)).toEqual({ mime: 'audio/wav', extension: 'wav' });
  });

  it('accepts common container formats without forcing AAC', () => {
    expect(resolveAudioFormat(new Uint8Array(16), 'audio/mp4', 'm4a')).toEqual({ mime: 'audio/mp4', extension: 'm4a' });
    expect(resolveAudioFormat(new Uint8Array(16), 'audio/webm', 'webm')).toEqual({ mime: 'audio/webm', extension: 'webm' });
    expect(resolveAudioFormat(new Uint8Array(16), 'audio/ogg', 'ogg')).toEqual({ mime: 'audio/ogg', extension: 'ogg' });
  });

  it('fails safely instead of falsely labelling unknown audio as AAC', () => {
    expect(() => resolveAudioFormat(new Uint8Array([1, 2, 3]))).toThrow('recording format could not be identified');
  });
});
