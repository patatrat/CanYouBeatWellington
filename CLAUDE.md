# CLAUDE.md — Can You Beat Wellington?

Project tracking, backlog, and architectural decisions. Completed backlog items and the full Next.js + Neon migration history live in [`CLAUDE_ARCHIVE.md`](CLAUDE_ARCHIVE.md) — this file stays focused on what's current and what's still open.

## Project Overview

A hobby webapp that checks if today's weather in Wellington, NZ is good enough that you "can't beat it". Users can vote agree/disagree. Historical data stored in Neon (Postgres), visualised on the About page. Fully migrated from a Vite SPA + Supabase to Next.js + Neon on 2026-06-28 — see the Changelog below, and `CLAUDE_ARCHIVE.md` for the full rebuild history.

- **Live**: https://canyoubeatwellington.radomski.co.nz/
- **Repo**: https://github.com/patatrat/CanYouBeatWellington
- **Stack**: Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Neon (`@neondatabase/serverless`) + Vercel KV (ActivityPub) + Vitest
- **Analytics**: Vercel Analytics
- **Hosting**: Vercel (auto-deploys on push to `main`; `staging` branch deploys to a Vercel preview for pre-production testing)
- **Originally built with**: Lovable (formerly GPT Engineer) — legacy files removed

## Weather Assessment Rules

A "good day" requires ALL of (thresholds vary by season — see `rulesStorage.ts`):
- Max temperature ≥ seasonal minimum (13°C winter → 19°C summer)
- Max wind speed < 30 km/h (year-round)
- Daytime rain = 0 mm (year-round)

Six seasons: Summer (Jan–Mar), Autumn (Apr–Jun), Winter (Jul–Aug), Spring 1 (Sep), Shitsville (Oct–Nov), Spring 2 (Dec).
Computed at runtime from `rulesStorage.ts` — not stored in DB, so rules can change freely.
Data source: Open-Meteo API (free, no key required).

A non-weather **verdict override** can also force the verdict either way — see Special Dates below.

## Special Dates

The home page, daily cron, and History calendar all check a `special_date_defs`/`special_date_occurrences` Neon schema for active occasions on a given day — data layer in `src/lib/special-dates.ts`. Each occasion can override the quip, swap the background, trigger a confetti/balloon effect, link to an event page, and (sporting events only) flip the entire weather verdict ("a Wellington team winning forces a good day regardless of weather"). Three kinds:

- **`fixed_rule`** — annual holidays computed from a small rule DSL (`fixed:month:day`, `nth_weekday:n:month:weekday`, `easter_offset:days`), auto-regenerated each year by the daily cron (`ensureUpcomingOccurrences()`) — self-healing, no separate yearly cron needed
- **`moveable`** — festivals with no formula (gazetted/announced yearly); a new occurrence row needs entering by hand each year
- **`sporting`** — one-off fixtures; created `pending` ahead of a game, resolved afterward via `POST /api/admin/resolve-sporting` (`ADMIN_SECRET` bearer auth, same pattern as `CRON_SECRET`)

Current catalogue (`special_date_defs` — occurrence dates live in Neon, not here, since they change yearly):

| Slug | Kind | Rule / notes | Effect | Background |
|------|------|---------------|--------|------------|
| `new-years-day` | fixed_rule | Jan 1 | confetti | festive |
| `day-after-new-years` | fixed_rule | Jan 2 | none | — |
| `wellington-anniversary-day` | fixed_rule | 4th Mon Jan | confetti | anniversary |
| `waitangi-day` | fixed_rule | Feb 6 | none | — |
| `good-friday` | fixed_rule | Easter Sunday − 2 days | none | — |
| `easter-monday` | fixed_rule | Easter Sunday + 1 day | none | — |
| `anzac-day` | fixed_rule | Apr 25 | none | — |
| `kings-birthday` | fixed_rule | 1st Mon Jun | none | — |
| `labour-day` | fixed_rule | 4th Mon Oct | none | — |
| `christmas-day` | fixed_rule | Dec 25 | confetti | festive |
| `boxing-day` | fixed_rule | Dec 26 | none | — |
| `matariki` | moveable | gazetted yearly, no formula (2026: Jul 10, 2027: Jun 25) | none | matariki |
| `cuba-dupa` | moveable | usually late March | confetti | — |
| `wow` | moveable | World of WearableArt, usually Sep–Oct | confetti | — |
| `beervana` | moveable | usually August | confetti | — |
| `hurricanes-grand-final-2026` | sporting | won 2026-06-20 vs Chiefs — `verdict_override=true`, `confirmed` | confetti | rugby |
| `all-blacks-v-italy-2026-07-11` | sporting | 2026-07-11, Sky Stadium — `pending`, awaiting resolution | confetti | rugby |

