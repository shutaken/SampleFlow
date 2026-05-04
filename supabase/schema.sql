-- Sample Flow MVP schema
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.genres (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'fanza',
  provider_genre_id text,
  name text not null,
  slug text not null unique,
  is_mvp boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_genres_updated_at before update on public.genres for each row execute function public.set_updated_at();

create table if not exists public.actresses (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'fanza',
  provider_actress_id text,
  name text not null,
  name_kana text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint actresses_provider_provider_actress_id_unique unique (provider, provider_actress_id),
  constraint actresses_provider_name_unique unique (provider, name)
);
create trigger set_actresses_updated_at before update on public.actresses for each row execute function public.set_updated_at();

create table if not exists public.makers (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'fanza',
  provider_maker_id text,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint makers_provider_provider_maker_id_unique unique (provider, provider_maker_id),
  constraint makers_provider_name_unique unique (provider, name)
);
create trigger set_makers_updated_at before update on public.makers for each row execute function public.set_updated_at();

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'fanza',
  provider_content_id text not null,
  product_id text,
  content_id text,
  floor text not null default 'videoa',
  title text not null,
  title_kana text,
  description text,
  maker_id uuid references public.makers(id) on delete set null,
  package_image_url text,
  thumbnail_url text,
  list_image_url text,
  sample_movie_url text,
  sample_embed_html text,
  has_sample boolean not null default false,
  affiliate_url text not null,
  product_url text,
  release_date date,
  volume text,
  review_average numeric(3,2),
  review_count integer not null default 0,
  search_text text generated always as (coalesce(title, '') || ' ' || coalesce(title_kana, '') || ' ' || coalesce(description, '')) stored,
  raw_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  is_hidden boolean not null default false,
  compliance_checked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint videos_provider_content_unique unique (provider, provider_content_id),
  constraint videos_has_sample_check check (has_sample = false or sample_movie_url is not null or sample_embed_html is not null)
);
create trigger set_videos_updated_at before update on public.videos for each row execute function public.set_updated_at();
create index if not exists videos_new_arrivals_idx on public.videos (release_date desc nulls last, created_at desc) where is_active = true and is_hidden = false and has_sample = true;
create index if not exists videos_provider_content_idx on public.videos (provider, provider_content_id);
create index if not exists videos_search_text_idx on public.videos using gin (to_tsvector('simple', search_text));

create table if not exists public.video_genres (
  video_id uuid not null references public.videos(id) on delete cascade,
  genre_id uuid not null references public.genres(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, genre_id)
);
create index if not exists video_genres_genre_id_idx on public.video_genres (genre_id);

