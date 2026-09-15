import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearDiagnostics,
  getDiagnosticSnapshot,
  recordDiagnostic
} from './diagnostics';

describe('mobile diagnostics', () => {
  beforeEach(() => {
    clearDiagnostics();
  });

  it('redacts sensitive context keys', () => {
    recordDiagnostic('error', 'request failed', {
      password: 'secret-password',
      session_id: 'session-123',
      accessToken: 'token-123',
      route: 'https://chatpalez.com/settings'
    });

    const [entry] = getDiagnosticSnapshot();
    expect(entry.context.password).toBe('[redacted]');
    expect(entry.context.session_id).toBe('[redacted]');
    expect(entry.context.accessToken).toBe('[redacted]');
    expect(entry.context.route).toBe('https://chatpalez.com/settings');
  });

  it('redacts bearer tokens and sensitive URL query values', () => {
    recordDiagnostic(
      'error',
      'Authorization: Bearer abc.def.ghi https://chatpalez.com/callback?access_token=topsecret&code=visible'
    );

    const [entry] = getDiagnosticSnapshot();
    expect(entry.message).not.toContain('abc.def.ghi');
    expect(entry.message).not.toContain('topsecret');
    expect(entry.message).toContain('[redacted]');
  });

  it('removes URL fragments from URL context values', () => {
    recordDiagnostic('info', 'route', {
      url: 'https://chatpalez.com/messages?thread=5#private-fragment'
    });

    const [entry] = getDiagnosticSnapshot();
    expect(entry.context.url).toBe('https://chatpalez.com/messages?thread=5');
  });

  it('keeps only the most recent bounded set of entries', () => {
    for (let index = 0; index < 100; index += 1) {
      recordDiagnostic('debug', `event-${index}`);
    }

    const snapshot = getDiagnosticSnapshot();
    expect(snapshot).toHaveLength(75);
    expect(snapshot[0].message).toBe('event-25');
    expect(snapshot[74].message).toBe('event-99');
  });

  it('returns defensive copies rather than the live buffer', () => {
    recordDiagnostic('info', 'safe', { route: '/home' });
    const snapshot = getDiagnosticSnapshot();
    snapshot[0].message = 'mutated';
    snapshot[0].context.route = '/changed';

    const fresh = getDiagnosticSnapshot();
    expect(fresh[0].message).toBe('safe');
    expect(fresh[0].context.route).toBe('/home');
  });
});
