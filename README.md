# Sample Flow

Sample Flow is a Next.js / Supabase / Vercel MVP for a one-handed vertical sample-video discovery feed.

## Production deployment status

This repository is organized for Vercel production deployment.

- Next.js is pinned to `16.0.10`.
- Production build uses Webpack via `next build --webpack` to avoid the Turbopack build crash seen in earlier Vercel logs.
- Runtime data loading for feed/ranking is client-side, so `next build` does not need to read Supabase tables/views.
- `middleware.ts` and `vercel.json` are intentionally omitted.
- No real secrets are committed.

## Required Vercel environment variables

Set these in Vercel > Project > Settings > Environment Variables.

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxx

CRON_SECRET=your_long_random_secret
NEXT_PUBLIC_SITE_URL=https://avsample-flow.com

DMM_API_ID=pending
DMM_AFFILIATE_ID=pending
```

After DMM/FANZA credentials are issued, replace `pending` with the real values in Vercel only.

## Supabase setup

1. Open Supabase SQL Editor.
2. Run `supabase/schema.sql`.
3. Confirm the seed genre `巨乳` exists in `genres`.

## Local development

```bash
npm install
npm run dev
```

## Production build check

```bash
npm run build
```

The build command is:

```bash
next build --webpack
```

## Manual FANZA fetch

After API credentials are issued:

```bash
curl -X POST "https://avsample-flow.com/api/fanza/fetch" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

## GitHub Actions cron

The scheduled fetch job is in `.github/workflows/fetch-fanza.yml`.
Set these GitHub repository secrets before enabling regular fetches:

```text
SITE_URL=https://avsample-flow.com
CRON_SECRET=your_long_random_secret
```

## Compliance notes

- This app is for adults only and includes an age gate.
- It displays PR/affiliate labels.
- It does not store, edit, splice, or redistribute sample video files.
- It stores official metadata/URLs and uses UI controls only.
- DMM/FANZA API credentials and Supabase service-role keys must only exist in server-side environment variables.
