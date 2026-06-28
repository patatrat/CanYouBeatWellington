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
- [x] **Fix fediverse fan-out evaluating the wrong day (NZT vs UTC)** — `fediverse-fanout.js` and `populate-db.js` computed `today` via `new Date().toISOString().split('T')[0]` (UTC date), which lags Wellington's NZT date by up to a day around the 12:00 UTC cron run. On 2026-06-08 the website correctly showed a "good day" (computed in NZT via Open-Meteo's `timezone=Pacific/Auckland`), but the fanout cron checked the *previous* day's (rainy) Supabase record and correctly-but-wrongly logged "not a good day — no post". Fixed by switching both scripts to `new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })`. Fixed on `main` (`8d27b3f`) and ported to `nextjs` (`06dc254`).

### P2 — Post-migration cleanup (Next.js + Neon cutover, 2026-06-28)
- [ ] **Update the GitHub Actions `DATABASE_URL` secret** — still holds the pre-rotation Neon password; the CI run right after rotation failed with `password authentication failed for user 'neondb_owner'` during `next build`'s `/history` prerender. Vercel and GitHub Actions secrets are separate stores — rotating one doesn't touch the other. Run `gh secret set DATABASE_URL` with the current value.
- [ ] **Fix `staging` branch CI** — never received the same `ci.yml` fix `main` got (regenerated lockfile + Next.js build env vars); will fail with the same `npm ci` EUSAGE error on the next push until updated the same way.
- [ ] **Investigate other failed GitHub Actions runs around the cutover** — several Dependabot PR-branch CI runs failed (esbuild/postcss bumps against branches with stale `package-lock.json`); worth a pass to see which are real vs. just stale branches that can be closed.
- [ ] **Delete dead Supabase-era scripts** — `scripts/populate-db.js`, `scripts/fediverse-fanout.js`, `scripts/backfill-historical.js`, `scripts/vote-tokens-migration.sql` all still reference the retired Supabase client; nothing calls them except the now-obsolete `backfill-historical.yml` workflow (one-off backfill already completed — Neon already has the historical data from the Phase 2 migration).
- [ ] **Delete `.github/workflows/backfill-historical.yml`** — see above.
- [ ] **Delete the now-redundant `.github/workflows/ci-nextjs.yml`** — scoped to the `nextjs` branch, which is fully merged; `ci.yml` on `main` covers the same ground now.
- [ ] **Send a test Mastodon Follow** to confirm the inbox works end-to-end on production (only structurally checked pre-cutover, since the preview URL never matched the actor ID).
- [ ] **Trigger the production cron once** (`/api/cron/daily-weather`) to confirm Vercel Cron + Neon write works for real on a schedule, not just via manual `curl`.
- [ ] **Delete the Supabase project** (Settings → General → Delete project) once production has been stable for a few days — all data already migrated and verified (2365 weather rows, 26 vote tokens, row counts matched exactly).
- [ ] **Remove Supabase env vars** — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from both Vercel and GitHub Actions secrets.
- [ ] **Delete the now-unused `can-you-beat-wellington-nextjs` Vercel project** — its job (isolated preview testing during the migration) is done; production now lives on the original `can-you-beat-wellington` project.
- [ ] **Update this CLAUDE.md's stack description, infrastructure table, architecture notes, and key files table** at the top of the file — still describes the pre-migration Vite/Supabase stack.
- [ ] **Monitor the `next`-bundled `postcss` moderate vulnerability** — `npm audit` flags a vulnerable `postcss` bundled inside `next`'s own `node_modules`; no real fix available yet (the suggested fix downgrades Next.js to v9, not viable) — wait for an upstream Next.js patch.
- [ ] **Consider deleting the `nextjs` branch** — fully merged into `staging` and `main`; low priority, not urgent.

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
- [x] **Migrate database from Supabase to Neon** — ✅ DONE as of 2026-06-28. Didn't follow this original sketch literally — see the full **Migration Spec** below (Phases 0–10) for what actually happened: a parallel Next.js + Neon rebuild on the `nextjs` branch, tested independently, then cut over via `nextjs` → `staging` → `main`. Remaining loose ends tracked under **P2 — Post-migration cleanup** above.

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
- [ ] **ActivityPub follow instructions on About page** — add a short section explaining that the site has a Fediverse account (`@CanYouBeat@canyoubeatwellington.radomski.co.nz`) and how to follow it from Mastodon/any ActivityPub client; include the handle to copy and a brief note that followers get notified on good days

