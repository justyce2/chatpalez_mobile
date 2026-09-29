import { describe, expect, it } from 'vitest';
import { needsRegistrationCompletion } from './registration';

const session = (activated: boolean | number | string, started: boolean | number | string) => ({
  token: 'token',
  user: { user_id: 7, user_activated: activated, user_started: started }
});

describe('registration completion policy', () => {
  it('does not require account verification when activation is disabled', () => {
    expect(needsRegistrationCompletion(session(false, true), {
      activation_enabled: 0,
      activation_required: 0,
      getting_started: 0
    })).toBe(false);
  });

  it('still requires account verification when activation is enabled', () => {
    expect(needsRegistrationCompletion(session(false, true), {
      activation_enabled: 1,
      activation_required: 1,
      getting_started: 0
    })).toBe(true);
  });

  it('requires getting started only when that feature is enabled', () => {
    expect(needsRegistrationCompletion(session(true, false), {
      activation_enabled: 0,
      activation_required: 1,
      getting_started: 1
    })).toBe(true);

    expect(needsRegistrationCompletion(session(true, false), {
      activation_enabled: 0,
      activation_required: 0,
      getting_started: 0
    })).toBe(false);
  });
});
