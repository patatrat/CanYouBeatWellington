# CLAUDE.md — Can You Beat Wellington?

Project tracking, backlog, and architectural decisions for the Claude Code session.

## Project Overview

A fun hobby webapp that checks if today's weather in Wellington, NZ is good enough that you "can't beat it". Users can vote agree/disagree with the automated assessment. Historical data is stored in Supabase and visualised on the About page.

- **Live**: https://canyoubeatwellington.radomski.co.nz/
- **Repo**: https://github.com/patatrat/CanYouBeatWellington
- **Stack**: React 18 + Vite 5 + Tailwind CSS + shadcn/ui + Supabase
- **Originally built with**: Lovable (formerly GPT Engineer)
- **Current deployment**: Netlify (inferred from `_redirects` file — no explicit config file)

## Weather Assessment Rules

A "good day" requires ALL of:
- Max temperature ≥ 18°C
- Max wind speed < 20 km/h
- Daytime rain = 0 mm

Data source: Open-Meteo API (free, no key required).

---

## Security Issues

### CRITICAL (fix immediately)
- [ ] **Hardcoded Visual Crossing API key** in `src/components/CSVGenerator.jsx:69`
  - Key `J24W9XFX9EY24DRFP6VCYNSWW` is publicly visible in the browser
  - This page was used to seed historical data — it has served its purpose
  - **Decision**: Either move key to a server-side function (Vercel Edge Function) or remove the CSVGen page entirely since historical data is already loaded
  - The `/csv-gen` route exists in `App.jsx` and `nav-items.jsx`

### HIGH
- [ ] **15 npm audit vulnerabilities** (9 high, 6 moderate) — fixable with `npm audit fix`
  - minimatch ReDoS (the email warning) — via sucrase/dev toolchain
  - picomatch ReDoS — via dev toolchain
  - rollup path traversal — via Vite
  - react-router-dom XSS via open redirects
  - flatted prototype pollution
  - `npm audit fix` should resolve all without breaking changes

### MEDIUM
- [ ] **No Row Level Security (RLS)** on Supabase `daily_weather_records` table
  - Anyone can POST/PATCH records directly via the exposed anon key
  - Voting counts (`agree_count`, `disagree_count`) are trivially manipulated
  - **Suggested RLS**: Allow SELECT for all; only allow UPDATE on vote columns via a Postgres function (not direct UPDATE); block INSERT/DELETE for anon role
- [ ] **Voting not rate-limited** — uses localStorage only, trivially bypassed
  - Could add Supabase Edge Function with IP-based rate limiting if this matters

### LOW
- [ ] Google Analytics `GA_MEASUREMENT_ID` is a placeholder — analytics not wired up
- [ ] Supabase URL and anon key in source (acceptable for publishable key but document it)
- [ ] No `.env.example` to document required environment variables

---

## Supabase Issues

### Problem: Database keeps pausing
Supabase free tier pauses databases after 1 week of inactivity. This is the root cause of the "shutting down" issue.

### Options (in preference order)
1. **Upgrade Supabase to Pro** ($25/month) — removes pause behaviour, simplest fix
2. **Migrate to Vercel Postgres** (powered by Neon) — aligns with Vercel hosting, serverless-friendly, free tier doesn't pause, but requires a backend API layer (can't use Supabase client directly)
3. **Migrate to Neon directly** — same as above, more control
4. **Keep Supabase free + add a cron ping** — hacky but free (e.g., GitHub Actions workflow that hits the DB every 5 days)

### Decision pending: Hosting + DB consolidation
If moving to **Vercel** for hosting:
- Use **Vercel Postgres** (Neon) for the database
- Use **Vercel Edge Functions** for any server-side logic (API key protection, rate limiting)
- This eliminates both the Supabase pause problem and Netlify (consolidate to one provider)

Current Supabase project ID: `xifhvoqdrmsunijcrakv`

---

## CI/CD — Current State: Nothing

No `.github/workflows/`, no vercel.json, no netlify.toml. Deployment is presumably manual or via Lovable's publish button.

### Proposed CI/CD Pipeline (GitHub Actions + Vercel)

#### Branch strategy
```
main         → production  (canyoubeatwellington.radomski.co.nz)
staging      → staging     (staging.canyoubeatwellington.radomski.co.nz)
feature/*    → preview     (auto-generated preview URL per PR)
```

#### Workflow: `ci.yml` (on every push/PR)
- Lint (ESLint)
- Build check (`vite build`)
- `npm audit --audit-level=high` (fail on high+ vulns)

#### Workflow: `deploy-preview.yml` (on PR open/update)
- Build and deploy to Vercel preview URL
- Comment preview URL on PR

#### Workflow: `deploy-staging.yml` (on merge to `staging`)
- Deploy to staging environment

#### Workflow: `deploy-production.yml` (on merge to `main`)
- Deploy to production

