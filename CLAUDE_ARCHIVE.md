# CLAUDE_ARCHIVE.md — Can You Beat Wellington?

Historical record: completed backlog items and the full Next.js + Neon migration spec, moved out of `CLAUDE.md` to keep that file focused on what's current. Nothing here should be treated as an active TODO.

---

## Completed backlog (by original P-level)

### P2 — Security hardening
- [x] **Add Supabase RLS policies** — SELECT/INSERT for anon; direct UPDATE blocked; votes go via `increment_vote` SECURITY DEFINER function
- [x] **Remove dead Google Analytics code** — replaced with Vercel Analytics
- [x] **Security headers** — CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy added to `vercel.json`
- [x] **Remove Lovable/GPT Engineer legacy files** — deleted `gpt-engineer.toml` and `.gpt_engineer/` directory; revoked GitHub access

### P2 — Bug fixes (from code review, April 2026)
- [x] **Fix React Query invalidation in VotingButtons** — updated to v5 API `invalidateQueries({ queryKey: ['todaysRecord'] })`. (`VotingButtons.jsx:56`)
- [x] **Fix `mutation` in useEffect dependency array (Index.jsx)** — obsolete, not just stale: `Index.jsx` no longer exists. The home page is now `src/app/page.tsx`, a Server Component with no `useEffect`/`useMutation` at all — the entire client-side fetch-then-store pattern this bug lived in was eliminated by the Phase 4 rewrite. Checked the remaining client component (`VotingButtons.tsx`) too — its one `useEffect` depends only on the stable `date` prop, no equivalent risk.
- [x] **Validate API response shape in `fetchAndStoreBatch` (`src/lib/weather.ts`)** — added a guard checking `daily.time`/`temperature_2m_max`/`weather_code` are present and consistently sized, and `hourly.precipitation`/`wind_speed_10m` have at least `dayCount * 24` entries (matches what `daytimeSlice` needs for every day in the batch); throws `"Open-Meteo API returned incomplete data"` instead of silently upserting zeroed/wrong rows.
- [x] **Fix fediverse fan-out evaluating the wrong day (NZT vs UTC)** — `fediverse-fanout.js` and `populate-db.js` computed `today` via `new Date().toISOString().split('T')[0]` (UTC date), which lags Wellington's NZT date by up to a day around the 12:00 UTC cron run. On 2026-06-08 the website correctly showed a "good day" (computed in NZT via Open-Meteo's `timezone=Pacific/Auckland`), but the fanout cron checked the *previous* day's (rainy) Supabase record and correctly-but-wrongly logged "not a good day — no post". Fixed by switching both scripts to `new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })`. Fixed on `main` (`8d27b3f`) and ported to `nextjs` (`06dc254`).

