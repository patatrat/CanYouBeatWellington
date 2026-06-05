# CLAUDE.md — Can You Beat Wellington?

Project tracking, backlog, and architectural decisions.

## Project Overview

A hobby webapp that checks if today's weather in Wellington, NZ is good enough that you "can't beat it". Users can vote agree/disagree. Historical data stored in Supabase, visualised on the About page.

- **Live**: https://canyoubeatwellington.radomski.co.nz/
- **Repo**: https://github.com/patatrat/CanYouBeatWellington
- **Stack**: React 18 + Vite 8 + React Router 7 + Tailwind CSS + shadcn/ui + Supabase *(migration to Next.js 15 + Neon planned — see Migration Spec)*
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
- [x] **Fix React Query invalidation in VotingButtons** — updated to v5 API `invalidateQueries({ queryKey: ['todaysRecord'] })`. (`VotingButtons.jsx:56`)
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
- [x] **Deduplicate `calculateSunniness` across scripts** — extracted to `scripts/utils.js`; both `populate-db.js` and `backfill-historical.js` import from it.
- [x] **Remove dead scripts** — `scripts/populate-historical-data.js` and `scripts/recheck-historical-data.js` deleted.
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

## Migration Spec — Next.js + Neon rebuild

Full rebuild of the stack using the current app as the functional spec. UI and feature parity is the goal — no new features during the migration. The rebuild happens on a long-lived `nextjs` branch in this repo; production is untouched until cutover.

**Why:** Single source of truth for the daily verdict (eliminates the home/history divergence class of bug), SSR makes the page indexable by search engines, no client-side DB credentials, no Supabase auto-pause workaround, consistent with every other project in the portfolio.

**New stack:** Next.js 15 App Router · TypeScript throughout · @neondatabase/serverless · Vercel Cron (replaces GH Actions daily weather) · shadcn/ui + Tailwind (unchanged) · Vercel KV (unchanged, ActivityPub) · Vitest (unchanged)

---

### Phase 0 — Pre-migration housekeeping (do on `main` first)

These are small fixes on the current codebase that are cheaper to do before the migration than to carry forward as debt.

