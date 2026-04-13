# What Lovable Built, and What We Had to Fix: Refactoring a Vibe-Coded Webapp

*Draft — basis for a blog post on the Can You Beat Wellington refactor*

---

## Background

[Can You Beat Wellington](https://canyoubeatwellington.radomski.co.nz/) is a hobby webapp with one job: check whether Wellington, NZ is having a genuinely good weather day (≥18°C, <20 km/h wind, 0 mm rain), and let people vote agree or disagree. Simple concept. A few hundred lines of real logic at most.

I built the first version using [Lovable](https://lovable.dev/) (formerly GPT Engineer) — an AI-assisted app builder that scaffolds a React + Supabase project from a prompt and lets you iterate by chatting. It's genuinely impressive for getting something live fast. Within an afternoon I had a working app deployed on Netlify with a Supabase backend.

Then I left it running for several months. When I came back to it, I started actually looking at what had been generated. This post is about what I found, what I fixed, and what I'd tell anyone else running a Lovable-generated app.

---

## What Lovable Generated

Lovable's default scaffold is a full shadcn/ui kitchen-sink setup. The first commit (`3605a54`, by `gpt-engineer-app[bot]`) included:

- **62 npm dependencies** — everything a large production app might ever need
- **48 shadcn/ui component files** — accordion, alert-dialog, avatar, checkbox, collapsible, context-menu, dialog, dropdown-menu, hover-card, menubar, navigation-menu, popover, progress, radio-group, scroll-area, select, separator, slider, switch, tabs, toast, toggle, toggle-group... and more
- **25 Radix UI packages** to back those components
- `framer-motion`, `zod`, `react-hook-form`, `cmdk`, `vaul` — none of which were used
- A `.gpt_engineer/` directory with telemetry and snapshot scripts committed to the repo
- A `gpt-engineer.toml` config file in the repo root
- A `bun.lockb` binary lockfile alongside an `npm` lockfile

For a weather checker that shows three numbers and two buttons. The generator doesn't know what you need — it installs everything, and leaves you to find out what you actually used.

---

## The Security Problems

This is the part that would concern me most if you're running a Lovable app you haven't audited.

### 1. Secrets committed to the repository

Lovable generates the Supabase client file and hardcodes the credentials directly into source:

```ts
// src/integrations/supabase/client.ts — as generated
const SUPABASE_URL = "https://xifhvoqdrmsunijcrakv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

This is a public GitHub repo. The anon key was committed and pushed on day one, and sat there for months. The Supabase anon key is technically "safe to expose" by design — it's rate-limited and RLS should restrict what it can do — but that only holds if RLS is actually configured. Which brings us to...

### 2. No Row Level Security

Lovable set up the Supabase tables but didn't configure RLS policies. The tables were wide open: any client with the anon key (i.e., anyone) could SELECT, INSERT, UPDATE, or DELETE any row directly. For a hobby app with no money on the line this is low risk, but it's the kind of thing that makes Supabase send you "your project has security warnings" emails.

**Fix:** We added explicit RLS policies — anon can SELECT and INSERT, but not UPDATE or DELETE directly. Votes go through a `SECURITY DEFINER` function (`increment_vote()`) which is the only thing allowed to modify vote counts. This means even if someone calls the Supabase API directly, they can't write arbitrary values.

### 3. Hardcoded API key in a page component

There was a `CSVGen` page — a one-off data seeding tool — that had a Visual Crossing weather API key hardcoded in the component source. This page was never linked in the nav (it was an `Admin` page left over from development), but it was deployed, publicly accessible, and the key was sitting in git history.

**Fix:** Delete the page. Delete the component. The key was for a free-tier API so the blast radius was small, but the lesson is real: Lovable generates pages for whatever you ask it to build during development, and those don't always get cleaned up.

### 4. Google Analytics with a placeholder measurement ID

At some point during development, the Lovable chat session added Google Analytics:

```html
<!-- As generated -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date()); 
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

The measurement ID was never replaced with a real one. The analytics code was loading, making network calls to Google, and tracking nothing — for months. This is a common pattern with AI-generated code: it produces structurally correct placeholders that look finished but don't work.

**Fix:** Remove it entirely, switch to Vercel Analytics (zero-config, one import).

### 5. No security headers

The deployed app had no CSP, no `X-Frame-Options`, no `Referrer-Policy`, no `Permissions-Policy`. Running it through [securityheaders.com](https://securityheaders.com) gave a D rating.

**Fix:** Added all the standard headers to `vercel.json`. The CSP took a few iterations — the YouTube embed broke it, recharts needed `unsafe-inline` for styles — but it's now properly locked down.

---

## The Performance Problems

### The bundle was 877 kB

The main JS chunk was 877 kB before any optimisation. This is entirely expected when you install recharts and react-day-picker into a project and load them synchronously on every page.

The `About` page — the only page that uses charts and a calendar — was bundled into the same chunk as the home page. Navigating to `/` loaded the full recharts library whether you ever clicked "About" or not.

**Fix:**
- Replaced `recharts` with a custom SVG line chart (~80 lines, zero deps)
- Replaced `react-day-picker` + the shadcn calendar component with a custom CSS grid calendar (~120 lines, zero deps)
- Lazy-loaded the entire `About` page via `React.lazy()` so those components only load on navigation

Result: **877 kB → 80 kB** on the main bundle. The "About" chunk only loads when someone actually clicks About.

The lesson: AI tools optimise for "works" not "fast". They reach for established libraries because that's what's in their training data. A human developer would ask "do I really need recharts for one line chart?" — the AI doesn't.

### 48 UI component files, 4 used

shadcn/ui is a copy-paste component library — you're supposed to add only the components you need. Lovable installed all of them. 44 of the 48 component files in `src/components/ui/` were never imported anywhere.

Deleting them and their backing Radix packages: CSS bundle went from **45 kB → 19 kB**.

---

## The Infrastructure Problems

### No CI pipeline

There was no automated build check. Lovable doesn't set up GitHub Actions. ESLint errors were accumulating in the codebase (Lovable doesn't always fix the lint warnings its own code produces), and they only surfaced when you ran the linter locally.

**Fix:** Added a CI workflow (lint → test → build → audit) that runs on every push and PR. This immediately caught several ESLint violations that would have blocked Vercel deploys.

### Supabase free tier was going to pause

Supabase pauses free-tier projects after a week of inactivity. The app would go dark whenever it hadn't had a real visitor recently. There was no solution to this.

**Fix:** GitHub Actions cron job that pings the database every 5 days. One workflow file, runs forever for free.

### No staging environment

Every change went straight to production. There was no way to validate a fix without shipping it.

**Fix:** `staging` branch auto-deploys to a Vercel preview URL. All development happens on `staging`, reviewed there, then merged to `main` which triggers the production deploy. The two environments share the same Supabase DB (acceptable for a hobby project).

### Netlify to Vercel

The original deploy was on Netlify. Nothing wrong with Netlify, but Vercel's preview deploy integration is tighter for Vite/React projects — the `vercel.json` SPA rewrite config is simpler, and preview URLs for branches are automatic.

### No automated dependency updates

Dependencies were frozen at whatever versions Lovable installed. `npm audit` showed 13 vulnerabilities at the time of the first audit, including a `minimatch` ReDoS vulnerability.

**Fix:** Dependabot, configured with a staging target branch and sensible ignore rules (hold ESLint at v8, Tailwind at v3, React at v18 — all require migration work that the tool can't do automatically).

---

## The Architecture Problems

### `is_good_day` stored in the database

Lovable stored a computed `is_good_day` boolean in every database row. This seems harmless until you want to change the rules (e.g., lower the temperature threshold in winter). If the rules change, every historical row is now wrong. You'd have to re-run a migration across the whole table every time you tweaked a threshold.

**Fix:** Remove `is_good_day` from the DB entirely. Compute it at runtime from `rulesStorage.js`. Now rule changes apply retroactively to all history with no migration.

### Business logic scattered in components

The "is today a good day?" logic was duplicated across `Index.jsx`, `CalendarHistory.jsx`, `MonthlyGoodDaysChart.jsx`, and a few other places. Each component was doing its own threshold comparisons inline.

**Fix:** Extract to `rulesStorage.js` — single source of truth, single function. Once extracted, it was trivial to write unit tests for it.

### No tests

There were zero tests. Lovable doesn't generate tests.

**Fix:** Vitest + jsdom. 32 tests covering good-day boundary conditions, the sunniness calculation, daytime rain exclusion logic, and localStorage round-trips. Took a couple of hours and caught two boundary bugs (wind at exactly 20 km/h should fail, rain at exactly 0 should pass — both had been ambiguous in the original inline logic).

### Vote counts with no integrity

The original voting was a simple increment on the database row. Anyone who knew the Supabase anon key could call the Supabase API directly and set vote counts to arbitrary values. With RLS off, they could also UPDATE rows directly.

**Fix:** A `vote_tokens` table with a unique constraint on `(token, date)`. The `increment_vote()` function accepts a `voter_token` UUID and checks for duplicates before incrementing. A duplicate vote attempt returns error code `23505` (unique violation), which the client handles gracefully. No backend required — the DB enforces the constraint.

---

## What Lovable Does Well

It's worth being clear: Lovable got this project from zero to deployed in an afternoon. The component structure was sensible, the Supabase integration was correct, the routing worked, the UI looked fine. For a hobby project where the goal is "get something live and iterate," that's genuinely valuable.

The problems described above aren't unique to Lovable — they're the problems of any rapidly scaffolded project that doesn't go through a proper review cycle. A junior developer hand-rolling the same app would have made some of the same mistakes.

But Lovable has some specific failure modes worth knowing about:

1. **It installs everything it might need, not what it does need.** The full shadcn/ui kit, every Radix package, heavy visualisation libraries — they're in the scaffold because they might be useful. Audit your dependencies before your first real deploy.

2. **It doesn't clean up.** Development artefacts (one-off pages, seeding scripts, placeholder IDs) stay in the codebase indefinitely. Lovable doesn't track what it added versus what's still needed.

3. **Credentials go in source by default.** The generated Supabase client hardcodes credentials. Move them to environment variables before the first commit if you care about keeping your git history clean.

4. **It leaves telemetry in your repo.** The `.gpt_engineer/` directory contains scripts that report back to Lovable's servers. These are committed to your repository and run as part of the Lovable integration. Once you're developing independently, revoke Lovable's GitHub access and delete these files.

5. **Generated analytics code uses placeholder values.** If Lovable adds Google Analytics, check whether the measurement ID was actually set. If it says `GA_MEASUREMENT_ID`, it was never configured.

6. **No CI, no tests, no staging.** Lovable deploys straight to production from the main branch. It does not generate tests. It does not set up a CI pipeline. These are things you need to add yourself before the project grows.

---

## Checklist: Auditing a Lovable/GPT Engineer App

If you have a Lovable-generated app running in production, here's where to start:

**Security**
- [ ] Are Supabase credentials in env vars or hardcoded in source?
- [ ] Are RLS policies configured on all tables?
- [ ] Is there any page with a hardcoded API key?
- [ ] Did Lovable add Google Analytics? Does it have a real measurement ID?
- [ ] Run `npm audit`. Are there known vulnerabilities?
- [ ] Check [securityheaders.com](https://securityheaders.com). Do you have a CSP?
- [ ] Did you revoke Lovable's GitHub access once you stopped using it?
- [ ] Is `.gpt_engineer/` committed to your repo? Delete it.

**Performance**
- [ ] Run `npm run build`. What's the main chunk size?
- [ ] Are heavy libraries (recharts, react-day-picker) loaded on every page?
- [ ] Could they be lazy-loaded or replaced with something lighter?

**Dependencies**
- [ ] How many packages are installed vs. actually imported?
- [ ] Run `npx depcheck` to find unused dependencies

**Infrastructure**
- [ ] Is there a CI pipeline? Does it run on every PR?
- [ ] Is there a staging environment?
- [ ] If you're on Supabase free tier, is there a keepalive job?
- [ ] Is Dependabot or Renovate configured for automated dependency updates?

**Architecture**
- [ ] Is any computed state stored in the DB that depends on rules that might change?
- [ ] Is business logic duplicated across components, or centralised?
- [ ] Are there leftover dev pages or one-off utility scripts that are deployed but shouldn't be?

---

## Numbers

| Metric | Before | After |
|---|---|---|
| npm dependencies | 62 | 30 |
| shadcn/ui component files | 48 | 4 |
| Main JS bundle | 877 kB | 80 kB |
| CSS bundle | 45 kB | 19 kB |
| `npm audit` vulnerabilities | 13 | 0 |
| Security headers score | D | A |
| Unit tests | 0 | 32 |
| CI pipeline | None | Lint → Test → Build → Audit |
| Staging environment | None | Yes (`staging` branch → Vercel preview) |
| Automated dependency updates | None | Dependabot (weekly) |

---

## Final Thought

Lovable is a prototyping tool. It's exceptionally good at turning a prompt into something that runs. It is not a production engineering team. If you've shipped a Lovable app and moved on, it's worth spending a few hours asking: what did it actually install, what did it leave behind, and is anything sensitive sitting in git history? The answers might surprise you.

---

*Can You Beat Wellington is open source: [github.com/patatrat/CanYouBeatWellington](https://github.com/patatrat/CanYouBeatWellington)*
