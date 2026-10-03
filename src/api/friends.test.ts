import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatPalezApiClient } from './client';
import { FriendsService } from './friends';
import type { AppConfig } from '../config';

const config: AppConfig = {
  origin: new URL('https://chatpalez.com'),
  chatSocketUrl: new URL('https://chatpalez.com'),
  allowedHosts: new Set(['chatpalez.com'])
};

afterEach(() => vi.unstubAllGlobals());

describe('FriendsService engine contract', () => {
  it('reads a page and preserves engine pagination', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 'success', data: [{ user_id: 7, user_name: 'sam', connection: 'request' }], has_more: true
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new FriendsService(new ChatPalezApiClient({ config, getAuthToken: () => 'token' }));

    await expect(service.page('requests', 2)).resolves.toEqual({
      items: [{ user_id: 7, user_name: 'sam', connection: 'request' }], hasMore: true
    });
    expect((fetchMock.mock.calls[0][0] as URL).toString())
      .toBe('https://chatpalez.com/apis/php/mobile/friends?view=requests&offset=2');
  });

  it('uses the existing connect action with the required uid field', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'success' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new FriendsService(new ChatPalezApiClient({ config, getAuthToken: () => 'token' }));

    await service.connect(7, 'accept');
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/apis/php/user/connect');
    expect(JSON.parse(init.body as string)).toEqual({ do: 'friend-accept', id: 7, uid: '0' });
  });
});
