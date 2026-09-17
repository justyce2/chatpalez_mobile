import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ChatPalezApiClient } from './client';
import type { AppConfig } from '../config';

const config: AppConfig = {
  origin: new URL('https://chatpalez.com'),
  allowedHosts: new Set(['chatpalez.com'])
};

afterEach(() => vi.unstubAllGlobals());

describe('ChatPalezApiClient transport', () => {
  it('sends mobile/JWT headers and preserves a paged response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'success', data: ['one'], has_more: true
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = new ChatPalezApiClient({ config, getAuthToken: () => 'jwt-token' });

    await expect(api.getPage<string[]>('chat/conversations', { offset: 2, ignored: undefined }))
      .resolves.toEqual({ data: ['one'], hasMore: true });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://chatpalez.com/apis/php/chat/conversations?offset=2');
    expect(new Headers(init.headers).get('x-mobile-client')).toBe('chatpalez-mobile-v1');
    expect(new Headers(init.headers).get('x-auth-token')).toBe('jwt-token');
    expect(init.credentials).toBe('include');
  });

  it('does not force a JSON content type on multipart uploads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'success', data: 'ok' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const api = new ChatPalezApiClient({ config, getAuthToken: () => null });

    await api.postForm('data/upload', new FormData());

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(new Headers(init.headers).get('content-type')).toBeNull();
  });

  it('clears only an expired authenticated session', async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'error', message: 'Session expired'
    }), { status: 401 })));
    const api = new ChatPalezApiClient({ config, getAuthToken: () => 'jwt-token', onUnauthorized });

    await expect(api.get('user/blocked')).rejects.toEqual(expect.objectContaining<ApiError>({ status: 401 }));
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not clear a session for a public authentication failure', async () => {
    const onUnauthorized = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'error', message: 'Invalid credentials'
    }), { status: 401 })));
    const api = new ChatPalezApiClient({ config, getAuthToken: () => null, onUnauthorized });

    await expect(api.post('auth/signin', {})).rejects.toEqual(expect.objectContaining<ApiError>({ status: 401 }));
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('normalizes failed API responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'error', message: 'Access denied'
    }), { status: 403 })));
    const api = new ChatPalezApiClient({ config, getAuthToken: () => null });

    await expect(api.get('user/blocked')).rejects.toEqual(expect.objectContaining<ApiError>({
      name: 'ApiError', status: 403, message: 'Access denied'
    }));
  });
});