### P2 — Post-migration cleanup (Next.js + Neon cutover, 2026-06-28)
- [x] **Update the GitHub Actions `DATABASE_URL` secret** — updated via `gh secret set DATABASE_URL` with the rotated value; CI confirmed green afterward.
- [x] **Fix `staging` branch CI** — regenerated `package-lock.json` (vitest/vite were never properly installed when added to `package.json` mid-migration) and updated `ci.yml`'s build env vars to the Next.js set. CI green on `staging`, merged into `main`.
- [x] **Investigate other failed GitHub Actions runs around the cutover** — two distinct, both benign: (1) Dependabot PR CI runs fail only on the `Build` step (`DATABASE_URL` missing) — GitHub Actions intentionally withholds repo secrets from Dependabot-triggered workflows for security; lint/type-check/test all pass fine, and the post-merge build on `staging`/`main` has full secret access. (2) Dependabot's own internal "Update" job fails trying to bump `postcss` — that's the version bundled inside `next`'s `node_modules` (see the postcss item below), which Dependabot can't resolve either. Neither is fixable or needs fixing.
- [x] **Delete dead Supabase-era scripts** — `scripts/populate-db.js`, `scripts/fediverse-fanout.js`, `scripts/backfill-historical.js`, `scripts/vote-tokens-migration.sql`, and `scripts/utils.js` (only ever used by the two deleted scripts) all deleted — superseded by `src/app/api/cron/daily-weather/route.ts`.
- [x] **Delete `.github/workflows/backfill-historical.yml`** — deleted.
- [x] **Delete the now-redundant `.github/workflows/ci-nextjs.yml`** — deleted.
- [x] **Send a test Mastodon Follow** — confirmed via unfollow → re-follow round-trip from `mastodon.nz/@Pat`; `GET /actor/followers` shows 3 followers including `mastodon.nz/users/Pat`. Inbox correctly processes both `Follow` and `Undo{Follow}` activities in production.
- [x] **Trigger the production cron once** (`/api/cron/daily-weather`) — manually invoked with the real `CRON_SECRET` against the live domain: `{"ok":true,"stored":93,"today":{...},"fanout":"skipped — not a good day"}`. Verified in Neon — today's row updated with the exact values, vote counts correctly untouched by the upsert. The route logic is confirmed correct in production; the automatic `0 12 * * *` schedule itself is Vercel's responsibility (sends the same authenticated request) and wasn't separately observed firing.
- [x] **Remove Supabase env vars** — the 5 GitHub Actions secrets removed via `gh secret remove`; the same vars removed from Vercel manually via the dashboard.
- [x] **Delete the now-unused `can-you-beat-wellington-nextjs` Vercel project** — deleted manually via the dashboard; confirmed gone via `list_projects`.
- [x] **Update this CLAUDE.md's stack description, infrastructure table, architecture notes, and key files table** — done; all now describe the Next.js + Neon architecture.
- [x] **Delete the `nextjs` branch** — deleted (remote and local). It carried one extra commit not in `staging`/`main` (a docs-only `CLAUDE.md` update, content fully superseded by later commits directly on `main`) — confirmed safe to discard before deleting.

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
- [x] **ESLint v9 flat config migration** — obsolete, resolved as a side effect of the Next.js migration: `create-next-app`'s scaffolding (Phase 1) already set up ESLint v9 with a proper flat config (`eslint.config.mjs`, `eslint-config-next/core-web-vitals` + `/typescript`); no `.eslintrc.cjs` exists anymore. The Dependabot ignore rule that exists now (`dependabot.yml`) is about a *different*, later bump — v9→v10, blocked on `eslint-plugin-react` not supporting v10 yet — unrelated to this item.
- [x] **Add test coverage for `src/lib/weather.ts`** — `src/lib/__tests__/weather.test.ts`, 17 tests. Mocks `../db`'s `sql` export and stubs global `fetch`. Covers `getTodaysNZTDate()` (format + UTC/NZT day-rollover at the UTC+12/13 boundary), the DB-backed reads/writes (`getTodaysRecord`, `getHistoricalRecords`, `getAllHistoricalRecords`, `upsertWeatherRecord`), `fetchLiveWeather()`'s response-shape guard, and `fetchAndStoreBatch()`'s guard (added in the P2 fix above) plus its future-date filtering.

### P3 — Infrastructure
- [x] **Migrate database from Supabase to Neon** — ✅ DONE as of 2026-06-28. Didn't follow this original sketch literally — see the full **Migration Spec** below (Phases 0–10) for what actually happened: a parallel Next.js + Neon rebuild on the `nextjs` branch, tested independently, then cut over via `nextjs` → `staging` → `main`.

### P3.5 — Historical data
- [x] Retrieve pre-2026 weather data — `scripts/backfill-historical.js` uses archive API; triggered via GitHub Actions "Backfill Historical Weather" workflow (2020-01-01 → 2025-12-31). Uses daily `precipitation_sum` (full day, slightly more conservative than daytime-only).

