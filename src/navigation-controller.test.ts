import { describe, expect, it } from 'vitest';
import type { AppConfig } from './config';
import { classifyNavigation } from './navigation-controller';

const config: AppConfig = {
  origin: new URL('https://chatpalez.com'),
  chatSocketUrl: new URL('https://chatpalez.com'),
  allowedHosts: new Set(['chatpalez.com', 'www.chatpalez.com'])
};

describe('classifyNavigation', () => {
  it('keeps trusted HTTPS ChatPalez routes internal', () => {
    expect(classifyNavigation('https://chatpalez.com/messages?thread=4', config)).toEqual({
      kind: 'internal',
      url: 'https://chatpalez.com/messages?thread=4'
    });
  });

  it('resolves trusted relative routes against the configured origin', () => {
    expect(classifyNavigation('/profile/justice', config)).toEqual({
      kind: 'internal',
      url: 'https://chatpalez.com/profile/justice'
    });
  });

  it('sends untrusted HTTPS hosts outside the internal container', () => {
    expect(classifyNavigation('https://example.org/article', config)).toEqual({
      kind: 'external',
      url: 'https://example.org/article'
    });
  });

  it('allows telephone and email schemes only as external actions', () => {
    expect(classifyNavigation('tel:+2348000000000', config).kind).toBe('external');
    expect(classifyNavigation('mailto:support@chatpalez.com', config).kind).toBe('external');
  });

  it('blocks unsafe script and data schemes', () => {
    expect(classifyNavigation('javascript:alert(1)', config).kind).toBe('blocked');
    expect(classifyNavigation('data:text/html,<script>alert(1)</script>', config).kind).toBe('blocked');
  });

  it('does not trust plain HTTP even for an approved host', () => {
    expect(classifyNavigation('http://chatpalez.com/login', config)).toEqual({
      kind: 'external',
      url: 'http://chatpalez.com/login'
    });
  });
});
