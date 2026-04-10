# Can You Beat Wellington?

"You can't beat Wellington on a good day" — but is today that day?

A simple webapp that checks Wellington's weather in real time and answers the question. See it live: **https://canyoubeatwellington.radomski.co.nz/**

Background and write-up: https://www.radomski.co.nz/2024/09/04/can-you-beat-wellington/

Originally built with [Lovable](https://lovable.dev) (formerly GPT Engineer).

## How it works

Three criteria must all be met for it to be a good day:

- Max temperature ≥ 18°C
- Max wind speed < 20 km/h
- Daytime rain = 0 mm

Weather data is fetched from [Open-Meteo](https://open-meteo.com/) (free, no API key). Today's result and vote counts are stored in Supabase; historical data is visualised on the About page.

## Stack

- **Frontend**: React 18 + Vite 5 + Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL) with RLS policies
- **Hosting**: Vercel (auto-deploys from `main`; `staging` branch deploys to preview URL)
- **Analytics**: Vercel Analytics
- **CI**: GitHub Actions — lint + build + audit on every push/PR
- **Daily weather cron**: GitHub Actions at 12:00 UTC, upserts today's record via `scripts/populate-db.js`
- **Supabase keep-alive**: GitHub Actions ping every 5 days to prevent free-tier pausing

## Development

```bash
npm install
npm run dev
```

Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars (copy `.env.example` if present, or set them manually).

## Changelog

- **April 2026** — SEO improvements: target phrases in title/meta/structured data, H1 restructure, sitemap freshness
- **April 2026** — Removed unused shadcn/ui components and dead Radix UI dependencies; CSS bundle reduced from 45 kB to 19 kB
- **April 2026** — Added Supabase RLS policies; votes go via `increment_vote()` SECURITY DEFINER function; staging environment on Vercel
- **April 2026** — Replaced Google Analytics placeholder with Vercel Analytics; added daily weather cron job
- **June 2025** — Added Supabase database for daily weather history; graphs and calendar on About page
