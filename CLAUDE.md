# CLAUDE.md — Can You Beat Wellington?

Project tracking, backlog, and architectural decisions.

## Project Overview

A hobby webapp that checks if today's weather in Wellington, NZ is good enough that you "can't beat it". Users can vote agree/disagree. Historical data stored in Supabase, visualised on the About page.

- **Live**: https://canyoubeatwellington.radomski.co.nz/
- **Repo**: https://github.com/patatrat/CanYouBeatWellington
- **Stack**: React 18 + Vite 8 + React Router 7 + Tailwind CSS + shadcn/ui + Supabase
- **Analytics**: Vercel Analytics
- **Hosting**: Vercel (auto-deploys on push to `main`)
- **Originally built with**: Lovable (formerly GPT Engineer) — legacy files removed

## Weather Assessment Rules

A "good day" requires ALL of (thresholds vary by season — see `rulesStorage.js`):
- Max temperature ≥ seasonal minimum (13°C winter → 19°C summer)
- Max wind speed < 30 km/h (year-round)
- Daytime rain = 0 mm (year-round)

Six seasons: Summer (Jan–Mar), Autumn (Apr–Jun), Winter (Jul–Aug), Spring 1 (Sep), Shitsville (Oct–Nov), Spring 2 (Dec).
Computed at runtime from `rulesStorage.js` — not stored in DB, so rules can change freely.
Data source: Open-Meteo API (free, no key required).

---

## Infrastructure

| Concern | Solution |
|---------|---------|
| Hosting | Vercel (auto-deploys on push to `main`) |
| Database | Supabase free tier (project: `qumelyuoeutlnnouhguo`) |
| Supabase pause prevention | GitHub Actions cron ping every 5 days |
| Daily weather | GitHub Actions cron at 12:00 UTC daily (`daily-weather.yml`) |
| CI | GitHub Actions — lint + test + build + audit on every push/PR |
| Secrets | GitHub repo secrets + Vercel env vars (both use `VITE_` prefix) |
| DNS | Cloudflare (DNS-only, grey cloud) → Vercel |

---

## Backlog

### P2 — Security hardening
- [x] **Add Supabase RLS policies** — SELECT/INSERT for anon; direct UPDATE blocked; votes go via `increment_vote` SECURITY DEFINER function
- [x] **Remove dead Google Analytics code** — replaced with Vercel Analytics
- [x] **Security headers** — CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy added to `vercel.json`
- [x] **Remove Lovable/GPT Engineer legacy files** — deleted `gpt-engineer.toml` and `.gpt_engineer/` directory; revoked GitHub access

### P2 — Bug fixes (from code review, April 2026)
- [ ] **Fix React Query invalidation in VotingButtons** — `queryClient.invalidateQueries(['todaysRecord'])` uses the v4 API; v5 requires `invalidateQueries({ queryKey: ['todaysRecord'] })`. Currently vote counts don't update in-page after voting — user has to refresh. Fix: `VotingButtons.jsx:54`.
- [ ] **Fix `mutation` in useEffect dependency array (Index.jsx)** — `mutation` object is recreated each render, so the effect fires repeatedly. Either wrap `storeDailyRecord` in `useCallback` or drop `mutation` from the dep array and accept the lint warning with a comment.
- [ ] **Validate API response shape before using (weatherStorage.js)** — if Open-Meteo returns 200 with missing fields (e.g. `temperature_2m_max[0]` is undefined), the app silently stores `undefined` in Supabase. Add a guard that throws if required fields are absent.

