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