### P5 — Nice to have
- [x] Add unit/integration tests — Vitest + jsdom; 68 tests across `rulesStorage` (good-day logic + boundaries) and `weatherStorage` (sunniness, daytime rain, localStorage round-trip); wired into CI
- [x] Set up Dependabot — weekly Monday updates targeting `staging`; ESLint major bumps ignored (v9 requires flat config migration)
- [x] Update React Router to 7.x — cleared XSS vuln; API unchanged for our usage (`BrowserRouter`, `Routes`, `Route`, `Link`)
- [ ] **Timezone-aware date handling** — dates are stored as `YYYY-MM-DD` strings and parsed with `new Date(dateString)`, which treats them as UTC midnight and can shift ±1 day in NZ timezone (UTC+12/+13). Use `date-fns/parseISO` everywhere dates are parsed from strings, and validate the calendar display in CalendarHistory against the actual NZ date.

### P5 — Widgets & embeds
- [ ] **Embeddable widget for other websites** — small `<iframe>`-able route (e.g. `/widget`) showing today's verdict with no nav/chrome, sized for embedding via a copy-paste `<iframe>` snippet (simplest approach, avoids CORS entirely). Comparatively low effort — same Next.js app, one new minimal-layout route.
- [ ] **Desktop widget — macOS** — requires a native Swift/SwiftUI app with a WidgetKit extension; not web technology. Needs a small public JSON endpoint (e.g. `/api/widget-data`) for the widget to poll.
- [ ] **Desktop widget — Windows** — needs a native app (WinUI, or a thin web-view wrapper) calling the same JSON endpoint.
- [ ] **Mobile widget — iOS** — home screen widget via WidgetKit (Swift); could share most of a native shell with the macOS widget.
- [ ] **Mobile widget — Android** — home screen widget via Glance/RemoteViews (Kotlin).
  - **Scope note**: the four native widgets are a different category of effort from the rest of this backlog — each needs a real native app shell (Swift for Apple platforms, Kotlin for Android), code signing, and app store distribution (or at minimum local sideloading), not just a web feature. Worth treating as a separate mini-project if pursued. The embeddable web widget is far simpler and could ship first as a stepping stone — same underlying data, no native shell needed.

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

### Phase 1 — Scaffold & routing ✅ DONE

Branch: `nextjs` (created from `main`, pushed to `origin/nextjs`)

