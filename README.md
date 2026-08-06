<p align="center">
  <img src="public/canyoubeatwellington_og_image.png" alt="You can't beat Wellington on a good day. But is today that day?" width="600">
</p>

<h1 align="center">Can You Beat Wellington?</h1>

<p align="center">
  <a href="https://www.canyoubeatwellington.nz/"><strong>canyoubeatwellington.nz</strong></a>
  ·
  <a href="https://github.com/patatrat/CanYouBeatWellington/actions/workflows/ci.yml"><img src="https://github.com/patatrat/CanYouBeatWellington/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
</p>

Wellington, New Zealand has a famous local saying: **"You can't beat Wellington on a good day."** It's true. It's also doing a lot of heavy lifting, because good days are rare — the city is infamous for wind, and the weather turns on a dime.

This site settles the argument, daily. It pulls the actual weather, checks it against a set of admittedly strict rules, and gives a one-word verdict: can you beat Wellington today, or not? You can agree, disagree, vote, and dig through years of historical data to see just how often Wellington actually delivers.

It's a hobby project — equal parts weather app, running joke, and excuse to keep tinkering with a small production system.

## How the verdict works

A "good day" requires **all three** of:

| Criterion | Threshold |
|---|---|
| Max temperature | ≥ seasonal minimum (13°C in winter, up to 19°C in summer) |
| Max wind speed | < 30 km/h, year-round |
| Daytime rain | 0 mm, year-round |

Miss any one and it's a "no." The temperature bar moves with the seasons — and Wellington gets **six** of them, not four:

> Summer (Jan–Mar) → Autumn (Apr) → Late Autumn (May–Jun) → Winter (Jul–Aug) → Spring 1 (Sep) → **Shitsville** (Oct–Nov) → Spring 2 (Dec)

Yes, one of the seasons is really called that in the code. October–November is Wellington's worst stretch by a wide margin (well under 10% of days qualify), and the app doesn't pretend otherwise — [there's a whole blog post about why](https://radomski.co.nz/blog/shitsville) it's modelled as its own season rather than smoothed over.

Weather data comes from [Open-Meteo](https://open-meteo.com/) — free, no API key, refreshed daily.

## The quips

Every verdict comes with a line of commentary, picked from a tiered system so the flavour text always matches how notable the day actually is:

1. **Special-day overrides** — if it's a day like Christmas or a Wellington team's grand final, that context wins first (see below).
2. **Severity quips** — genuinely extreme conditions get called out ahead of everything else, most dramatic first:
   - ❄️ **Snow** — rare enough in Wellington to make the news, so it jumps the queue ahead of even the worst wind.
   - 💨 Wind ≥ 60 / 50 / 40 km/h (with its own tier for 40+ *and* raining)
   - 🥶 **Feels-like temperature below 0°C** — wind chill/humidity/radiation-adjusted, for the days that are colder than the thermometer lets on
   - 🌧️ Heavy rain (≥ 25mm) and steady-but-calm rain (10–25mm)
3. **A great day** — clears the bar by a wide margin (3°+ above the seasonal minimum, wind under 20 km/h, dry) gets its own celebratory line instead of the standard "good day" text.
4. **Standard scenario quips** — one of eight lines depending on exactly which of temp/wind/rain passed or failed (all fine, wind-only miss, rain-only miss, the works — right down to all three failing at once).

Nothing here changes the actual pass/fail verdict — it's purely which sentence you get to read underneath it.

## Special dates

A second Neon-backed system tracks notable dates and can override the quip, the background gradient, trigger a confetti or balloon effect, link out to an event page, and — for sporting fixtures only — flip the verdict entirely ("a Wellington team winning forces a good day regardless of weather"). Three kinds:

- **Fixed-rule holidays** (Waitangi Day, ANZAC Day, Christmas, etc.) — computed from a small date-rule engine and regenerated automatically every year, no manual upkeep.
- **Moveable festivals** (Matariki, CubaDupa, WOW, Beervana) — real-world events with no fixed formula, entered by hand once dates are announced.
- **Sporting fixtures** — seeded ahead of a game as *pending*, resolved afterwards with the actual result.

Some dates go further and vary their quip by the day's actual weather — Christmas Day, for instance, has a different line for a sunny Christmas, a rainy one, a cold one, and a total washout, rather than one fixed sentence regardless of conditions.

## Following along

The site posts to the fediverse whenever it's a good day — follow **`@CanYouBeat@canyoubeatwellington.radomski.co.nz`** from Mastodon or any other ActivityPub-compatible app. No spam, no bad-day posts, just the good news.

## Tech stack

- **[Next.js](https://nextjs.org/) 16** (App Router) + TypeScript
- **[Tailwind CSS](https://tailwindcss.com/)** + [shadcn/ui](https://ui.shadcn.com/)
- **[Neon](https://neon.tech/)** (serverless Postgres) for weather history, votes, and special dates
- **[Vercel KV](https://vercel.com/storage/kv)** for the ActivityPub follower list and outbox
- **[Vitest](https://vitest.dev/)** for the test suite
- Hosted on **[Vercel](https://vercel.com/)**, with a daily cron job for the weather fetch + fediverse post

## Running it locally

```bash
git clone https://github.com/patatrat/CanYouBeatWellington.git
cd CanYouBeatWellington
npm install
cp .env.example .env.local   # fill in your own Neon/KV credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Running the full app locally needs a Neon database and Vercel KV store of your own — see `.env.example` for what's required. The weather data itself needs no key; it's all free from Open-Meteo.

```bash
npm test    # run the test suite
npm run lint
npm run build
```

## Digging deeper

This repo is developed with a fair amount of AI assistance (Claude), and the working notes are kept in the open in [`CLAUDE.md`](CLAUDE.md) — architecture decisions, the full backlog, and a running changelog of what shipped and why. It's written for an AI coding agent to pick up context quickly, but it doubles as a pretty thorough project history if you're curious how any of this actually works under the hood.

The [migration and rebuild story](https://radomski.co.nz/blog/tag/can-you-beat-wellington) — this app started life on a completely different stack — is written up on the blog.
