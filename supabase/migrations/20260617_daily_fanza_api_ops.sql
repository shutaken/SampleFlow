-- =========================================================
-- Sample Flow daily FANZA API operations migration
-- 日次API取得ジョブ / DBカラム追加 / fetchログ強化
-- =========================================================

begin;

alter table public.videos
  add column if not exists last_api_checked_at timestamptz,
  add column if not exists api_missing_count integer not null default 0,
  add column if not exists source_type text not null default 'manual',
  add column if not exists fetched_at timestamptz;

create index if not exists videos_api_check_idx
  on public.videos (last_api_checked_at asc nulls first)
  where provider = 'fanza' and is_active = true;

create index if not exists videos_source_type_idx
  on public.videos (source_type, created_at desc);

alter table public.api_fetch_logs
  add column if not exists job_mode text,
  add column if not exists response_status integer,
  add column if not exists response_ms integer,
  add column if not exists request_count integer not null default 0,
  add column if not exists target_count integer not null default 0,
  add column if not exists missing_count integer not null default 0,
  add column if not exists hidden_count integer not null default 0,
  add column if not exists error_detail jsonb not null default '{}'::jsonb,
  add column if not exists started_by text;

create index if not exists api_fetch_logs_status_started_idx
  on public.api_fetch_logs (status, started_at desc);

create index if not exists api_fetch_logs_mode_started_idx
  on public.api_fetch_logs (job_mode, started_at desc);

commit;
