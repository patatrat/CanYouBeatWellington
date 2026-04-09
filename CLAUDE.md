# CLAUDE.md — Can You Beat Wellington?

Project tracking, backlog, and architectural decisions.

## Project Overview

A hobby webapp that checks if today's weather in Wellington, NZ is good enough that you "can't beat it". Users can vote agree/disagree. Historical data stored in Supabase, visualised on the About page.

- **Live**: https://canyoubeatwellington.radomski.co.nz/
- **Repo**: https://github.com/patatrat/CanYouBeatWellington
- **Stack**: React 18 + Vite 5 + Tailwind CSS + shadcn/ui + Supabase
- **Hosting**: Vercel (custom domain via Cloudflare DNS, grey-cloud/DNS-only)
- **Originally built with**: Lovable (formerly GPT Engineer)

## Weather Assessment Rules

A "good day" requires ALL of:
- Max temperature ≥ 18°C
- Max wind speed < 20 km/h
- Daytime rain = 0 mm

Computed at runtime from `rulesStorage.js` — not stored in DB, so rules can change freely.
Data source: Open-Meteo API (free, no key required).

---

## Infrastructure

| Concern | Solution |
|---------|---------|
| Hosting | Vercel (auto-deploys on push to `main`) |
| Database | Supabase free tier (project: `qumelyuoeutlnnouhguo`) |
| Supabase pause prevention | GitHub Actions cron ping every 5 days |
| CI | GitHub Actions — lint + build + audit on every push/PR |
| Secrets | GitHub repo secrets + Vercel env vars (both use `VITE_` prefix) |
| DNS | Cloudflare (DNS-only, grey cloud) → Vercel |

---

## Backlog

### P2 — Security hardening
- [ ] **Add Supabase RLS policies** — currently anyone with the anon key can INSERT/UPDATE/DELETE records directly. Suggested policies:
  - `SELECT`: allow for all (anon role)
  - `INSERT`: allow for anon (app inserts today's weather record)
  - `UPDATE`: restrict to `agree_count` and `disagree_count` columns only (voting), or block direct UPDATE and use a Postgres function instead
  - `DELETE`: block for anon
- [ ] **Wire up Google Analytics or remove dead code** — `GA_MEASUREMENT_ID` placeholder in `index.html` and `src/utils/analytics.js`; currently does nothing

### P3 — Code quality
- [ ] Remove unused Radix UI components — many shadcn/ui components scaffolded but never used, bloating the 883 kB bundle
- [ ] Upgrade Vite to v8 — fixes 2 remaining moderate dev-server vulns (breaking change, test carefully)
- [ ] Move `esbuild` from `dependencies` to `devDependencies`
- [ ] Add `engines` field to `package.json` to pin Node version (currently using 24)

### P3.5 — Historical data
- [ ] Retrieve pre-2026 weather data — DB currently has only ~92 days. `archive-api.open-meteo.com` is unreachable from Codespace; run `scripts/populate-db.js` locally (after temporarily changing the URL back to archive API) to seed from 2020

### P4 — Feature improvements
- [ ] **Add daily weather cron job** — data only stored when someone visits the homepage. If nobody visits, that day has a gap in history. Add a Vercel Cron or GitHub Actions job to fetch + store weather at midnight NZT daily
- [ ] Make voting tamper-resistant — currently localStorage only, trivially bypassed via API
- [ ] Define and build the Admin page (`/admin` is an empty stub)
- [ ] Set up staging branch in Vercel (create `staging` branch → Vercel dashboard → Settings → Git)

### P5 — Nice to have
- [ ] Add unit/integration tests (currently zero)
- [ ] Set up Dependabot for automated dependency updates
- [ ] Update React Router to 7.x (clears XSS vuln, breaking change)

---

## Decisions Log

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-04-09 | Migrate hosting to Vercel | User familiar with Vercel; enables preview deploys natively |
| 2026-04-09 | Supabase: cron ping to prevent pausing | Free solution; no migration needed |
| 2026-04-09 | Remove CSVGen page | One-off seeding tool with hardcoded API key |
| 2026-04-09 | Remove `is_good_day` from DB | Rules may change seasonally; compute at runtime from `rulesStorage.js` |
| 2026-04-09 | Start DB fresh from 90 days | archive-api unreachable from Codespace; retrieve older data locally later |
| 2026-04-09 | Keep Supabase free tier | Pause solved by cron ping; no need to migrate or upgrade yet |

---

## Architecture Notes

### Data flow
1. Page load → Open-Meteo API → today's weather fetched
2. Today's record upserted to Supabase `daily_weather_records`
3. Historical records fetched from Supabase for About page charts/calendar
4. `is_good_day` computed at runtime using `loadRules()` from `rulesStorage.js`
5. Votes stored in localStorage (client-side only) + incremented in Supabase

### Key files
| File | Purpose |
|------|---------|
| `src/utils/weatherStorage.js` | Open-Meteo fetch + localStorage cache |
| `src/utils/rulesStorage.js` | Weather criteria — source of truth for good-day rules |
| `src/integrations/supabase/client.ts` | Supabase client (reads from `VITE_` env vars) |
| `src/integrations/supabase/types.ts` | DB types (manually maintained — no `is_good_day`) |
| `scripts/populate-db.js` | Standalone Node.js script to seed weather data |
| `vercel.json` | SPA rewrites + cache headers |
| `.github/workflows/ci.yml` | Lint + build + audit gate |
| `.github/workflows/supabase-keepalive.yml` | Prevents Supabase free tier from pausing |
