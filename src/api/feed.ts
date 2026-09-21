import type { ApiPage, ChatPalezApiClient } from './client';

export type FeedView = 'newsfeed' | 'popular' | 'discover' | 'saved' | 'scheduled' | 'memories';

export type FeedPhoto = {
  source: string;
  blur?: boolean | number | string;
};

export type FeedPost = {

  post_id: number | string;
  post_type?: string;
  text?: string;
  time?: string;
  privacy?: string;
  author_id?: number | string;
  author_name?: string;
  author_username?: string;
  author_picture?: string;
  comments?: number;
  shares?: number;
  reaction_like_count?: number;
  reaction_love_count?: number;
  reaction_haha_count?: number;
  reaction_yay_count?: number;
  reaction_wow_count?: number;
  reaction_sad_count?: number;
  reaction_angry_count?: number;
  photos?: FeedPhoto[];
  video?: { source?: string | null; thumbnail?: string | null } | null;
  reel?: { source?: string | null; thumbnail?: string | null } | null;
  link?: { url?: string | null; title?: string; description?: string; host?: string; image?: string | null } | null;
  url?: string;
  i_react?: boolean;
  i_reaction?: string | null;
  comments_disabled?: boolean;
};

export type PostComment = {
  comment_id: number | string;
  text?: string;
  time?: string;
  author_id?: number | string;
  author_name?: string;
  author_picture?: string;
  reactions_total_count?: number;
  replies?: number;
  i_react?: boolean;
  i_reaction?: string | null;
  delete_comment?: boolean;
  edit_comment?: boolean;
};

export type ReelItem = {
  post_id: number | string;
  text?: string;
  time?: string;
  author_id?: number | string;
  author_name?: string;
  author_username?: string;
  author_picture?: string;
  comments?: number;
  shares?: number;
  reaction_like_count?: number;
  source?: string | null;
  thumbnail?: string | null;
  url?: string;
};

export type VideoItem = ReelItem;

export class FeedService {
  constructor(private readonly api: ChatPalezApiClient) {}

  getFeed(view: FeedView = 'newsfeed', offset = 0): Promise<ApiPage<FeedPost[]>> {
    return this.api.getPage<FeedPost[]>('mobile/feed', { view, offset });
  }

  getReels(offset = 0): Promise<ApiPage<ReelItem[]>> {
    return this.api.getPage<ReelItem[]>('mobile/reels', { offset });
  }

  getWatch(offset = 0): Promise<ApiPage<VideoItem[]>> {
    return this.api.getPage<VideoItem[]>('mobile/watch', { offset });
  }

  getPost(postId: number | string): Promise<FeedPost> {
    return this.api.get<FeedPost>('mobile/post', { id: postId });
  }

  getPostComments(postId: number | string, offset = 0): Promise<ApiPage<PostComment[]>> {
    return this.api.getPage<PostComment[]>('mobile/post/comments', { post_id: postId, offset });
  }

  async reactToPost(postId: number | string, reaction = 'like', remove = false): Promise<void> {
    await this.api.post<unknown>('mobile/post/react', { post_id: postId, reaction, remove });
  }

  commentOnPost(postId: number | string, message: string): Promise<PostComment> {
    return this.api.post<PostComment>('mobile/post/comment', { post_id: postId, message });
  }
}
