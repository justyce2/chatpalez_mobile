import type { ChatPalezApiClient } from './client';

export type FeedReaction = 'like' | 'love' | 'haha' | 'yay' | 'wow' | 'sad' | 'angry';

export type FeedMedia = {
  source: string | null;
  thumbnail?: string | null;
};

export type FeedLink = {
  url: string | null;
  title: string;
  description: string;
  host: string;
  image: string | null;
};

export type FeedPost = {
  post_id: number | string;
  post_type: string;
  text: string;
  time: string;
  privacy: string;
  source?: string;
  author_id?: number | string | null;
  author_name: string;
  author_username: string;
  author_picture: string;
  author_verified: boolean;
  author_type: string;
  comments: number;
  shares: number;
  views: number;
  i_react: boolean;
  i_reaction: FeedReaction | null;
  i_save?: boolean;
  can_comment: boolean;
  can_share: boolean;
  can_edit: boolean;
  can_delete: boolean;
  reactions: Record<FeedReaction, number>;
  photos: Array<{ id?: number | string | null; source: string; blur?: boolean }>;
  video: FeedMedia | null;
  reel: FeedMedia | null;
  link: FeedLink | null;
  origin?: FeedPost | null;
  url: string;
};

export type FeedComment = {
  comment_id: number | string;
  author_id?: number | string | null;
  author_name: string;
  author_picture: string;
  text: string;
  image?: string | null;
  time: string;
  replies: number;
  i_react: boolean;
  i_reaction: FeedReaction | null;
  can_edit: boolean;
  can_delete: boolean;
  reactions: Record<FeedReaction, number>;
};

export class FeedService {
  constructor(private readonly api: ChatPalezApiClient) {}

  async getFeed(offset = 0, view = 'newsfeed') {
    return this.api.getPage<FeedPost[]>('mobile/feed', { offset, view });
  }

  async getPost(postId: number | string): Promise<FeedPost> {
    return this.api.get<FeedPost>('mobile/post', { post_id: postId });
  }

  async getComments(postId: number | string, offset = 0, sorting = 'recent') {
    return this.api.getPage<FeedComment[]>('mobile/post/comments', {
      post_id: postId,
      offset,
      sorting
    });
  }

  react(postId: number | string, reaction: FeedReaction, action: 'react' | 'unreact' = 'react') {
    return this.api.post<FeedPost>('mobile/post/react', { post_id: postId, reaction, do: action });
  }

  comment(postId: number | string, message: string) {
    return this.api.post<FeedComment>('mobile/post/comment', { post_id: postId, message });
  }

  save(postId: number | string, action: 'save' | 'unsave' = 'save') {
    return this.api.post<FeedPost>('mobile/post/save', { post_id: postId, do: action });
  }

  report(postId: number | string, category: number | string, reason: string) {
    return this.api.post<void>('mobile/post/report', { post_id: postId, category, reason });
  }
}