create table if not exists public.video_actresses (
  video_id uuid not null references public.videos(id) on delete cascade,
  actress_id uuid not null references public.actresses(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (video_id, actress_id)
);
create index if not exists video_actresses_actress_id_idx on public.video_actresses (actress_id);

create table if not exists public.video_events (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references public.videos(id) on delete cascade,
  session_id text not null,
  user_id uuid,
  event_type text not null,
  path text,
  referrer text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint video_events_event_type_check check (event_type in ('impression','play','pause','ended','skip','swipe_right','click_cta','exit_to_fanza','detail_open','ad_impression','ad_click','age_gate_accept','age_gate_reject'))
);
create index if not exists video_events_video_created_idx on public.video_events (video_id, created_at desc);
create index if not exists video_events_type_created_idx on public.video_events (event_type, created_at desc);
create index if not exists video_events_session_idx on public.video_events (session_id);

create table if not exists public.ad_cards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  image_url text,
  cta_label text not null default '詳しく見る',
  target_url text,
  placement text not null default 'feed_every_7',
  priority integer not null default 100,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger set_ad_cards_updated_at before update on public.ad_cards for each row execute function public.set_updated_at();
create index if not exists ad_cards_active_idx on public.ad_cards (is_active, priority, created_at desc);

create table if not exists public.api_fetch_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'fanza',
  job_name text not null,
  request_url text,
  request_params jsonb not null default '{}'::jsonb,
  status text not null,
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists api_fetch_logs_job_started_idx on public.api_fetch_logs (job_name, started_at desc);

create table if not exists public.ranking_snapshots (
  id uuid primary key default gen_random_uuid(),
  period text not null,
  video_id uuid not null references public.videos(id) on delete cascade,
  score numeric not null default 0,
  impressions integer not null default 0,
  plays integer not null default 0,
  exits integer not null default 0,
  swipes integer not null default 0,
  cta_clicks integer not null default 0,
  rank integer not null,
  calculated_at timestamptz not null default now(),
  constraint ranking_snapshots_period_check check (period in ('24h', '7d', '30d', 'all')),
  constraint ranking_snapshots_period_video_calculated_unique unique (period, video_id, calculated_at)
);
create index if not exists ranking_snapshots_period_rank_idx on public.ranking_snapshots (period, rank, calculated_at desc);

create or replace view public.video_ranking_base as
select v.id as video_id, v.title, v.affiliate_url, v.thumbnail_url, v.package_image_url, v.release_date, e.created_at, e.event_type,
case e.event_type when 'exit_to_fanza' then 5 when 'swipe_right' then 4 when 'click_cta' then 3 when 'ended' then 2 when 'play' then 1 when 'skip' then -1 else 0 end as event_score
from public.videos v
left join public.video_events e on e.video_id = v.id
where v.is_active = true and v.is_hidden = false and v.has_sample = true;

create or replace view public.video_ranking_24h as
select video_id, title, affiliate_url, thumbnail_url, package_image_url, release_date, sum(event_score) as score,
count(*) filter (where event_type = 'impression') as impressions, count(*) filter (where event_type = 'play') as plays, count(*) filter (where event_type in ('exit_to_fanza','swipe_right','click_cta')) as exits
from public.video_ranking_base where created_at >= now() - interval '24 hours'
group by video_id, title, affiliate_url, thumbnail_url, package_image_url, release_date
order by score desc nulls last, exits desc, release_date desc nulls last;

create or replace view public.video_ranking_7d as
select video_id, title, affiliate_url, thumbnail_url, package_image_url, release_date, sum(event_score) as score,
count(*) filter (where event_type = 'impression') as impressions, count(*) filter (where event_type = 'play') as plays, count(*) filter (where event_type in ('exit_to_fanza','swipe_right','click_cta')) as exits
from public.video_ranking_base where created_at >= now() - interval '7 days'
group by video_id, title, affiliate_url, thumbnail_url, package_image_url, release_date
order by score desc nulls last, exits desc, release_date desc nulls last;

create or replace view public.video_ranking_30d as
select video_id, title, affiliate_url, thumbnail_url, package_image_url, release_date, sum(event_score) as score,
count(*) filter (where event_type = 'impression') as impressions, count(*) filter (where event_type = 'play') as plays, count(*) filter (where event_type in ('exit_to_fanza','swipe_right','click_cta')) as exits
from public.video_ranking_base where created_at >= now() - interval '30 days'
group by video_id, title, affiliate_url, thumbnail_url, package_image_url, release_date
order by score desc nulls last, exits desc, release_date desc nulls last;

create or replace view public.video_ranking_all as
select video_id, title, affiliate_url, thumbnail_url, package_image_url, release_date, sum(event_score) as score,
count(*) filter (where event_type = 'impression') as impressions, count(*) filter (where event_type = 'play') as plays, count(*) filter (where event_type in ('exit_to_fanza','swipe_right','click_cta')) as exits
from public.video_ranking_base
group by video_id, title, affiliate_url, thumbnail_url, package_image_url, release_date
order by score desc nulls last, exits desc, release_date desc nulls last;

create or replace view public.feed_videos as
select v.id, v.provider, v.provider_content_id, v.title, v.description, v.package_image_url, v.thumbnail_url, v.list_image_url, v.sample_movie_url, v.sample_embed_html, v.affiliate_url, v.release_date, v.review_average, v.review_count, m.name as maker_name,
array_remove(array_agg(distinct g.name), null) as genres,
array_remove(array_agg(distinct a.name), null) as actresses,
v.created_at
from public.videos v
left join public.makers m on m.id = v.maker_id
left join public.video_genres vg on vg.video_id = v.id
left join public.genres g on g.id = vg.genre_id
left join public.video_actresses va on va.video_id = v.id
left join public.actresses a on a.id = va.actress_id
where v.is_active = true and v.is_hidden = false and v.has_sample = true
group by v.id, m.name;

insert into public.genres (provider, provider_genre_id, name, slug, is_mvp, is_active)
values ('fanza', null, '巨乳', 'big-bust', true, true)
on conflict (slug) do update set name = excluded.name, is_mvp = true, is_active = true, updated_at = now();

insert into public.ad_cards (title, body, cta_label, target_url, placement, priority, is_active)
values ('PR', 'Sample Flowはアフィリエイト広告を利用しています。おすすめ作品は公式商品ページで確認できます。', '公式ページへ', null, 'feed_every_7', 100, true)
on conflict do nothing;

alter table public.genres enable row level security;
alter table public.actresses enable row level security;
alter table public.makers enable row level security;
alter table public.videos enable row level security;
alter table public.video_genres enable row level security;
alter table public.video_actresses enable row level security;
alter table public.video_events enable row level security;
alter table public.ad_cards enable row level security;
alter table public.api_fetch_logs enable row level security;
alter table public.ranking_snapshots enable row level security;

drop policy if exists "Public read active genres" on public.genres;
create policy "Public read active genres" on public.genres for select to anon, authenticated using (is_active = true);
drop policy if exists "Public read active actresses" on public.actresses;
create policy "Public read active actresses" on public.actresses for select to anon, authenticated using (is_active = true);
drop policy if exists "Public read active makers" on public.makers;
create policy "Public read active makers" on public.makers for select to anon, authenticated using (is_active = true);
drop policy if exists "Public read active videos" on public.videos;
create policy "Public read active videos" on public.videos for select to anon, authenticated using (is_active = true and is_hidden = false and has_sample = true);
drop policy if exists "Public read video genres" on public.video_genres;
create policy "Public read video genres" on public.video_genres for select to anon, authenticated using (true);
drop policy if exists "Public read video actresses" on public.video_actresses;
create policy "Public read video actresses" on public.video_actresses for select to anon, authenticated using (true);
drop policy if exists "Public read active ad cards" on public.ad_cards;
create policy "Public read active ad cards" on public.ad_cards for select to anon, authenticated using (is_active = true and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()));