### P4 — Feature improvements
- [x] **Daily weather cron job** — GitHub Actions runs `scripts/populate-db.js` at 12:00 UTC (midnight NZST) daily; upserts idempotently so also backfills any missed days. (Superseded by Vercel Cron post-migration — see Changelog in `CLAUDE.md`.)
- [x] Make voting tamper-resistant — `vote_tokens (token, date)` table enforces one vote per browser identity per day at DB level; `increment_vote()` updated to accept `voter_token` arg; unique constraint violation (23505) rejects duplicate votes server-side.
- [x] Adjust good-day rules to account for seasons — six-season Shitsville calendar with seasonal temp thresholds; `rulesStorage.ts` is source of truth
- [x] Staging environment — `staging` branch auto-deploys to Vercel preview URL; shares the production Neon DB since the 2026-06-28 migration
- [x] **Scenario-based verdict quips** — `src/utils/quips.ts`; 8 failure-scenario arrays (GOOD / WIND_ONLY / RAIN_ONLY / TEMP_ONLY / WIND_RAIN / WIND_TEMP / RAIN_TEMP / ALL_BAD)
- [x] **7-day good day forecast** — Open-Meteo already returns 7 days; `ForecastStrip` component shows each day's verdict (✓/✗) + temp + forecast summary quip
- [x] **Special dates system** (2026-06-28) — see the **Special Dates** section in `CLAUDE.md` for the live catalogue. New `special_date_defs`/`special_date_occurrences` Neon tables support fixed-rule annual holidays (small `nth_weekday`/`fixed`/`easter_offset` rule DSL, auto-regenerated yearly via the daily cron), manually-curated moveable festivals (Cuba Dupa, WOW, Beervana, Matariki — entered by hand each year, never auto-generated), and sporting events with a semi-automated pending→confirmed resolution (`POST /api/admin/resolve-sporting`, same `Bearer` pattern as `CRON_SECRET`, via `ADMIN_SECRET`). Each occasion can override the quip, background (`src/utils/specialBackgrounds.ts`), trigger a confetti/balloon effect (`SpecialDateEffect.tsx`), link to an event page, and — the headline mechanic — flip the entire weather verdict ("a Wellington team winning forces a good day regardless of weather"). Calendar shows a sparkle badge. Data layer: `src/lib/special-dates.ts`, 22 tests. Also extracted `src/lib/ap-posting.ts` (was duplicated between the cron and `scripts/announce.js`) and fixed `announce.js`'s import, broken since the migration.
- [x] **Seed real special dates** (2026-06-28) — 17 defs / 30 occurrences (2026–2027) written to Neon: all 11 fixed-rule NZ public holidays, the 4 moveable festivals with real dates/links, the Hurricanes' actual Super Rugby Pacific Grand Final win (seeded retroactively as `confirmed`/`won`), and the All Blacks v Italy test at Sky Stadium on 2026-07-11 (seeded `pending`). Wellington Sevens dropped (no longer a real event); `specialBackgrounds.ts`'s unused `sevens` key replaced with `rugby` and `festive`.
- [x] **Add `ADMIN_SECRET` to Vercel + GitHub secrets** — added by the user; `/api/admin/resolve-sporting` is live in production.
- [x] **Auto-post to social media on good days** — live in production via the daily cron's ActivityPub fanout (`postToFollowers()` in `src/lib/ap-posting.ts`, called from `src/app/api/cron/daily-weather/route.ts` when `isGood`). This predates the Next.js migration (originally a GitHub Actions + Mastodon REST integration) and carried through the rebuild unchanged in intent, just reimplemented as part of the ActivityPub Note/Create flow — the backlog checkbox was simply never updated until this cleanup pass.
- [x] **ActivityPub follow instructions on About page** — added a "Follow on the fediverse" section to `src/app/about/page.tsx`, between "The rules" and the footer attribution. Handle shown in a `<code>` block (`select-all` for easy copying), with a one-line note that it only posts on good days.
- [x] **Blog links on About page** — "The rules" section links to [the Shitsville rule-change post](https://radomski.co.nz/blog/shitsville); the footer attribution links to [the full build/rebuild series tag](https://radomski.co.nz/blog/tag/can-you-beat-wellington).

### P5 — Nice to have
- [x] Add unit/integration tests — Vitest + jsdom; wired into CI
- [x] Set up Dependabot — weekly Monday updates targeting `staging`; ESLint major bumps ignored (v9 requires flat config migration)
- [x] Update React Router to 7.x — cleared XSS vuln; API unchanged for our usage (`BrowserRouter`, `Routes`, `Route`, `Link`) (pre-migration; React Router itself was removed entirely once Next.js's own App Router took over routing)

---

## Migration Spec — Next.js + Neon rebuild ✅ COMPLETE (cut over 2026-06-28)

Full rebuild of the stack using the current (Vite + Supabase) app as the functional spec. UI and feature parity was the goal — no new features during the migration. The rebuild happened on a long-lived `nextjs` branch; production was untouched until cutover.

**Why:** Single source of truth for the daily verdict (eliminates the home/history divergence class of bug), SSR makes the page indexable by search engines, no client-side DB credentials, no Supabase auto-pause workaround, consistent with every other project in the portfolio.

**New stack:** Next.js 15 App Router · TypeScript throughout · @neondatabase/serverless · Vercel Cron (replaces GH Actions daily weather) · shadcn/ui + Tailwind (unchanged) · Vercel KV (unchanged, ActivityPub) · Vitest (unchanged)

### Phase 0 — Pre-migration housekeeping (done on `main` first)
- Fixed `storeMutate` in useEffect dep array (Index.jsx); validated Open-Meteo response shape (hourly array length guard); confirmed dead scripts already removed; confirmed `calculateSunniness` already deduplicated via `scripts/utils.js`.

### Phase 1 — Scaffold & routing ✅
- `create-next-app` (Next.js 16.2.7, App Router, TypeScript, Tailwind v4, `src/`); removed Vite-specific files; ported `rulesStorage.js` → `.ts`; ported shadcn/ui components; created stub pages; verified `npm run build`.
- **Deployment**: a **separate Vercel project** (`prj_0EQkWQTcejggxOEqqCEI87GhCuVE`) was created rather than repointing the existing one — the existing `can-you-beat-wellington` project had `framework: "vite"` locked at the project level, and switching it would have broken the live `main` build mid-migration. A Deploy Hook targeted the `nextjs` branch for isolated preview testing.

### Phase 2 — Neon database (test instance) ✅
- Created Neon project `can-you-beat-wellington` (`dawn-queen-51598624`) in `aws-ap-southeast-2`, via the dashboard (the MCP `create_project` tool ignored region hints and landed two test projects in random US regions first).
- Schema DDL (`daily_weather_records`, `vote_tokens`, `increment_vote()` function) run via `mcp__claude_ai_Neon__run_sql_transaction`.
- **Data migration**: no `psql`/DB password available locally for either side, so migrated via SQL round-trips through the Supabase and Neon MCP tools — generated batched `INSERT ... ON CONFLICT DO NOTHING` statements on the Supabase side, executed verbatim against Neon. Row counts matched exactly: `daily_weather_records` 2345 ↔ 2345, `vote_tokens` 23 ↔ 23.
- Installed `@neondatabase/serverless`; created `src/lib/db.ts`.

### Phase 3 — Server-side data layer ✅
- `src/lib/weather.ts` (`getTodaysNZTDate`, `getTodaysRecord`, `getHistoricalRecords`, `upsertWeatherRecord`), `src/lib/votes.ts` (`castVote`, translating Postgres `23505` into `{ alreadyVoted: true }`), `src/types/db.ts`. Verified end-to-end against the live Neon DB.

### Phase 4 — Home page ✅
- `app/page.tsx` as a Server Component: fetches today's record + live weather in parallel, seeds a row if missing, computes the verdict server-side, `revalidate = 3600`.
- `VotingButtons` ported as a client component calling a Server Action (`src/app/actions/vote.ts`).
- Added `src/instrumentation.ts` — forces IPv4-first DNS resolution at server startup. Without it, Node's `fetch` (undici) intermittently threw `ConnectTimeoutError` connecting to the IPv4-only `api.open-meteo.com`; `dns.setDefaultResultOrder("ipv4first")` fixed it reliably. Worth keeping in production too as a general undici/IPv4-only-host risk mitigation.

### Phase 5 — About and History pages ✅
- Both ported as Server Components with client islands for recharts/react-day-picker (which require `'use client'`). `FunFacts` deliberately stayed a Server Component (not client) — picking the random fact at request time avoids a hydration mismatch a client-side `useMemo` would cause.
- Installed `recharts` (missing from `package.json` since Phase 1 never carried it over).

### Phase 6 — Daily weather cron ✅
- `app/api/cron/daily-weather/route.ts` — fetches last 92 days + today, upserts, evaluates verdict, fans out to ActivityPub on good days, `CRON_SECRET` bearer check.
- Deleted `.github/workflows/daily-weather.yml` and `.github/workflows/supabase-keepalive.yml` (Neon doesn't pause, no keepalive needed).

### Phase 7 — ActivityPub ✅
- All `api/*.js` handlers ported to Route Handlers placed directly at their public URLs (`/actor`, `/.well-known/webfinger`, `/actor/inbox`, `/actor/outbox`, `/actor/followers`, `/notes/[id]`) — no `vercel.json` rewrites needed, unlike the Vite app. Same AP keys/KV env vars throughout — zero follower disruption.

### Phase 8 — TypeScript, tests, CSP ✅
- Converted the last `.js` file (`quips.js`) to TypeScript. Added Vitest, `vitest.config.ts`, ported `rulesStorage.test.ts` (50 tests). Added `tsc --noEmit` to a temporary `ci-nextjs.yml` (needed `DATABASE_URL` as a GitHub secret for `next build`'s static pre-render).

### Phase 9 — Testing on the `nextjs` preview URL ✅
- Verdict correctness, voting, and ActivityPub WebFinger all confirmed directly against Neon/the live deployment.
- Found and explained a real (non-bug) 17-day data gap: Vercel Cron only runs against a Production deployment, and every Production deployment on the preview project had been failing (triggered by `main`/Dependabot pushes containing the old Vite app). Self-healed once the cron was triggered manually — it fetches the last 92 days every run and upserts idempotently.
- `AP_PUBLIC_KEY`/`AP_PRIVATE_KEY` skipped on preview (marked sensitive in Vercel, can't be copied without rolling) — deferred to Phase 10 cutover, same key pair, no roll needed.

### Phase 10 — Cutover ✅
- Switched the `can-you-beat-wellington` Vercel project's framework preset from `vite` to `nextjs` via the dashboard.
- Delta export/restore (same MCP SQL round-trip approach as Phase 2): 20 weather rows + 3 real votes newer than the Phase 2 snapshot, merged with Supabase as source of truth — this also overwrote test-pollution data Phase 9 had left in Neon for the same date range.
- Row counts verified matching exactly before cutover: `daily_weather_records` 2365 ↔ 2365, `vote_tokens` 26 ↔ 26.
- Merged `nextjs` → `staging` (clean fast-forward; first deploy failed on missing `DATABASE_URL`, fixed by adding env vars) → smoke-tested → merged `staging` → `main` (conflicts in `CLAUDE.md`/`package.json`/`package-lock.json`, resolved by taking `staging`'s version; post-merge CI broke on stale `ci.yml`, fixed same-day by regenerating the lockfile and updating CI's build env vars).
- Verified live on `canyoubeatwellington.radomski.co.nz`: correct verdict/weather/vote count, CSP no longer references Supabase, `/actor` returns the same public key as before (zero follower disruption).
- **Rotated the Neon DB password** — it had appeared in plaintext in a chat session via an MCP tool call (an attempted shell command using it was blocked by the safety classifier before execution, but the connection string had already been displayed by the tool call itself). User rotated the `neondb_owner` password and redeployed.

### Env var changes
| Variable | Action |
|----------|--------|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Removed |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Added (Neon pooled / direct) |
| `CRON_SECRET` | Added (protects `/api/cron/daily-weather`) |
| `AP_PRIVATE_KEY`, `AP_PUBLIC_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Unchanged |

### Risk register
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| ActivityPub followers drop off during cutover | Low | Same Vercel project, same KV, same actor URL and key pair — followers see no change |
| Vote data lost in delta between Phase 2 and cutover | Low | Final delta export on cutover day captured the gap; restored before switching env vars |
| Neon connectivity from Vercel Edge Runtime | Low | `@neondatabase/serverless` is designed for this; tested in Phase 9 |
| Recharts / react-day-picker not compatible with RSC | Medium | Marked those components `'use client'`, passed data as props — standard pattern |
| Vercel Cron timing vs GitHub Actions timing | Low | Same schedule (`0 12 * * *`); GH Actions workflow deleted only after Vercel Cron confirmed working |

### Decision log

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-06-08 | Migrate Supabase → Neon data via SQL round-trips through MCP, not `pg_dump`/`COPY` | No `psql` or DB password available locally for either side; generated batched `INSERT ... ON CONFLICT DO NOTHING` text on the Supabase side with `string_agg`/`format`, executed verbatim against Neon. Verified row counts match exactly (2345 weather records, 23 vote tokens) |
| 2026-06-08 | Create the Neon project via the dashboard, not the MCP `create_project` tool | The MCP tool has no `region_id` parameter and lands projects in random US regions (got `us-east-2`, then `us-east-1`) — can't target `aws-ap-southeast-2` to match the other projects and minimise Vercel Sydney latency. Dashboard creation lets you pick the region directly |
| 2026-04-09 | Migrate hosting to Vercel | User familiar with Vercel; enables preview deploys natively |
| 2026-04-09 | Supabase: cron ping to prevent pausing | Free solution; no migration needed (superseded — Neon doesn't pause) |
| 2026-04-09 | Remove CSVGen page | One-off seeding tool with hardcoded API key |
| 2026-04-09 | Remove `is_good_day` from DB | Rules may change seasonally; compute at runtime from `rulesStorage.js` |
| 2026-04-09 | Start DB fresh from 90 days | archive-api unreachable from Codespace; retrieve older data locally later |
| 2026-04-09 | Keep Supabase free tier | Pause solved by cron ping; no need to migrate or upgrade yet (superseded by the Neon migration) |
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
| 2026-06-08 | Create a separate Vercel project for the `nextjs` branch (rather than repointing the existing project) | Existing `can-you-beat-wellington` Vercel project has `framework: "vite"` locked at the project level; switching it to Next.js would break `main`'s production Vite build. A second project (Deploy Hook scoped to `nextjs`) gives an isolated, working preview URL for migration testing with zero prod risk |
| 2026-06-08 | Fix cron "today" computation to use NZT, not UTC | `toISOString().split('T')[0]` returns the UTC date, causing the fediverse fan-out and populate-db scripts to evaluate the wrong calendar day around the 12:00 UTC run boundary (NZ is UTC+12/+13) — caused a missed "good day" notification on 2026-06-08. Switched to `toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' })` |
| 2026-06-08 | Force IPv4-first DNS resolution via `src/instrumentation.ts` | Node's `fetch` (undici) intermittently threw `ConnectTimeoutError` connecting to `api.open-meteo.com` from the dev sandbox — `curl` against the same host from the same shell succeeded immediately and `dns.lookup` only returned an IPv4 address. Calling `dns.setDefaultResultOrder("ipv4first")` in the `register()` hook fixed it reliably |
| 2026-06-09 | Place ActivityPub routes at public URLs (`/actor`, `/.well-known/webfinger`, etc.) not under `/api/` | The existing actor's `id` field is `https://domain/actor`, not `/api/actor` — mismatching would break existing followers. Placing routes at the correct public paths in Next.js App Router eliminates the `vercel.json` rewrites the Vite app required |