- [x] **Fix `storeMutate` in useEffect dep array (Index.jsx)** — dropped `storeMutate` from dep array; `storeMutate` is a stable ref from `useMutation` but its identity changes each render in some versions; `weather` alone is the correct dependency.
- [x] **Validate Open-Meteo response shape** — added guard for hourly arrays shorter than 18 entries (minimum needed for the 6am–6pm daytime window). (`src/utils/weatherStorage.js`)
- [x] **Delete dead scripts** — already gone (`populate-historical-data.js`, `recheck-historical-data.js` were removed in a prior cleanup).
- [x] **Deduplicate `calculateSunniness`** — already done; `scripts/utils.js` is the source of truth; both `populate-db.js` and `backfill-historical.js` import from it. The copy in `src/utils/weatherStorage.js` is intentional (client bundle can't import from `scripts/`).
- [x] **Supabase data snapshot** — not needed in Phase 0; the export happens as part of Phase 2 data migration. KV stays in place on the same Vercel project throughout.
- [x] **KV follower snapshot** — not needed; KV is not migrated (same Vercel project), and follower count is trivially small.

---

### Phase 1 — Scaffold & routing

Branch: `git checkout -b nextjs main`

- [ ] Run `npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*"` — accept overwrite prompts for `tailwind.config`, `tsconfig`, `package.json`
- [ ] Remove Next.js boilerplate (`app/page.tsx` placeholder, `public/next.svg`, etc.)
- [ ] Copy across unchanged assets: `public/` (SVGs, PNGs, favicon), `src/utils/rulesStorage.js` → `src/utils/rulesStorage.ts` (add types), `src/utils/quips.js`, `src/utils/weatherFunFacts.js`
- [ ] Port shadcn/ui setup (`components.json`, `src/components/ui/`) — run `npx shadcn@latest init` then add back only the components in use: `button`, `tooltip`, `sonner`, `calendar`, `badge`, `popover`
- [ ] Create stub pages: `app/page.tsx` (home), `app/about/page.tsx`, `app/history/page.tsx`, `app/not-found.tsx`
- [ ] Verify: `npm run dev` loads, routing works, no build errors

---

### Phase 2 — Neon database (test instance)

- [ ] Create a new Neon project: **"can-you-beat-wellington"** in `aws-ap-southeast-2` (same region as Umami, minimises latency from Vercel Sydney)
- [ ] Create two connection strings in Neon: pooled (`DATABASE_URL`) for app queries, unpooled (`DATABASE_URL_UNPOOLED`) for migrations
- [ ] **Schema migration** — run the following DDL against the new Neon project:

```sql
-- Weather records
CREATE TABLE daily_weather_records (
  date          DATE PRIMARY KEY,
  temperature   NUMERIC(5,2) NOT NULL,
  wind_speed    NUMERIC(5,2) NOT NULL,
  rain          NUMERIC(5,2) NOT NULL DEFAULT 0,
  sunniness     INTEGER,
  agree_count   INTEGER NOT NULL DEFAULT 0,
  disagree_count INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Vote dedup
CREATE TABLE vote_tokens (
  token TEXT NOT NULL,
  date  DATE NOT NULL,
  PRIMARY KEY (token, date)
);

-- Atomic vote increment — same logic as current Supabase SECURITY DEFINER fn
CREATE OR REPLACE FUNCTION increment_vote(
  record_date DATE,
  vote_type   TEXT,
  voter_token TEXT
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO vote_tokens (token, date) VALUES (voter_token, record_date);
  IF vote_type = 'agree' THEN
    UPDATE daily_weather_records SET agree_count = agree_count + 1 WHERE date = record_date;
  ELSIF vote_type = 'disagree' THEN
    UPDATE daily_weather_records SET disagree_count = disagree_count + 1 WHERE date = record_date;
  END IF;
END;
$$;
```

- [ ] **Data migration** — export from Supabase and import to Neon:
  1. Supabase dashboard → SQL editor → `COPY daily_weather_records TO STDOUT WITH CSV HEADER` — save as `backups/weather.csv`
  2. Same for `vote_tokens` → `backups/vote_tokens.csv`
  3. `psql $DATABASE_URL_UNPOOLED -c "\COPY daily_weather_records FROM 'backups/weather.csv' CSV HEADER"`
  4. Same for `vote_tokens`
  5. Verify row counts match Supabase
- [ ] Add `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to Vercel environment (preview + production), scoped to the `nextjs` branch for now
- [ ] Install driver: `npm install @neondatabase/serverless`
- [ ] Create `src/lib/db.ts` — exports a `neon` SQL client using `DATABASE_URL`

---

### Phase 3 — Server-side data layer

Replace all client-side Supabase calls with server-side Neon queries. No client ever touches the database.

- [ ] **`src/lib/weather.ts`** — server-only module:
  - `getTodaysRecord(): Promise<DailyWeatherRecord | null>` — queries by today's NZT date
  - `getHistoricalRecords(from, to): Promise<DailyWeatherRecord[]>` — for About/History pages
  - `upsertWeatherRecord(record)` — used by the daily cron
- [ ] **`src/lib/votes.ts`** — server-only module:
  - `castVote(date, type, token): Promise<{alreadyVoted: boolean}>` — wraps `increment_vote()`
- [ ] **`src/types/db.ts`** — TypeScript types for `DailyWeatherRecord`, matching DB schema
- [ ] Delete `src/integrations/supabase/` directory entirely

---

### Phase 4 — Home page

The home page is the critical path. It must show the correct verdict on load, without any client-side weather fetch.

- [ ] **Home page as a Server Component** — `app/page.tsx`:
  - Fetch today's NZT date server-side
  - Call `getTodaysRecord()` — if record exists, use it; otherwise fetch live from Open-Meteo (handles the window before the daily cron runs)
  - Compute `isGood` using `getThresholds(date)` — same `rulesStorage.ts` logic, server-side
  - Pass verdict, weather stats, and forecast data as props to client components
  - Revalidate every 60 minutes (`export const revalidate = 3600`) so CDN serves fresh data without a per-user Open-Meteo call
- [ ] **VotingButtons** stays a client component (`'use client'`) — calls a Server Action:
  ```ts
  // app/actions/vote.ts
  'use server'
  export async function castVoteAction(date: string, type: 'agree' | 'disagree', token: string)
  ```
  Replaces the direct Supabase RPC call. No DB credentials in the browser.
- [ ] **ForecastStrip** — port as-is, receives forecast data as props (server-fetched)
- [ ] **Remove** `src/utils/weatherStorage.js` localStorage cache — no longer needed; weather comes from the server

---

### Phase 5 — About and History pages

Both are already data-heavy with recharts/react-day-picker. Port as Server Components with client islands for interactive elements.

- [ ] `app/about/page.tsx` — Server Component, fetches full history from Neon, passes to chart components
- [ ] `app/history/page.tsx` — Server Component, same data source
- [ ] `MonthlyGoodDaysChart`, `MonthlyAveragesChart`, `CalendarHistory`, `SeasonBreakdown` — mark as `'use client'` (recharts requires it); receive data as props
- [ ] `weatherFunFacts.ts` — runs server-side, no change to logic

---

### Phase 6 — Daily weather cron

Replace the GitHub Actions daily cron with a Vercel Cron Job. Simpler, no secrets duplication between GitHub and Vercel.

- [ ] Create `app/api/cron/daily-weather/route.ts` — same logic as `scripts/populate-db.js`:
  - Fetch Open-Meteo for the last 92 days + today
  - Upsert into Neon `daily_weather_records`
  - Evaluate today's verdict using `getThresholds()`
  - If good day, fan out to ActivityPub followers (same `signAndDeliver` logic)
  - Protected by `Authorization: Bearer $CRON_SECRET` header check
- [ ] Add to `vercel.json`:
  ```json
  "crons": [{ "path": "/api/cron/daily-weather", "schedule": "0 12 * * *" }]
  ```
- [ ] Add `CRON_SECRET` to Vercel env vars
- [ ] Delete `.github/workflows/daily-weather.yml` (replaced by Vercel Cron)
- [ ] Delete `.github/workflows/supabase-keepalive.yml` (Neon doesn't pause)
- [ ] Keep `.github/workflows/announce.yml` — still useful for one-off manual announcements; update it to call the Neon-based `scripts/announce.js`

---

### Phase 7 — ActivityPub

Minimal changes — the logic is already correct. Route Handlers replace the `api/` directory.

- [ ] Move `api/well-known/webfinger.js` → `app/api/well-known/webfinger/route.ts`
- [ ] Move `api/actor.js` → `app/api/actor/route.ts`
- [ ] Move `api/actor/inbox.js` → `app/api/actor/inbox/route.ts`
- [ ] Move `api/actor/outbox.js` → `app/api/actor/outbox/route.ts`
- [ ] Move `api/actor/followers.js` → `app/api/actor/followers/route.ts`
- [ ] Move `api/notes/[id].js` → `app/api/notes/[id]/route.ts`
- [ ] Move `api/lib/http-signatures.js` → `src/lib/http-signatures.ts` (add types)
- [ ] Update `vercel.json` rewrites — most become unnecessary as Next.js handles `app/api/` routing natively; keep only the `/.well-known/webfinger` rewrite if needed
- [ ] **AP keys and KV env vars are unchanged** — same Vercel project, same keys, zero follower disruption

---

### Phase 8 — TypeScript, tests, CSP

- [ ] Convert all new files to TypeScript; ensure `tsc --noEmit` passes in CI
- [ ] Port Vitest tests from `src/utils/__tests__/` — `rulesStorage.test.ts` and `weatherStorage.test.ts` (remove localStorage-specific tests, add server-side fetch tests)
- [ ] Update `vercel.json` CSP `connect-src` — remove Supabase endpoint (`qumelyuoeutlnnouhguo.supabase.co`); Neon queries are server-side so they don't need a browser-facing CSP entry
- [ ] Update Umami script `data-website-id` — same ID, no change needed
- [ ] Remove `@supabase/supabase-js` from `package.json`

---

### Phase 9 — Testing on the `nextjs` preview URL

Before touching `staging` or `main`.

- [ ] **Verdict correctness** — visit the preview URL; confirm today's verdict matches production
- [ ] **Voting** — cast an agree and disagree vote; confirm counts update; confirm a second vote is blocked (same token); check `vote_tokens` table in Neon has the row
- [ ] **Historical data** — About and History pages load; chart data matches production (spot-check 3 months)
- [ ] **ActivityPub** — WebFinger resolves (`/.well-known/webfinger?resource=acct:CanYouBeat@...`); actor JSON is valid; inbox accepts a Follow from a test Mastodon account on the preview URL (note: the preview URL won't match the actor ID, so this is limited to structural checks)
- [ ] **Cron** — trigger `/api/cron/daily-weather` manually with the `CRON_SECRET` header; confirm Neon is updated and logs show correct behaviour
- [ ] **CI** — lint, type-check, test, build all pass on the `nextjs` branch

---

### Phase 10 — Cutover

Do this in one sitting. Estimated time: 30 minutes.

**Pre-cutover (same day):**
- [ ] Final `pg_dump` of Supabase `daily_weather_records` and `vote_tokens` — captures any votes/records since Phase 2's data migration
- [ ] Restore the delta into Neon production: `COPY ... FROM STDIN` for any rows newer than the Phase 2 snapshot date
- [ ] Verify Neon row count matches Supabase row count

**Cutover:**
- [ ] Merge `nextjs` → `staging`; confirm staging Vercel deployment succeeds
- [ ] Do a final smoke test on the staging URL: verdict, voting, history, AP WebFinger
- [ ] In Vercel, update `DATABASE_URL` / `DATABASE_URL_UNPOOLED` from test Neon project to production Neon project (or promote the same project — just ensure it has the final data)
- [ ] Merge `staging` → `main`; Vercel deploys to production
- [ ] Verify production: home page loads with correct verdict, vote counts visible, `/actor` returns valid JSON, `/.well-known/webfinger` resolves

**Post-cutover:**
- [ ] Send a test Follow from a real Mastodon account to confirm the new inbox works end-to-end
- [ ] Trigger the daily cron manually once to confirm Vercel Cron + Neon write works in production
- [ ] Delete the Supabase project (Settings → General → Delete project) — keep the pg_dump as the archive
- [ ] Update this CLAUDE.md: stack description, infrastructure table, architecture notes, key files table
- [ ] Remove Supabase env vars from Vercel and GitHub secrets

---

### Env var changes summary

| Variable | Action |
|----------|--------|
| `VITE_SUPABASE_URL` | Remove |
| `VITE_SUPABASE_ANON_KEY` | Remove |
| `SUPABASE_SERVICE_ROLE_KEY` | Remove |
| `DATABASE_URL` | Add (Neon pooled) |
| `DATABASE_URL_UNPOOLED` | Add (Neon direct, for migrations) |
| `CRON_SECRET` | Add (protects `/api/cron/daily-weather`) |
| `AP_PRIVATE_KEY` | Unchanged |
| `AP_PUBLIC_KEY` | Unchanged |
| `KV_REST_API_URL` | Unchanged |
| `KV_REST_API_TOKEN` | Unchanged |

---

### Risk register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| ActivityPub followers drop off during cutover | Low | Same Vercel project, same KV, same actor URL and key pair — followers see no change |
| Vote data lost in delta between Phase 2 and cutover | Low | Final pg_dump on cutover day captures delta; restore before switching env vars |
| Neon connectivity from Vercel Edge Runtime | Low | @neondatabase/serverless is designed for this; test in Phase 9 |
| Recharts / react-day-picker not compatible with RSC | Medium | Mark those components `'use client'`, pass data as props — standard pattern |
| Vercel Cron timing vs GitHub Actions timing | Low | Same schedule (`0 12 * * *`); delete GH Actions workflow only after Vercel Cron confirmed working |

---

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
