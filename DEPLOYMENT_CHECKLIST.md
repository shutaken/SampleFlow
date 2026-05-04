# Production Deployment Checklist

## 1. Supabase

- [ ] Create Supabase project.
- [ ] Run `supabase/schema.sql` in SQL Editor.
- [ ] Copy Project URL, anon public key, and service_role key.

## 2. Vercel environment variables

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `CRON_SECRET`
- [ ] `NEXT_PUBLIC_SITE_URL=https://avsample-flow.com`
- [ ] `DMM_API_ID=pending` until issued
- [ ] `DMM_AFFILIATE_ID=pending` until issued

## 3. Vercel build settings

- [ ] Framework Preset: Next.js
- [ ] Build Command: `npm run build`
- [ ] Install Command: default
- [ ] Node.js: 22.x or 20.9+
- [ ] Redeploy without build cache after package changes.

## 4. Domain

- [ ] Add `avsample-flow.com` in Vercel > Settings > Domains.
- [ ] Configure DNS as instructed by Vercel.
- [ ] Confirm domain status is Valid.

## 5. After first successful deployment

- [ ] Access `/` and confirm age gate appears.
- [ ] Access `/feed` and confirm empty-state appears if API data has not been fetched yet.
- [ ] Access `/ranking` and confirm it renders.
- [ ] Trigger `/api/events` indirectly by accepting age gate.

## 6. After DMM/FANZA credentials are issued

- [ ] Replace `DMM_API_ID` and `DMM_AFFILIATE_ID` in Vercel.
- [ ] Manually call `/api/fanza/fetch` with `x-cron-secret`.
- [ ] Confirm rows are inserted into `videos`, `genres`, and relation tables.
- [ ] Enable the GitHub Actions schedule if desired.
