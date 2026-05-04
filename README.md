# Sample Flow MVP

Next.js / Supabase / Vercel MVP for Sample Flow.

## Vercel build note

This project pins Next.js to 15.5.6 instead of using `latest`.
Next.js 16 uses Turbopack for production build by default, and some Vercel deployments may fail with exit code 101 before showing a clear app-level error. Pinning avoids that build-time issue.

## Environment variables

Set these in Vercel Project Settings > Environment Variables.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

CRON_SECRET=
NEXT_PUBLIC_SITE_URL=https://avsample-flow.com

DMM_API_ID=pending
DMM_AFFILIATE_ID=pending
```

## Supabase

Run `supabase/schema.sql` in Supabase SQL Editor.

## Local development

```bash
npm install
npm run dev
```

## Manual fetch

After DMM/FANZA API credentials are issued:

```bash
curl -X POST http://localhost:3000/api/fanza/fetch \
  -H "x-cron-secret: local_test_secret"
```

## Vercel build-safe note

This version avoids Supabase server-side reads during `next build`. Feed and ranking data are loaded on the client after deployment, so Vercel build does not need to connect to Supabase views while compiling.

Next.js is pinned to `15.5.7` and React to `19.0.1` to avoid known RSC security warnings affecting older 15.5.x / React 19.0.0 combinations.
