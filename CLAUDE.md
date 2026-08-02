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
| Daily weather + fediverse fan-out | Vercel Cron at 21:30 UTC daily (`/api/cron/daily-weather`) — ≈10am NZT (10:30 NZDT / 9:30 NZST; Vercel Cron is UTC-only, no timezone option, so this drifts ±30 min across NZ's DST transition) |
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
- [x] **Resolve the `next`-bundled `postcss` moderate vulnerability** (2026-07-14) — no stable Next carries the fix (16.2.10 still pins postcss 8.4.31; only 16.3 canaries have 8.5.10), so an npm `overrides` entry in `package.json` forces `next`'s nested copy to 8.5.10 (semver-minor, API-compatible). `npm audit` reports 0 vulnerabilities; Dependabot alert #65 closes with it.
- [x] **Bump the `postcss` override again, 8.5.10 → 8.5.19** (2026-07-24) — a second, unrelated `postcss` advisory (arbitrary file read via attacker-controlled `sourceMappingURL` in CSS comments, high severity, patched at 8.5.12) was published after the first fix landed; the exact `8.5.10` pin from 2026-07-14 fell squarely in the new vulnerable range. This time CI's `Audit` step caught it on `staging` *before* the fast-forward to `main` — exactly the failure mode the item below is about, working as intended.
- [ ] **Drop the `postcss` override once Next 16.3.x stable ships** — the `overrides.next.postcss` entry in `package.json` becomes redundant when Next bundles a patched version itself; remove it during that upgrade so npm resolves Next's own pin again.
- [x] **Resolve four more Dependabot alerts surfaced 2026-07-23** — `next`/`eslint-config-next` bumped 16.2.9 → 16.2.11 (fixes nine Next.js CVEs: SSRF in Server Actions/rewrites, DoS, cache confusion, unauthenticated Server Function disclosure — a real runtime fix, unlike the build-time-only postcss issue); `sharp` overridden 0.34.5 → 0.35.3 (libvips CVEs; safe since the app never imports `next/image`, so the vulnerable code path is dead weight regardless); `brace-expansion` overridden per-exact-version (`minimatch@3.1.5` → 1.1.16, `minimatch@10.2.5` → 5.0.7 — two different consumers pin different brace-expansion majors, so the override keys target the exact `minimatch` version via npm's `"pkg@version"` override syntax rather than a blanket bump that would break the older one); `js-yaml` overridden 4.2.0 → 4.3.0 under `eslint`'s own `@eslint/eslintrc` dependency. All four were dev-tooling/build-time except the Next.js bump. `npm audit` back to 0 vulnerabilities.
- [ ] **Fix CI's silent audit gap** — the two commits that introduced these four vulnerabilities (the severity-quips feature commit, unrelated to the deps themselves) failed CI's `Audit` step on both `staging` and `main` after push, and were merged/fast-forwarded before that was noticed. `ci.yml`'s `Audit` step already runs `--audit-level=high` and should have blocked the merge — worth adding a branch-protection check requiring CI to pass before `main` accepts a fast-forward, since right now a red Audit run doesn't stop anything.
- [x] **Scope CI's `Audit` step to production dependencies** (2026-07-24) — `npm audit --audit-level=high` → `--omit=dev`. Root cause: `GHSA-mh99-v99m-4gvg` (`brace-expansion` unbounded-length DoS) has no fix compatible with the old `minimatch@2.x/3.x` line that ESLint's own plugin ecosystem (`eslint-plugin-import`/`-jsx-a11y`/`-react`, `@eslint/config-array`, `@eslint/eslintrc`) still depends on — the only listed patch (5.0.8) changes the module's export shape (`module.exports = fn` → `{ expand: fn }`), confirmed by direct test to break `require('brace-expansion')(str)` call sites. Tried bumping `eslint` 9→10 first (its *own* dependency moves to modern `minimatch@^10`), but `eslint-config-next`'s bundled plugins pull the vulnerable chain in independently of the top-level `eslint` version, so it didn't help and was reverted. That chain is 100% devDependency/build-time lint tooling — never shipped, never touches untrusted input — so gating CI on it forces either a broken lint setup or a permanently-red pipeline for a finding with no real exposure. `--omit=dev` reports 0 vulnerabilities; re-add full-scope auditing once upstream ships a compatible `minimatch` bump (worth an occasional `npm audit` check, not just waiting for Dependabot — dev-scope alerts don't always surface the same way).
- [x] **Resolve two more Dependabot alerts surfaced 2026-07-24** — a *third*, distinct `postcss` advisory (path traversal via `sourceMappingURL`, patched at 8.5.18) was published after the 8.5.19 bump above landed — that bump already cleared it, but it exposed that the override was scoped to `next`'s nested copy only, missing two *other* independent `postcss` installs (`@tailwindcss/postcss`, `vitest`→`vite`) that were still on 8.5.16. Moved the override to top-level (`overrides.postcss`, not nested under `next`) so all three resolve to the same patched version. The `brace-expansion` DoS above is the second alert, tracked as "no fix available" rather than resolved.

### P4 — Feature improvements
- [x] **Allow Mastodon quote posts on outgoing Notes** (2026-08-03) — added `interactionPolicy.canQuote.automaticApproval: [Public]` + the matching `@context` terms (copied verbatim from a live Mastodon post's own JSON, since third-party write-ups disagreed on the exact `gts:` namespace) to every outgoing Note in `ap-posting.ts` and `scripts/announce.js`. This is the static "I consent to being quoted" declaration; per FEP-044f, the *full* mechanism also expects our inbox to handle an incoming `QuoteRequest` activity and answer with a signed `QuoteAuthorization`, otherwise quotes may sit "pending" outside the quoter's own instance. Didn't implement that handshake yet — couldn't find a verified-exact JSON shape for `QuoteRequest`/`QuoteAuthorization` (only paraphrased third-party accounts, no live example to check against like the static field had). The static field alone should already fix the outright "you are not allowed to quote this" block, since a real Mastodon post's default (no explicit opt-in) is author-only auto-approval, confirmed by inspecting a live example — worth confirming with a real quote attempt post-deploy, and following up with the full handshake if quotes still show "pending" rather than going through.
- [ ] **Bot's own ActivityPub actor still isn't showing a verified profile link** — added a self-referential `<link rel="me">` on the homepage (2026-08-01) on the theory that Mastodon's rel=me check is a literal href string-match with no stated same-page restriction, matching the actor's `url` (== the homepage) to its own "Website" attachment field (also == the homepage). Confirmed via the user's own check still not verified after that change. (Separately, `@Pat@mastodon.nz`'s *personal* account was already showing verified for this same URL both before and after that same deploy — pre-existing, unaffected either way, so it's not evidence the fix mechanism works, just that it wasn't broken by it.) Two live theories for the actor's own field, unconfirmed either way: (a) Mastodon's field-verification worker may only run for `type: Person` actors, skipping `Service`/`Application`/`Group` — our actor is `Service` — or (b) the self-referential case genuinely doesn't work and needs a distinct page to point *to* (e.g. change the attachment to point somewhere our `url` isn't, or vice versa). Needs a look at Mastodon's actual source (`app/workers/verify_account_links_worker.rb` or equivalent) rather than more guessing from docs/blogs.
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

