export type FeedVideo = {
  id: string;
  provider: string;
  provider_content_id: string;
  title: string;
  description: string | null;
  package_image_url: string | null;
  thumbnail_url: string | null;
  list_image_url: string | null;
  sample_movie_url: string | null;
  sample_embed_html: string | null;
  affiliate_url: string;
  release_date: string | null;
  review_average: number | null;
  review_count: number | null;
  maker_name: string | null;
  genres: string[] | null;
  actresses: string[] | null;
  created_at: string;
};

export type AdCard = {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  cta_label: string;
  target_url: string | null;
};

export type RankingVideo = {
  video_id: string;
  title: string;
  affiliate_url: string;
  thumbnail_url: string | null;
  package_image_url: string | null;
  release_date: string | null;
  score: number | null;
  impressions: number | null;
  plays: number | null;
  exits: number | null;
};

export type Database = {
  public: {
    Tables: {
      video_events: {
        Insert: {
          video_id?: string | null;
          session_id: string;
          user_id?: string | null;
          event_type:
            | "impression"
            | "play"
            | "pause"
            | "ended"
            | "skip"
            | "swipe_right"
            | "click_cta"
            | "exit_to_fanza"
            | "detail_open"
            | "ad_impression"
            | "ad_click"
            | "age_gate_accept"
            | "age_gate_reject";
          path?: string | null;
          referrer?: string | null;
          user_agent?: string | null;
          metadata?: Record<string, unknown>;
        };
      };
      videos: { Insert: Record<string, unknown>; Update: Record<string, unknown> };
      genres: { Insert: Record<string, unknown>; Update: Record<string, unknown> };
      actresses: { Insert: Record<string, unknown>; Update: Record<string, unknown> };
      makers: { Insert: Record<string, unknown>; Update: Record<string, unknown> };
      video_genres: { Insert: Record<string, unknown> };
      video_actresses: { Insert: Record<string, unknown> };
      api_fetch_logs: { Insert: Record<string, unknown>; Update: Record<string, unknown> };
    };
    Views: {
      feed_videos: { Row: FeedVideo };
      video_ranking_24h: { Row: RankingVideo };
      video_ranking_7d: { Row: RankingVideo };
      video_ranking_30d: { Row: RankingVideo };
      video_ranking_all: { Row: RankingVideo };
    };
  };
};