#### Environment variables needed per environment
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GA_MEASUREMENT_ID`
- (If keeping CSVGen) `VISUAL_CROSSING_API_KEY` — server-side only

---

## Backlog

### P0 — Security (do first)
- [x] Run `npm audit fix` — fixed 13 of 15 vulnerabilities including minimatch ReDoS (2026-04-09)
- [x] Remove `lovable-tagger` — not needed outside Lovable IDE, eliminated 1 more vulnerability (2026-04-09)
- [ ] **Remaining**: 2 moderate vulns (esbuild/vite dev server only — not a production risk). Fix requires Vite 8 upgrade (breaking change) — defer to P3
- [x] Removed CSVGen page and CSVGenerator component — eliminated hardcoded Visual Crossing API key (2026-04-09)

### P1 — Infrastructure
- [x] Decided: Move to Vercel (2026-04-09)
- [x] Decided: Fix Supabase pause with GitHub Actions cron ping every 5 days (2026-04-09)
- [x] Created `vercel.json` with SPA rewrites and cache headers (2026-04-09)
- [x] Created `.github/workflows/ci.yml` — lint + build + audit on push/PR (2026-04-09)
- [x] Created `.github/workflows/supabase-keepalive.yml` — pings DB every 5 days (2026-04-09)
- [x] Moved Supabase credentials to env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) (2026-04-09)
- [x] Created `.env.example` (2026-04-09)
- [ ] **ACTION REQUIRED (manual)**: Import repo into Vercel dashboard
- [ ] **ACTION REQUIRED (manual)**: Add GitHub repo secrets (see below)
- [ ] **ACTION REQUIRED (manual)**: Add Vercel environment variables (see below)
- [ ] **ACTION REQUIRED (manual)**: Create `staging` branch + configure in Vercel dashboard

### P2 — Security hardening
- [ ] Add Supabase RLS policies to `daily_weather_records`
- [x] Moved Supabase credentials to environment variables (2026-04-09)
- [x] Created `.env.example` (2026-04-09)
- [ ] Wire up Google Analytics (or remove the dead code)

### P3 — Code quality
- [x] Removed `CSVGen` page and `CSVGenerator` component (2026-04-09)
- [ ] Remove unused Radix UI components (many are scaffolded but unused — bloats bundle)
- [x] Removed `lovable-tagger` entirely (2026-04-09)
- [ ] Upgrade Vite to v8 to fix remaining 2 moderate dev-server vulns (breaking change — test thoroughly)
- [ ] Audit `esbuild` in dependencies vs devDependencies (shouldn't be a runtime dep)
- [ ] Add a `engines` field to package.json to pin Node version

### P4 — Feature improvements
- [ ] Make voting tamper-resistant (server-side vote tracking, not just localStorage)
- [ ] Auto-populate today's weather record in Supabase (currently unclear if it happens automatically)
- [ ] Add a scheduled job (Vercel Cron / GitHub Actions) to fetch and store daily weather at midnight NZT
- [ ] Wire up Google Analytics
- [ ] Admin page (`/admin`) is currently empty — define what it should do

### P3.5 — Historical data
- [ ] Retrieve pre-2026 historical weather data (archive-api.open-meteo.com not reachable from Codespace — needs to run locally or via a different approach)

### P5 — Nice to have
- [ ] Add unit/integration tests (currently zero)
- [ ] Update React Router to 7.x (breaking change but clears XSS vuln)
- [ ] Set up Dependabot for automated dep updates

---

## Setup Checklist — Manual Steps After Merge

### GitHub Repository Secrets
Add at: GitHub repo → Settings → Secrets and variables → Actions

| Secret | Value |
|--------|-------|
| `VITE_SUPABASE_URL` | `https://xifhvoqdrmsunijcrakv.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | (anon JWT — get from Supabase dashboard → Settings → API) |
| `SUPABASE_URL` | `https://xifhvoqdrmsunijcrakv.supabase.co` |
| `SUPABASE_ANON_KEY` | (same anon JWT as above) |

### Vercel Environment Variables
Add at: Vercel project → Settings → Environment Variables (set for Production + Preview + Development)

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://xifhvoqdrmsunijcrakv.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | (anon JWT) |
| `VITE_GA_MEASUREMENT_ID` | Your GA4 measurement ID (e.g. `G-XXXXXXXXXX`) |

### Vercel Project Setup
1. Go to vercel.com → Add New → Project → Import `patatrat/CanYouBeatWellington`
2. Framework preset: **Vite** (auto-detected)
3. Add environment variables (above)
4. Deploy → production goes live at your custom domain
5. Go to Settings → Git → add `staging` as a branch to deploy (gets a fixed preview URL)
6. PRs automatically get preview URLs — no config needed

---

## Decisions Log

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-04-09 | Created CLAUDE.md | Starting review session with Claude Code |
| 2026-04-09 | Migrate hosting to Vercel | User familiar with Vercel; enables preview/staging deploys natively |
| 2026-04-09 | Supabase: cron ping to prevent pausing | Free solution; no code/migration needed; GitHub Actions pings every 5 days |
| 2026-04-09 | Removed CSVGen page | One-off data seeding tool; data already in Supabase; had hardcoded API key |

---

## Architecture Notes

### Data flow
1. On page load → Open-Meteo API (free, no key) → check today's weather
2. Today's data saved to `localStorage` (for offline/cache) and to Supabase
3. Historical data fetched from Supabase for About page charts/calendar
4. User votes stored in `localStorage` to prevent double-voting (client-side only)

### Known quirks from Lovable generation
- Many shadcn/ui components installed but unused (bloating bundle)
- `lovable-tagger` is in `dependencies` instead of `devDependencies`
- `esbuild` is in `dependencies` instead of `devDependencies`
- No test framework set up
- No `.nvmrc` or `engines` field
- `Admin` page is a stub

### Files to know about
| File | Purpose |
|------|---------|
| `src/utils/weatherStorage.js` | Open-Meteo fetch + localStorage |
| `src/utils/rulesStorage.js` | Weather criteria (minTemp, maxWind, maxRain) |
| `src/integrations/supabase/client.ts` | Supabase client (credentials in source) |
| `src/integrations/supabase/types.ts` | Auto-generated DB types |
| `src/components/CSVGenerator.jsx` | One-off data seeding tool (has hardcoded API key) |
| `public/_redirects` | Netlify SPA routing config |
