import type { ApiPage, ChatPalezApiClient } from './client';

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
}