### P3 — Code quality
- [x] Remove unused Radix UI/shadcn components — deleted 43 unused ui files; removed 25 Radix packages + other dead deps; CSS bundle 45 kB → 19 kB
- [x] Move `esbuild` to `devDependencies`
- [x] Add `engines: { node: ">=24" }` to `package.json`
- [x] Fix all ESLint errors blocking CI
- [x] SEO improvements — target phrases in title/meta/structured data, H1 restructure, sitemap
- [x] Upgrade Vite to v8 + plugin-react to v6 — cleared 2 moderate esbuild dev-server vulns; fixed port type (string → number)
- [x] Delete dead one-off migration scripts from `src/utils/` — `populateHistoricalData.js`, `recheckHistoricalData.js`, `sunshineUpdateCheck.js`, `removeSunninessRule.js` were all unreferenced leftovers from earlier DB schema work
- [ ] **Deduplicate `calculateSunniness` across scripts** — the function is copy-pasted in `src/utils/weatherStorage.js`, `scripts/populate-db.js`, and `scripts/backfill-historical.js`. A change to the WMO code mapping must be made in three places. Extract to a shared `scripts/utils.js` and import it in both scripts (can't import from `src/` in Node scripts directly without a build step).
- [ ] **Remove dead scripts** — `scripts/populate-historical-data.js` and `scripts/recheck-historical-data.js` import from `src/utils/` files that no longer exist. They can't run. Delete them.
- [ ] **ESLint v9 flat config migration** — currently pinned to v8 to avoid breaking `.eslintrc.cjs`. Dependabot is ignoring ESLint major bumps. Should migrate to `eslint.config.js` flat config when convenient so Dependabot can keep ESLint current.
- [ ] **Add tests for weatherStorage error paths** — no test coverage for: network failure in `fetchAndStoreWeather`, malformed API response, localStorage quota exceeded. Add to `weatherStorage.test.js`.

### P3 — Infrastructure
- [ ] **Migrate database from Supabase to Neon** — Supabase free tier pauses after 7 days inactivity; the keepalive cron is a workaround. Neon's free tier doesn't auto-pause, has a more generous compute allowance, and is a better long-term fit for a low-traffic hobby project. Migration involves:
  1. Export schema + data from Supabase (`pg_dump` or Supabase dashboard export)
  2. Create Neon project, import dump
  3. Re-implement `increment_vote` as a Postgres function in Neon (same SQL, different dashboard)
  4. Set up equivalent row-level security or keep votes behind the RPC function
  5. Update `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` → Neon connection string + swap client library (`@supabase/supabase-js` → `@neondatabase/serverless` or `postgres.js`)
  6. Update `vercel.json` CSP `connect-src` to Neon endpoint
  7. Delete `supabase-keepalive.yml` workflow and Supabase cron ping
  8. Update `src/integrations/` folder (rename from `supabase/` → `db/` or similar)
  - **Note**: Neon doesn't have a built-in PostgREST REST API like Supabase — queries go via the Neon serverless driver or a connection pool. The voting RPC and data queries will need to move to a small API layer (Vercel Edge Functions or API routes) or use the Neon HTTP API directly. This adds meaningful scope; assess before starting.

### P3.5 — Historical data
- [x] Retrieve pre-2026 weather data — `scripts/backfill-historical.js` uses archive API; triggered via GitHub Actions "Backfill Historical Weather" workflow (2020-01-01 → 2025-12-31). Uses daily `precipitation_sum` (full day, slightly more conservative than daytime-only).

### P4 — Feature improvements
- [x] **Daily weather cron job** — GitHub Actions runs `scripts/populate-db.js` at 12:00 UTC (midnight NZST) daily; upserts idempotently so also backfills any missed days
- [x] Make voting tamper-resistant — `vote_tokens (token, date)` table enforces one vote per browser identity per day at DB level; `increment_vote()` updated to accept `voter_token` arg; unique constraint violation (23505) rejects duplicate votes server-side. Run `scripts/vote-tokens-migration.sql` in Supabase dashboard to activate.
- [x] Adjust good-day rules to account for seasons — six-season Shitsville calendar with seasonal temp thresholds; `rulesStorage.js` is source of truth
- [x] Staging environment — `staging` branch auto-deploys to Vercel preview URL (`canyoubeatwellington-git-staging-patatrat.vercel.app`); shares production Supabase DB
- [x] **Scenario-based verdict quips** — `src/utils/quips.js`; 8 failure-scenario arrays (GOOD / WIND_ONLY / RAIN_ONLY / TEMP_ONLY / WIND_RAIN / WIND_TEMP / RAIN_TEMP / ALL_BAD) replacing the previous 3-bucket system; quips need fleshing out with more NZ flavour
- [x] **7-day good day forecast** — Open-Meteo already returns 7 days; `weatherStorage.js` now exposes `forecast[]` (days 1–6); `ForecastStrip` component on home page shows each day's verdict (✓/✗) + temp + forecast summary quip; `calculateDaytimeRain` accepts a `dayIndex` for multi-day rain calculation
- [ ] **NZ-specific vocabulary** — build a word bank ("munted", "choice", "sweet as", "mean as", "stoked", "gutted", "staunch") to weave into quips in `quips.js`
- [ ] **Special date messages** — Wellington Anniversary Day (4th Monday Jan), Waitangi Day (Feb 6), ANZAC Day (Apr 25), Matariki, Wellington Sevens etc.; overlay a date-specific quip on the normal verdict
- [ ] **Auto-post to social media on good days** — extend existing GitHub Actions daily cron; Mastodon REST API (simple); Bluesky atproto (slightly more involved); secrets in GitHub repo secrets; only post when `isGood === true`
- [ ] **User sharing** — pre-composed share links (Bluesky intent URL, Mastodon share URL); no API keys needed; low-effort "Share" button that opens a pre-filled compose window

### P5 — Nice to have
- [x] Add unit/integration tests — Vitest + jsdom; 68 tests across `rulesStorage` (good-day logic + boundaries) and `weatherStorage` (sunniness, daytime rain, localStorage round-trip); wired into CI
- [x] Set up Dependabot — weekly Monday updates targeting `staging`; ESLint major bumps ignored (v9 requires flat config migration)
- [x] Update React Router to 7.x — cleared XSS vuln; API unchanged for our usage (`BrowserRouter`, `Routes`, `Route`, `Link`)
- [ ] **Timezone-aware date handling** — dates are stored as `YYYY-MM-DD` strings and parsed with `new Date(dateString)`, which treats them as UTC midnight and can shift ±1 day in NZ timezone (UTC+12/+13). Use `date-fns/parseISO` everywhere dates are parsed from strings, and validate the calendar display in CalendarHistory against the actual NZ date.

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
| 2026-04-09 | Staging: use Vercel auto-generated URL, not custom domain | Custom domains require a production deployment; preview URL is stable enough for a hobby project |
| 2026-04-09 | Supabase RLS: block direct UPDATE, use increment_vote() | Prevents anon from overwriting vote counts directly; function is atomic |
| 2026-04-09 | Replace Google Analytics with Vercel Analytics | GA was a placeholder that never worked; Vercel Analytics is zero-config |
| 2026-04-11 | Fix ESLint errors + SEO pass | Unblocked CI; improved discoverability via structured data, H1, and sitemap freshness |
| 2026-04-11 | Upgrade Vite 5 → 8, plugin-react 4 → 6 | Cleared 2 moderate audit vulns; 0 vulnerabilities remaining |
| 2026-04-11 | Backfill historical weather via GitHub Actions | archive-api reachable from GH runners; seeded 2020-01-01 → 2025-12-31 |
| 2026-04-11 | Tamper-resistant voting via vote_tokens table | DB-level dedup without a backend; acceptable for hobby project; requires SQL migration in Supabase dashboard |
| 2026-04-11 | Security headers in vercel.json | CSP allowlists only known external endpoints; style-src unsafe-inline needed for recharts |
| 2026-04-11 | Remove Lovable legacy files | gpt-engineer.toml and .gpt_engineer/ deleted; Lovable and Netlify GitHub app access revoked |
| 2026-04-17 | Seasonal weather rules (Shitsville calendar) | Fixed thresholds didn't reflect Wellington's real seasons; six-season model calibrated against six years of historical data; wind limit raised from 20 → 30 km/h (old limit applied to only 12% of days) |

---

## Architecture Notes

### Data flow
1. Page load → Open-Meteo API → today's weather fetched
2. Today's record upserted to Supabase `daily_weather_records`
3. Historical records fetched from Supabase for About page charts/calendar
4. `is_good_day` computed at runtime using `getThresholds(date)` from `rulesStorage.js`
5. Votes stored in localStorage (client-side only) + incremented in Supabase via `increment_vote()` RPC

### Key files
| File | Purpose |
|------|---------|
| `src/utils/weatherStorage.js` | Open-Meteo fetch + localStorage cache |
| `src/utils/rulesStorage.js` | Seasonal weather criteria — `getThresholds(date)`, `getSeasonLabel(date)`, `countCriteriaMet(weather, date)` |
| `src/utils/weatherFunFacts.js` | Fun fact generation from historical data |
| `src/integrations/supabase/client.ts` | Supabase client (reads from `VITE_` env vars) |
| `src/integrations/supabase/types.ts` | DB types (manually maintained — no `is_good_day`) |
| `scripts/populate-db.js` | Node.js script to seed/refresh weather data (run manually or via daily cron) |
| `scripts/backfill-historical.js` | One-off backfill of 2020–2025 using Open-Meteo archive API |
| `vercel.json` | SPA rewrites + security headers + cache headers |
| `.github/workflows/ci.yml` | Lint + test + build + audit gate |
| `.github/workflows/supabase-keepalive.yml` | Prevents Supabase free tier from pausing (delete if migrating to Neon) |
| `.github/workflows/daily-weather.yml` | Fetches and stores Wellington weather daily at midnight NZT |
