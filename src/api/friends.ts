import type { ChatPalezApiClient } from './client';

export type FriendsView = 'friends' | 'requests' | 'sent' | 'discover';
export type FriendConnection = 'add' | 'remove' | 'request' | 'cancel' | 'declined' | 'me';
export type FriendPerson = {
  user_id: number | string;
  user_name: string;
  user_firstname?: string;
  user_lastname?: string;
  user_picture?: string;
  user_verified?: boolean;
  mutual_friends_count?: number;
  connection: FriendConnection;
};
export type FriendAction = 'add' | 'accept' | 'decline' | 'cancel' | 'remove';

export class FriendsService {
  constructor(private readonly api: ChatPalezApiClient) {}

  async enabled(): Promise<boolean> {
    const settings = await this.api.get<{ system?: { friends_enabled?: boolean | number | string } }>('app/settings');
    return Boolean(Number(settings.system?.friends_enabled));
  }

  async page(view: FriendsView, offset: number): Promise<{ items: FriendPerson[]; hasMore: boolean }> {
    const result = await this.api.getPage<FriendPerson[]>('mobile/friends', { view, offset });
    return { items: result.data, hasMore: result.hasMore };
  }

  async search(query: string): Promise<FriendPerson[]> {
    return this.api.get<FriendPerson[]>('mobile/friends/search', { query });
  }

  async connect(userId: number | string, action: FriendAction): Promise<void> {
    await this.api.post<unknown>('user/connect', { do: `friend-${action}`, id: userId, uid: '0' });
  }
}
