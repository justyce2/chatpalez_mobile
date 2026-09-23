import { describe, expect, it } from 'vitest';
import { RealtimeDeliveryUncertainError } from './chat-realtime';

describe('RealtimeDeliveryUncertainError', () => {
  it('marks acknowledgement-loss failures as uncertain delivery', () => {
    const error = new RealtimeDeliveryUncertainError();

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('RealtimeDeliveryUncertainError');
    expect(error.deliveryUncertain).toBe(true);
    expect(error.message).toContain('could not be confirmed');
  });
});