- **2026-08-03** — Added FEP-044f `interactionPolicy` (public quote consent) to every outgoing Note, fixing Mastodon's outright "you are not allowed to quote this" block on the daily good-day posts — the exact JSON-LD `gts:` context terms were verified against a live Mastodon post's own ActivityPub JSON rather than trusted from third-party write-ups, which disagreed with each other. The deeper `QuoteRequest`/`QuoteAuthorization` inbox handshake FEP-044f also describes is not yet implemented (P4 backlog) — no verified-exact JSON shape found for it yet, unlike the static field. Separately investigated why the bot's own actor profile link still doesn't show verified on Mastodon after the 2026-08-01 fix attempt (P4 backlog) — confirmed via user report that the self-referential `rel="me"` theory hasn't produced a visible verified badge; two follow-up theories logged, neither confirmed.
- **2026-07-24** — Moved the daily cron from 12:00 UTC (≈midnight NZT — originally chosen as "midnight NZST" pre-migration, see `CLAUDE_ARCHIVE.md`) to 21:30 UTC (≈10am NZT), after feedback that the ActivityPub good-day announcement was firing in the middle of the night and reads oddly to followers. Vercel Cron has no timezone option (UTC only), so a fixed schedule can't track NZ's daylight-saving transition; 21:30 UTC splits the difference evenly (10:30am NZDT / 9:30am NZST) rather than favouring one season. Config-only change (`vercel.json`), no code touched. Worth knowing: the "good day" verdict used for the fan-out decision is whatever Open-Meteo returns for the still-partially-elapsed day at cron time — the daytime window is 6am–6pm, so at 10am roughly a third of it is observed and the rest is same-day forecast. The stored record self-corrects with fully observed data on the *next* day's cron run (`fetchAndStoreBatch` re-upserts all 92 past days every run), but a post that already went out doesn't get retracted if the afternoon doesn't pan out as forecast — pre-existing behaviour, not introduced by this change, just more exposed by moving off a near-midnight run where forecast/actual mattered less to anyone watching the clock.
- **2026-07-24** — Fixed the browser tab favicon, which had shown Vercel/Next's default triangle logo since the migration: `src/app/favicon.ico` was a leftover `create-next-app` scaffold file, never replaced with the real design (a black-circle "W" mark, `public/favicon.svg`, added pre-migration but never wired into Next's file-based icon convention). Rebuilt `favicon.ico` from the SVG at 16/32/48px (hand-assembled to avoid a third-party ico tool bloating it with a blurry auto-upscaled 256px frame), and added `src/app/icon.svg` so modern browsers get a crisp SVG favicon. Also deleted `public/favicon.ico` — an unrelated, unreferenced terminal-icon file dating back to the original pre-Lovable project scaffold, dead weight since day one.
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
6. Daily cron (`/api/cron/daily-weather`, Vercel Cron at 21:30 UTC ≈ 10am NZT) re-fetches 92 days of Open-Meteo data, upserts to Neon, regenerates next year's fixed-rule special dates if missing, and fans out an ActivityPub `Create{Note}` to followers via Vercel KV + signed HTTP delivery if today is a good day (weather or override)

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
