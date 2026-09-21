import type { ApiPage, ChatPalezApiClient } from './client';
import type { FeedPost } from './feed';

export type CommunityView = 'discover' | 'liked' | 'joined' | 'going' | 'interested' | 'invited' | 'manage';

export type MobilePage = {
  page_id: number | string;
  page_name: string;
  page_title: string;
  page_picture?: string;
  page_likes?: number;
  page_verified?: boolean;
  i_like?: boolean;
  url?: string;
};

export type MobileGroup = {
  group_id: number | string;
  group_name: string;
  group_title: string;
  group_picture?: string;
  group_members?: number;
  group_privacy?: string;
  i_joined?: false | 'approved' | 'pending' | string;
  url?: string;
};

export type MobilePerson = {
  user_id: number | string;
  user_name?: string;
  user_firstname?: string;
  user_lastname?: string;
  user_fullname?: string;
  user_picture?: string;
  user_verified?: boolean;
  user_subscribed?: boolean;
  mutual_friends_count?: number;
  connection?: unknown;
  url?: string;
};

export type MobileSearchResult = {
  type: 'user' | 'page' | 'group' | 'event';
  id?: number | string;
  user_id?: number | string;
  title?: string;
  subtitle?: string;
  picture?: string;
  user_name?: string;
  user_fullname?: string;
  url?: string;
};

export type CommunityDetail = {
  type: 'page' | 'group' | 'event';
  id: number | string;
  slug?: string;
  title: string;
  description?: string;
  picture?: string;
  cover?: string | null;
  members_label?: string;
  privacy?: string;
  relationship?: unknown;
  start_date?: string | null;
  end_date?: string | null;
  is_online?: boolean;
  url?: string;
  can_view_posts?: boolean;
  posts?: FeedPost[];
};

export type MobileEvent = {
  event_id: number | string;
  event_title: string;
  event_picture?: string;
  event_interested?: number;
  event_is_online?: boolean;
  event_start_date?: string | null;
  event_end_date?: string | null;
  i_joined?: {
    is_going?: boolean | number | string;
    is_interested?: boolean | number | string;
    is_invited?: boolean | number | string;
  };
  url?: string;
};

export class CommunityService {
  constructor(private readonly api: ChatPalezApiClient) {}

  getPages(view: 'discover' | 'liked' | 'manage' = 'discover', offset = 0): Promise<ApiPage<MobilePage[]>> {
    return this.api.getPage<MobilePage[]>('mobile/pages', { view, offset });
  }

  getGroups(view: 'discover' | 'joined' | 'manage' = 'discover', offset = 0): Promise<ApiPage<MobileGroup[]>> {
    return this.api.getPage<MobileGroup[]>('mobile/groups', { view, offset });
  }

  getEvents(view: 'discover' | 'going' | 'interested' | 'invited' | 'manage' = 'discover', offset = 0): Promise<ApiPage<MobileEvent[]>> {
    return this.api.getPage<MobileEvent[]>('mobile/events', { view, offset });
  }

  getPeople(view: 'discover' | 'requests' | 'sent' | 'friends' = 'discover', offset = 0): Promise<ApiPage<MobilePerson[]>> {
    return this.api.getPage<MobilePerson[]>('mobile/people', { view, offset });
  }

  search(query: string): Promise<MobileSearchResult[]> {
    return this.api.get<MobileSearchResult[]>('mobile/search', { query });
  }

  getDetail(type: 'page' | 'group' | 'event', id: number | string): Promise<CommunityDetail> {
    return this.api.get<CommunityDetail>('mobile/community/detail', { type, id });
  }
}
