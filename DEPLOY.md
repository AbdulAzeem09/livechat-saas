# Deploying TalkZen (free tier for testing)

**Stack:** Web → Vercel · API → Render · DB → Supabase (existing).

> All three use "Login with GitHub". Render free web services sleep after ~15 min
> of inactivity and take ~30-60s to wake — fine for testing.

---

## 1. API on Render

1. [render.com](https://render.com) → **New → Blueprint** → pick `livechat-saas`.
   Render reads `render.yaml` and creates the **livechat-api** service.
2. It will ask for the `sync: false` env vars. For the first deploy set:
   - `DATABASE_URL` — copy from your local `.env` (the Supabase URL).
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — copy from `.env`.
   - `APP_URL` = `http://localhost:3000` (temporary — updated in step 3)
   - `API_URL` = leave blank for now (updated in step 3)
   - `API_CORS_ORIGINS` = `*` (temporary — tightened in step 3)
   - `SOCKET_IO_CORS_ORIGIN` = `*`
   - Optional keys (`ANTHROPIC_API_KEY`, `AUTHORIZENET_*`, `GOOGLE_*`) — paste from `.env` if you use them.
3. Deploy. When it's live you get a URL like `https://livechat-api.onrender.com`.
   Test it: open `https://livechat-api.onrender.com/api/v1/health` → should say ok.

## 2. Web on Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import `livechat-saas`.
2. **Root Directory:** `apps/web` · Framework: **Next.js** (auto-detected).
3. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL` = `https://livechat-api.onrender.com/api/v1`
     (your Render URL from step 1 + `/api/v1`)
4. Deploy. You get a URL like `https://livechat-saas.vercel.app`.

## 3. Point the API back at the web URL (CORS + cookies)

In the Render dashboard → livechat-api → Environment, update:
- `APP_URL` = `https://livechat-saas.vercel.app`
- `API_URL` = `https://livechat-api.onrender.com`
- `API_CORS_ORIGINS` = `https://livechat-saas.vercel.app`
- `SOCKET_IO_CORS_ORIGIN` = `https://livechat-saas.vercel.app`
- `GOOGLE_CALLBACK_URL` = `https://livechat-api.onrender.com/api/v1/auth/google/callback` (if using Google)

Save → Render redeploys. Done — open your Vercel URL and log in.

---

## Notes
- **HTTPS** is automatic on both → billing card entry (Accept.js) and the widget on
  real sites will work.
- **File uploads**: Render's disk is wiped on every restart/deploy, so the blueprint sets
  `FILE_STORAGE_DRIVER=supabase`. In Supabase → Storage create a **private** bucket named
  `attachments`, then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Project Settings →
  API) on Render. The API refuses to start if the driver is `supabase` without them.
- **Database URL**: if `DATABASE_URL` uses Supabase's transaction pooler (port 6543) the API adds
  `pgbouncer=true&connection_limit=5` automatically. Run migrations against the **direct**
  connection (port 5432): `DATABASE_URL=<direct url> pnpm db:deploy`.
- **Secrets**: in production the API refuses to start with the dev JWT secrets or with the same
  value for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. `SUPER_ADMIN_EMAILS` has no default.
- **Billing webhook**: in Authorize.net → Account → Webhooks add
  `https://livechat-api.onrender.com/api/v1/billing/webhooks/authorizenet` (subscription events) and
  set `AUTHORIZENET_SIGNATURE_KEY` on Render. Without a gateway configured, production refuses
  to activate plans or add-ons (mock billing is development-only).
- **Supabase free** pauses after ~1 week idle — upgrade to Pro when going live for real.
- Update the widget install snippet's `src` to your Render API URL when embedding on a
  real website.