- [x] Ran `create-next-app` — Next.js 16.2.7 App Router + TypeScript + Tailwind v4, `src/` dir
- [x] Removed Vite-specific files (`vite.config.js`, `index.html`, `src/App.jsx`, `src/main.jsx`, `src/pages/`, `src/integrations/supabase/`) and Next.js boilerplate
- [x] Copied across unchanged assets: `public/`, `quips.js`, `weatherFunFacts.js`; ported `rulesStorage.js` → `rulesStorage.ts` with `Season`/`Thresholds`/`Weather` types
- [x] Ported shadcn/ui setup — `button`, `tooltip`, `sonner`, `badge`, `popover`, `calendar`
- [x] Created stub pages: `src/app/page.tsx`, `src/app/about/page.tsx`, `src/app/history/page.tsx`, `src/app/not-found.tsx`, `src/app/layout.tsx`
- [x] Verified `npm run build` passes (4 static routes); committed as `46ee73b`
- [x] **Deployment verified** — created a **separate Vercel project** (`prj_0EQkWQTcejggxOEqqCEI87GhCuVE`) connected to the same repo, framework preset = Next.js, with a Deploy Hook targeting the `nextjs` branch (the original `can-you-beat-wellington` Vercel project has `framework: "vite"` locked at the project level, which broke `nextjs` builds with "No Output Directory named 'dist' found" — changing it would've broken the live `main` build, so a second project was the safe path). Triggered a build via the hook → preview deployment renders the `app/page.tsx` stub ("Home — coming soon") correctly. **This project/hook is the `nextjs` preview URL referenced in Phase 9.**
- [x] Also ported the NZT-timezone cron fix (see backlog "Fediverse fan-out checked the wrong day" below) onto `nextjs` as `06dc254`, keeping the branch in sync with `main`

---

### Phase 2 — Neon database (test instance) ✅ DONE

- [x] Neon MCP access connected — works fine in a fresh session (no restart needed)

- [x] Create a new Neon project: **"can-you-beat-wellington"** (`dawn-queen-51598624`) in `aws-ap-southeast-2` (same region as Umami, minimises latency from Vercel Sydney). **Note**: the MCP `create_project` tool has no `region_id` parameter and ignores any region hint — it landed two test projects in random US regions (`us-east-2`, `us-east-1`) before the user created the real one via the Neon dashboard, where region is selectable
- [x] Create two connection strings in Neon: pooled (`DATABASE_URL`) for app queries, unpooled (`DATABASE_URL_UNPOOLED`, no `-pooler` in the host) for migrations — both added to the `can-you-beat-wellington-nextjs` Vercel project's environment variables by the user (no Vercel MCP tool exposes env-var management, and no Vercel CLI auth was available locally)
- [x] **Schema migration** — ran the following DDL against the new Neon project via `mcp__claude_ai_Neon__run_sql_transaction`:

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

- [x] **Data migration** — no `psql`/DB password available locally for either side, so migrated via SQL round-trips through the Supabase and Neon MCP tools instead of `pg_dump`/`COPY`: generated compact `INSERT ... ON CONFLICT DO NOTHING` statements on the Supabase side with `string_agg`/`format(%L, ...)` (batched 300 rows at a time to stay under tool output limits), then executed each batch verbatim against Neon. Verified row counts match exactly: `daily_weather_records` 2345 ↔ 2345, `vote_tokens` 23 ↔ 23. Note: Supabase's `daily_weather_records` has extra `id` (uuid) and `updated_at` columns and `vote_tokens` has extra `vote_type`/`created_at` — intentionally dropped per the new schema above
- [x] Added `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to the `can-you-beat-wellington-nextjs` Vercel project environment (user did this manually via dashboard — see note above)
- [x] Installed driver: `npm install @neondatabase/serverless`
- [x] Created `src/lib/db.ts` — exports a `neon` SQL client (`sql`) using `DATABASE_URL`

---

### Phase 3 — Server-side data layer ✅ DONE

Replace all client-side Supabase calls with server-side Neon queries. No client ever touches the database.

- [x] **`src/lib/weather.ts`** — server-only module:
  - `getTodaysNZTDate()` — shared NZT "today" helper
  - `getTodaysRecord(): Promise<DailyWeatherRecord | null>` — queries by today's NZT date
  - `getHistoricalRecords(from, to): Promise<DailyWeatherRecord[]>` — for About/History pages
  - `upsertWeatherRecord(record)` — `INSERT ... ON CONFLICT (date) DO UPDATE`, for the daily cron
- [x] **`src/lib/votes.ts`** — server-only module:
  - `castVote(date, type, token): Promise<{alreadyVoted: boolean}>` — wraps `increment_vote()`, catches Postgres error code `23505` (unique_violation) and returns `{ alreadyVoted: true }` instead of throwing — same contract `VotingButtons` already expects from the Supabase RPC error path
- [x] **`src/types/db.ts`** — `DailyWeatherRecord` TypeScript type matching the Neon schema
- [x] `src/integrations/supabase/` — already removed in Phase 1's scaffold; nothing to delete
- [x] Verified end-to-end against the live Neon DB: `getTodaysRecord`-style query returns the correct row with proper casts; `increment_vote` increments counts and correctly raises `23505` on a duplicate `(token, date)` — exactly what `castVote` catches

---

### Phase 4 — Home page ✅ DONE

The home page is the critical path. It must show the correct verdict on load, without any client-side weather fetch.

- [x] **Home page as a Server Component** — `app/page.tsx`:
  - Fetches today's NZT date server-side, calls `getTodaysRecord()` and `fetchLiveWeather()` in parallel
  - If no DB record exists yet (window before the daily cron runs), upserts one from the live Open-Meteo fetch so voting has something to attach to, then re-reads it
  - Computes `isGood`/quip using `getThresholds`/`getSeasonLabel`/`getScenario`/`pickQuip` server-side — same logic as `rulesStorage.ts`/`quips.js`
  - Passes verdict, weather stats, and forecast data as props to `WeatherStat`, `VotingButtons`, `ForecastStrip`
  - `export const revalidate = 3600` — confirmed in build output (`Revalidate: 1h`)
- [x] **VotingButtons** ported as a client component (`'use client'`) calling the `castVoteAction` Server Action — `src/app/actions/vote.ts` wraps `castVote()` from `src/lib/votes.ts`. No DB credentials in the browser.
- [x] **ForecastStrip** ported as a server-rendered component, receives `ForecastDay[]` as props (typed in `src/lib/weather.ts`)
- [x] **`src/utils/weatherStorage.js`** — already absent (removed during Phase 1 scaffolding; never carried over)
- [x] Added `<Analytics />` from `@vercel/analytics/react` to `app/layout.tsx` (parity with the Vite app's Vercel Analytics)
- [x] Added `src/instrumentation.ts` — calls `dns.setDefaultResultOrder("ipv4first")` on server startup. Without it, Node's `fetch` (undici) intermittently produced `ConnectTimeoutError` connecting to `api.open-meteo.com` (IPv4-only host) in the dev sandbox; `curl` from the same shell succeeded immediately. Forcing IPv4-first DNS resolution fixed it — documented as a decision below since it's a non-obvious environment quirk that could resurface in other Node/undici deployments.
- [x] Verified end-to-end in the dev server: correct verdict, season badge, quip, weather stats, voting buttons (no SSR localStorage error, no hydration mismatch), forecast strip — all rendering live data from Neon + Open-Meteo
- [x] `tsc --noEmit`, `eslint`, and `next build` all pass clean

---

### Phase 5 — About and History pages ✅ DONE

Both are already data-heavy with recharts/react-day-picker. Ported as Server Components with client islands for interactive elements.

- [x] `app/about/page.tsx` — Server Component; purely static content (rules table, attribution) — turns out the Vite `About.jsx` never queried Supabase, so no data layer needed here. Replaced the `useEffect`-based `document.title` swap with the App Router `metadata` export.
- [x] `app/history/page.tsx` — Server Component, calls new `getAllHistoricalRecords()` (added to `src/lib/weather.ts` — `getHistoricalRecords(from, to)` needed bounds, History wants the full table like the old `select('*').order('date', desc)`); `export const revalidate = 3600`; same `metadata`-based title swap
- [x] `MonthlyGoodDaysChart`, `MonthlyAveragesChart`, `CalendarHistory`, `SeasonBreakdown` — ported to `.tsx` as `'use client'` (recharts/Radix tooltip require it); receive `DailyWeatherRecord[]` as props; `ResponsiveContainer` renders an empty wrapper in the initial server HTML and fills in the chart SVG client-side once it can measure pixel dimensions — expected recharts SSR behaviour, confirmed no console errors
- [x] `weatherFunFacts.ts` — renamed from `.js`, added `DailyWeatherRecord[]`/`string[]` types; `FunFacts` ported as a **Server Component** (not client) — picking the `Math.random()` fact at request time avoids a hydration mismatch that a client-side `useMemo` would cause when the server and client compute different random facts
- [x] Installed `recharts` (was missing from `package.json` — Phase 1 scaffolding never carried it over)
- [x] Verified end-to-end in the dev server: both pages return 200, About renders the rules table/attribution, History renders the fun fact, all three chart containers, and the calendar (showing the correct current month) with live Neon data — no console errors
- [x] `tsc --noEmit`, `eslint`, and `next build` all pass clean (`/history` shows `Revalidate: 1h` in build output)

---

### Phase 6 — Daily weather cron ✅ DONE

Replace the GitHub Actions daily cron with a Vercel Cron Job. Simpler, no secrets duplication between GitHub and Vercel.

- [x] Created `app/api/cron/daily-weather/route.ts` — fetches Open-Meteo for the last 92 days + today, upserts to Neon, evaluates today's verdict, fans out to ActivityPub followers on good days, protected by `CRON_SECRET` bearer check
- [x] Added cron to `vercel.json`: `{ "path": "/api/cron/daily-weather", "schedule": "0 12 * * *" }`
- [x] `CRON_SECRET` added to Vercel env vars by user
- [x] Deleted `.github/workflows/daily-weather.yml` (replaced by Vercel Cron)
- [x] Deleted `.github/workflows/supabase-keepalive.yml` (Neon doesn't pause)
- [x] Kept `.github/workflows/announce.yml` — still useful for one-off manual announcements
- [x] Ported `api/lib/http-signatures.js` → `src/lib/http-signatures.ts` (typed; used by both cron and inbox)

---

### Phase 7 — ActivityPub ✅ DONE

Route Handlers replace the `api/` directory. Routes placed at their public URLs directly (no rewrites needed — unlike the Vite app which had `vercel.json` rewrites from `/actor` → `/api/actor` etc.).

- [x] `api/well-known/webfinger.js` → `src/app/.well-known/webfinger/route.ts` (serves `/.well-known/webfinger`)
- [x] `api/actor.js` → `src/app/actor/route.ts` (serves `/actor`)
- [x] `api/actor/inbox.js` → `src/app/actor/inbox/route.ts` (serves `/actor/inbox`)
- [x] `api/actor/outbox.js` → `src/app/actor/outbox/route.ts` (serves `/actor/outbox`)
- [x] `api/actor/followers.js` → `src/app/actor/followers/route.ts` (serves `/actor/followers`)
- [x] `api/notes/[id].js` → `src/app/notes/[id]/route.ts` (serves `/notes/[id]`)
- [x] Deleted `api/` directory entirely — no longer needed
- [x] No `vercel.json` rewrites needed — Next.js App Router handles all routes natively
- [x] **AP keys and KV env vars are unchanged** — same Vercel project, same keys, zero follower disruption

---

### Phase 8 — TypeScript, tests, CSP ✅ DONE

- [x] **All new files are TypeScript** — `src/utils/quips.js` was the last `.js` file in `src/`; converted to `quips.ts` with proper types
- [x] **Vitest set up** — added `vitest ^3.2.0` to devDependencies, `"test": "vitest run"` script, `vitest.config.ts` with `@/*` alias; `src/utils/__tests__/rulesStorage.test.ts` ported from `main` (50 tests covering all seasons, boundary conditions)
- [x] **weatherStorage tests** — not ported; `weatherStorage.js` no longer exists (server-side weather is in `src/lib/weather.ts`). The localStorage and client-fetch tests have no equivalent. Server-side fetch tests would require mocking Neon + Open-Meteo — left as a future addition if needed
- [x] **`tsc --noEmit` added to CI** — new `.github/workflows/ci-nextjs.yml` runs lint + typecheck + test + build on the `nextjs` branch. **Note**: the build step needs `DATABASE_URL` added as a GitHub Actions secret (same value as Vercel env var) — without it, `next build` fails when pre-rendering the home page during ISR static generation
- [x] **CSP updated** — `qumelyuoeutlnnouhguo.supabase.co` already absent from `vercel.json` `connect-src` (removed when Supabase client was dropped in Phase 1)
- [x] **Umami `data-website-id`** — same ID, no change needed
- [x] **`@supabase/supabase-js`** — already absent from `package.json` (never added to the Next.js scaffold)

---

### Phase 9 — Testing on the `nextjs` preview URL ✅ DONE

Before touching `staging` or `main`.

Preview URL: `https://can-you-beat-wellington-nextjs-git-nextjs-patatrats-projects.vercel.app`

- [x] **Verdict correctness** — confirmed via direct Neon/Supabase comparison: same `calculateDaytimeRain`/`calculateDaytimeWind` logic on both branches, same verdict (all 3 criteria fail on both apps for 2026-06-27). Visually confirmed live in browser after triggering a fresh deploy (`84bcd63`) — the preview had gone stale (no deploy on `nextjs` since 2026-06-09; Vercel doesn't revalidate ISR pages on preview deployments without a fresh build)
- [x] **Voting** — agree vote cast via the fresh deployment; `agree_count` incremented 0→1 in Neon and a matching `vote_tokens` row was created for 2026-06-27, confirmed by direct query
- [x] **Historical data** — History page loads; found a real data gap, 2026-06-10 through 2026-06-26 (17 days) missing from Neon — **root cause**: Vercel Cron only runs against a project's Production deployment, and every Production deployment on this preview project has been in `ERROR` state (triggered by `main`/Dependabot pushes containing the old Vite app, which can't build here) — so the daily cron has had zero executions since Phase 2. Self-heals: the cron route fetches the last 92 days every run and upserts idempotently, so triggering it once (see Cron item below) backfills the whole gap automatically. Not a code bug — won't recur post-cutover once `staging`/`main` get a working Production deployment.
- [x] **ActivityPub — WebFinger** — `/.well-known/webfinger?resource=acct:CanYouBeat@canyoubeatwellington.radomski.co.nz` returns correct subject + links JSON ✓
- [ ] **ActivityPub — actor JSON** — skipped on preview; `AP_PUBLIC_KEY` / `AP_PRIVATE_KEY` are marked sensitive in Vercel and can't be copied to the preview project without rolling them. These env vars will be set at Phase 10 cutover when configuring the production `nextjs` project (same key pair — no rolling needed, no follower disruption)
- [x] **Cron** — triggered manually via `curl` (using a fresh `CRON_SECRET` generated for this preview project + Vercel's "Protection Bypass for Automation" secret to get past Deployment Protection): `{"ok":true,"stored":93,"today":{...},"fanout":"skipped — not a good day"}`. Verified in Neon — fetched 92 days + today and upserted idempotently, which also backfilled the 2026-06-10–26 gap noted above as a side effect. Today's verdict (temp 10.7°C, wind 32.4 km/h, rain 0.4mm — all 3 fail) correctly skipped the ActivityPub fanout.
- [x] **CI** — lint, type-check, test (50 tests), build, audit all pass on the `nextjs` branch (`ci-nextjs.yml`, run `27187471104`)

---

### Phase 10 — Cutover

Do this in one sitting. Estimated time: 30 minutes.

**Pre-cutover (same day):**
- [x] **Switch the `can-you-beat-wellington` Vercel project's framework preset from `vite` to Next.js** — done manually via Vercel dashboard → Settings → General → Framework Preset (no MCP/API tool exposes this setting). Confirmed via `get_project`: `framework: "nextjs"`.
- [x] **Delta export and restore (no `pg_dump` access available — used MCP SQL round-trip instead, same approach as Phase 2)** — queried Supabase directly for all `daily_weather_records`/`vote_tokens` rows newer than the Phase 2 snapshot (2026-06-08): 20 weather rows, 3 real votes (2026-06-14, 2026-06-22 ×2). Upserted into Neon with Supabase as the source of truth on conflict — this also **overwrote test-pollution data** Phase 9 testing had left in Neon for the same date range (a test vote on 2026-06-27 that doesn't exist in real production, plus weather readings fetched at different times than the real daily cron). Also deleted the stray test `vote_tokens` row.
- [x] **Verify Neon row count matches Supabase row count** — `daily_weather_records`: 2365 ↔ 2365. `vote_tokens`: 26 ↔ 26 (23 from Phase 2 + 3 newly merged).

**Cutover:**
- [x] **Merge `nextjs` → `staging`; confirm staging Vercel deployment succeeds** — clean fast-forward. First deploy failed (`DATABASE_URL` not yet set on this project — it had only ever held `VITE_`-prefixed Supabase vars). After adding `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CRON_SECRET` (copied from the now-retired `can-you-beat-wellington-nextjs` project — same Neon project throughout, no migration needed; `AP_PUBLIC_KEY`/`AP_PRIVATE_KEY` already existed here from the live ActivityPub actor), a fresh deploy succeeded.
- [x] **Final smoke test on the staging URL** — WebFinger confirmed via tool; home page/voting/history visually confirmed by user in-browser.
- [x] **DATABASE_URL / DATABASE_URL_UNPOOLED** — only one Neon project ever existed (`dawn-queen-51598624`); no "test → production" promotion needed, just added the existing connection strings to this project's env vars.
- [x] **Merge `staging` → `main`; Vercel deploys to production** — conflicts in `CLAUDE.md`/`package.json`/`package-lock.json` (main had one unique commit, the Dependabot security-fix bump on the old Vite deps, irrelevant once replaced by the Next.js dependency set; resolved by taking `staging`'s version). **Post-merge CI broke**: the old `ci.yml` (`npm ci` + `VITE_SUPABASE_URL` build env) choked on the new Next.js `package.json` — same lockfile-drift issue hit earlier on the `nextjs` branch (vitest/vite added to `package.json` by hand mid-migration without a real `npm install`). Fixed same-day by regenerating `package-lock.json` properly and updating `ci.yml`'s build env to the Next.js vars (`DATABASE_URL` secret already existed from Phase 8) — CI green again.
- [x] **Verify production** — confirmed live on `canyoubeatwellington.radomski.co.nz`: home page shows correct date/verdict/weather/vote count (`x-nextjs-prerender` header present, CSP no longer references Supabase), `/actor` returns the actor JSON with the **same public key as before** (zero follower disruption), `/.well-known/webfinger` resolves correctly.

**Post-cutover:**
- [ ] Send a test Follow from a real Mastodon account to confirm the new inbox works end-to-end
- [ ] Trigger the daily cron manually once to confirm Vercel Cron + Neon write works in production
- [ ] Delete the Supabase project (Settings → General → Delete project) — keep the pg_dump as the archive
- [ ] Update this CLAUDE.md: stack description, infrastructure table, architecture notes, key files table
- [ ] Remove Supabase env vars from Vercel and GitHub secrets
- [x] **Rotate the Neon DB password** — it was fetched via the Neon MCP tool and appeared in plaintext in the chat session (an attempted shell command using it was blocked by the auto-mode classifier before execution, but the connection string had already been displayed by the tool call itself). User rotated the `neondb_owner` role password in the Neon dashboard and updated `DATABASE_URL`/`DATABASE_URL_UNPOOLED` + redeployed.

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
| 2026-06-08 | Migrate Supabase → Neon data via SQL round-trips through MCP, not `pg_dump`/`COPY` | No `psql` or DB password available locally for either side; generated batched `INSERT ... ON CONFLICT DO NOTHING` text on the Supabase side with `string_agg`/`format`, executed verbatim against Neon. Verified row counts match exactly (2345 weather records, 23 vote tokens) |
| 2026-06-08 | Create the Neon project via the dashboard, not the MCP `create_project` tool | The MCP tool has no `region_id` parameter and lands projects in random US regions (got `us-east-2`, then `us-east-1`) — can't target `aws-ap-southeast-2` to match the other projects and minimise Vercel Sydney latency. Dashboard creation lets you pick the region directly |
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
| 2026-06-08 | Create a separate Vercel project for the `nextjs` branch (rather than repointing the existing project) | Existing `can-you-beat-wellington` Vercel project has `framework: "vite"` locked at the project level; switching it to Next.js would break `main`'s production Vite build. A second project (Deploy Hook scoped to `nextjs`) gives an isolated, working preview URL for migration testing with zero prod risk — matches the "test on preview before touching staging/main" approach in Phase 9 |
| 2026-06-08 | Fix cron "today" computation to use NZT, not UTC | `toISOString().split('T')[0]` returns the UTC date, causing the fediverse fan-out and populate-db scripts to evaluate the wrong calendar day around the 12:00 UTC run boundary (NZ is UTC+12/+13) — this caused a missed "good day" notification on 2026-06-08. Switched to `toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })` to match the website's NZT-based date derivation |
| 2026-06-08 | Force IPv4-first DNS resolution via `src/instrumentation.ts` | Node's `fetch` (undici) intermittently threw `ConnectTimeoutError` connecting to `api.open-meteo.com` from the dev sandbox — `curl` against the same host from the same shell succeeded immediately and `dns.lookup` only returned an IPv4 address. Calling `dns.setDefaultResultOrder("ipv4first")` in the `register()` hook (runs once at server startup, before any route code executes) fixed it reliably. Worth keeping for production too — Open-Meteo is IPv4-only and this removes a class of flaky-fetch risk on any undici-based Node runtime |
| 2026-06-09 | Place ActivityPub routes at public URLs (`/actor`, `/.well-known/webfinger`, etc.) not under `/api/` | The spec suggested `/api/actor` but the existing actor's `id` field is `https://domain/actor` — mismatching would break existing followers. In Next.js App Router, placing routes at the correct public paths (`src/app/actor/route.ts`, `src/app/.well-known/webfinger/route.ts`, etc.) eliminates the `vercel.json` rewrites the Vite app required |

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