Solemn/civic holidays (ANZAC Day, Waitangi Day, Good Friday, King's Birthday, Labour Day) deliberately have no celebration effect. When two occasions overlap a day, `pickPrimarySpecialDate()` picks the narrower date range, tie-broken by start date then occurrence id — see `src/lib/__tests__/special-dates.test.ts`.

## Infrastructure

| Concern | Solution |
|---------|---------|
| Hosting | Vercel (auto-deploys on push to `main`/`staging`) |
| Database | Neon Postgres, free tier (project: `can-you-beat-wellington` / `dawn-queen-51598624`) — no auto-pause, unlike Supabase |
| Daily weather + fediverse fan-out | Vercel Cron at 12:00 UTC daily (`/api/cron/daily-weather`) |
| ActivityPub federation | Vercel KV (Upstash Redis) for follower list + outbox notes |
| CI | GitHub Actions (`ci.yml`) — lint + type check + test + build + audit on every push/PR to `main`/`staging` |
| Secrets | GitHub repo secrets + Vercel env vars — `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `CRON_SECRET`, `ADMIN_SECRET`, `AP_PUBLIC_KEY`, `AP_PRIVATE_KEY`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` |
| DNS | Cloudflare (DNS-only, grey cloud) → Vercel |
| **Legacy (pending removal)** | Supabase project still exists as an archived snapshot; `VITE_SUPABASE_*`/`SUPABASE_*` env vars already removed from Vercel/GitHub |

---

## Backlog

### P2 — Post-migration cleanup
- [x] **Run the occurrence unique index in Neon** (2026-07-02) — `special_date_occurrences_def_start_key ON (def_id, start_date)` created in production by hand (automated DDL was permission-blocked); `db/schema.sql` documents it, and `ensureUpcomingOccurrences()`'s `ON CONFLICT DO NOTHING` race guard is now fully backed.
- [ ] **Delete the Supabase project** (Settings → General → Delete project) once production has been stable for a while — deliberately holding off; all data already migrated and verified.
- [ ] **Monitor the `next`-bundled `postcss` moderate vulnerability** — a patched `postcss` (8.5.10) exists, but Next.js only picks it up from `16.3.0-canary.6`; every stable Next release through 16.2.9 (current, via Dependabot PR #47 merged 2026-07-02) still bundles the vulnerable copy. Build-time-only dependency, so real exposure is negligible — clear it by taking Next 16.3.x stable when it ships. `npm audit --audit-level=high` in CI stays green meanwhile (advisory is moderate).

### P4 — Feature improvements
- [ ] **NZ-specific vocabulary** — build a word bank ("munted", "choice", "sweet as", "mean as", "stoked", "gutted", "staunch") to weave into quips in `quips.ts`
- [x] **User sharing** (2026-06-29) — `src/components/ShareButtons.tsx` on the About page. Bluesky uses its one compose-intent URL; Mastodon has no single domain, so the button asks once for the user's instance and remembers it in `localStorage` for next time, then opens that instance's `/share?text=` compose URL. Plus a copy-link fallback. No API keys, no new data fetch — share text is a static line, matching the About page's existing fully-static nature.
- [ ] **Resolve the All Blacks v Italy fixture** (`all-blacks-v-italy-2026-07-11`) after the 2026-07-11 test — `POST /api/admin/resolve-sporting` with the result, exercising the semi-automated sporting workflow live for the first time. Since 2026-07-02 the endpoint answers 404 (unknown id) / 409 (already resolved) instead of a silent `ok` — a typo'd occurrence id will now be obvious.
- [ ] **Keep moveable special dates current** — Matariki/CubaDupa/WOW/Beervana occurrences only run through 2026–2027; add next year's real dates as they're announced (`special_date_occurrences`, manual insert — `fixed_rule` holidays self-heal via the cron, these don't)

### P5 — Nice to have
- [ ] **Timezone-aware date handling** — dates are stored as `YYYY-MM-DD` strings; a few places still parse them with `new Date(dateString)` (UTC midnight) instead of `date-fns/parseISO`, risking a ±1 day shift in NZ timezone (UTC+12/+13). Audit remaining call sites, particularly around `CalendarHistory`.

### P5 — Widgets & embeds
- [ ] **Embeddable widget for other websites** — small `<iframe>`-able route (e.g. `/widget`) showing today's verdict with no nav/chrome, sized for embedding via a copy-paste `<iframe>` snippet (simplest approach, avoids CORS entirely). Comparatively low effort — same Next.js app, one new minimal-layout route.
- [ ] **Desktop widget — macOS** — requires a native Swift/SwiftUI app with a WidgetKit extension; not web technology. Needs a small public JSON endpoint (e.g. `/api/widget-data`) for the widget to poll.
- [ ] **Desktop widget — Windows** — needs a native app (WinUI, or a thin web-view wrapper) calling the same JSON endpoint.
- [ ] **Mobile widget — iOS** — home screen widget via WidgetKit (Swift); could share most of a native shell with the macOS widget.
- [ ] **Mobile widget — Android** — home screen widget via Glance/RemoteViews (Kotlin).
  - **Scope note**: the four native widgets are a different category of effort from the rest of this backlog — each needs a real native app shell (Swift for Apple platforms, Kotlin for Android), code signing, and app store distribution (or at minimum local sideloading), not just a web feature. Worth treating as a separate mini-project if pursued. The embeddable web widget is far simpler and could ship first as a stepping stone — same underlying data, no native shell needed.

---

## Changelog

- **2026-07-02** — Security/correctness hardening pass across the migration + special dates work: ActivityPub inbox now verifies the signed `Digest` against the body, requires `(request-target)/host/date/digest` in the signature, rejects stale `Date` headers, and matches the body's `actor` against the signing key's actor (previously any fediverse account could spoof Follow/Undo for someone else); vote Server Action validates type/token and only accepts today's date (historical counts were client-rewritable); cron auth fails closed and both bearer checks are constant-time (`src/lib/auth.ts`); History calendar now applies `verdict_override` via shared `isGoodWeatherDay()`/`resolveVerdict()` (it was showing the Hurricanes-final forced good day as a red ✗); `resolve-sporting` returns 404/409 on no-ops instead of `ok`; AP fan-out parallelised with per-request timeouts, KV-cached inbox URLs, and a 1-year TTL on stored notes; dark special backgrounds (matariki/rugby) now swap to readable light text; home `revalidate` 3600→600 to shrink the stale-page window at NZ midnight; pure special-dates logic split into client-safe `special-dates-logic.ts`; Neon schema snapshot checked in at `db/schema.sql`. Deployed to production the same day (`staging` → fast-forward `main`, commit `e8ca49d`) and verified live: CI green, homepage/webfinger responding, unique index on `special_date_occurrences (def_id, start_date)` created in prod by hand, and the hardened inbox confirmed end-to-end via an unfollow → re-follow round-trip from `mastodon.nz/@Pat` (all 3 followers intact, Accept delivered, KV inbox cache populated).
- **2026-04 to 2026-06** — Hardened and polished the original Vite + Supabase app: RLS policies, security headers, seasonal weather rules (the "Shitsville" calendar), tamper-resistant voting, historical backfill, scenario-based quips, 7-day forecast.
- **2026-06-08 to 2026-06-28** — Rebuilt the entire stack as Next.js (App Router) + Neon, in parallel on a `nextjs` branch, tested independently on a separate Vercel project, then cut over via `nextjs → staging → main`. Zero ActivityPub follower disruption (same actor URL/keys throughout). Full phase-by-phase history, schema, env var changes, risk register, and decision log archived in `CLAUDE_ARCHIVE.md`.
- **2026-06-28** — Shipped the special dates system (see above) and seeded the first real catalogue: 17 defs / 30 occurrences across NZ public holidays, Matariki/CubaDupa/WOW/Beervana, and two rugby fixtures (the Hurricanes' actual Super Rugby Pacific Grand Final win, and the upcoming All Blacks v Italy test).

---

## Architecture Notes

### Data flow
1. Home page (`src/app/page.tsx`, Server Component) → calls `getTodaysRecord()` (Neon), `fetchLiveWeather()` (Open-Meteo), and `getActiveSpecialDates()` (Neon) in parallel
2. If today's row doesn't exist yet, it's seeded immediately from the live fetch so voting has something to attach to before the daily cron runs; the cron later overwrites it with the final full-day reading (idempotent upsert)
3. Verdict computed server-side via `getThresholds(date)`/`countCriteriaMet()` from `rulesStorage.ts`, then passed through `resolveVerdict()` — a special date's `verdict_override` wins if set, otherwise the weather verdict stands. Same logic on every page, no home/history divergence
4. History/About pages fetch the full record set from Neon via `getHistoricalRecords()`/`getAllHistoricalRecords()`, plus `getSpecialDatesForRange()` for the calendar's sparkle badges
5. Votes: `VotingButtons` (client component) calls the `castVoteAction` Server Action → `castVote()` in `src/lib/votes.ts` → `increment_vote()` Postgres function in Neon; a `vote_tokens (token, date)` unique constraint blocks duplicate votes per browser identity per day
6. Daily cron (`/api/cron/daily-weather`, Vercel Cron at 12:00 UTC) re-fetches 92 days of Open-Meteo data, upserts to Neon, regenerates next year's fixed-rule special dates if missing, and fans out an ActivityPub `Create{Note}` to followers via Vercel KV + signed HTTP delivery if today is a good day (weather or override)

### Key files
| File | Purpose |
|------|---------|
| `src/lib/weather.ts` | Neon queries — `getTodaysRecord`, `getHistoricalRecords`, `getAllHistoricalRecords`, `upsertWeatherRecord`, `fetchLiveWeather`, `fetchAndStoreBatch`, `getTodaysNZTDate` |
| `src/lib/special-dates.ts` | Special-dates DB layer — `getActiveSpecialDates`, `getSpecialDatesForRange`, `ensureUpcomingOccurrences`, `resolveSportingOccurrence`; re-exports all of `special-dates-logic.ts` |
| `src/lib/special-dates-logic.ts` | Pure special-dates logic + types (`pickPrimarySpecialDate`, `resolveVerdict`, `computeFixedRuleDate`) — no DB import, safe for client components like `CalendarHistory` |
| `src/lib/auth.ts` | `isBearerAuthorized()` — constant-time, fail-closed bearer check shared by the cron and admin routes |
| `db/schema.sql` | Reference snapshot of the Neon schema (tables, indexes, `increment_vote()`) — documentation, not a migration runner |
| `src/lib/votes.ts` | `castVote()` — wraps `increment_vote()`, translates the `23505` unique-violation into `{ alreadyVoted: true }` |
| `src/lib/db.ts` | Exports the `sql` Neon client (`@neondatabase/serverless`), reads `DATABASE_URL` |
| `src/lib/ap-posting.ts` | `postToFollowers()` — Note+Create assembly and fanout delivery, shared by the cron route and `scripts/announce.js` |
| `src/lib/http-signatures.ts` | HTTP signature sign/verify for ActivityPub delivery and inbox auth |
| `src/utils/rulesStorage.ts` | Seasonal weather criteria — `getThresholds(date)`, `getSeasonLabel(date)`, `countCriteriaMet(weather, date)`, `isGoodWeatherDay(weather, date)` (the single good-weather-day definition used by home/cron/calendar) |
| `src/utils/quips.ts` | Scenario-based verdict quips + forecast summary quips |
| `src/utils/specialBackgrounds.ts` | Code-side `background_key` → Tailwind gradient lookup (never raw CSS from the DB) |
| `src/utils/weatherFunFacts.ts` | Fun fact generation from historical data |
| `src/types/db.ts` | `DailyWeatherRecord` type matching the Neon schema |
| `src/app/page.tsx` | Home page — Server Component, the critical path |
| `src/app/history/page.tsx`, `src/app/about/page.tsx` | Server Components for historical charts/calendar and static rules content |
| `src/components/SpecialDateEffect.tsx` | Confetti (dynamically imported `canvas-confetti`) / balloon (CSS keyframes) celebration overlay |
| `src/app/api/cron/daily-weather/route.ts` | Daily cron handler — fetch, upsert, regenerate special dates, evaluate verdict, fan out on good days |
| `src/app/api/admin/resolve-sporting/route.ts` | Semi-automated sporting-result resolution, `ADMIN_SECRET` bearer auth |
| `src/app/actor/route.ts`, `src/app/actor/inbox/route.ts`, `src/app/actor/outbox/route.ts`, `src/app/actor/followers/route.ts`, `src/app/.well-known/webfinger/route.ts`, `src/app/notes/[id]/route.ts` | ActivityPub endpoints, placed at their public URLs directly (no rewrites needed) |
| `src/instrumentation.ts` | Forces IPv4-first DNS resolution at server startup (works around an intermittent undici/Open-Meteo connection issue) |
| `vercel.json` | Security headers, cache headers, Vercel Cron schedule |
| `.github/workflows/ci.yml` | Lint + type check + test + build + audit gate, runs on `main`/`staging` |
| `.github/workflows/announce.yml` | Manual one-off ActivityPub announcements via `workflow_dispatch` |
| `scripts/announce.js` | Delivers a one-off announcement to all followers (called by `announce.yml`) |
| `scripts/gen-ap-keys.js` | One-off RSA key pair generator for the ActivityPub actor |
