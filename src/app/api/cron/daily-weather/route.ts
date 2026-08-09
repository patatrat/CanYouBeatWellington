import { NextRequest, NextResponse } from 'next/server';
import { isBearerAuthorized } from '@/lib/auth';
import { fetchAndStoreBatch, getTodaysNZTDate } from '@/lib/weather';
import { isGoodWeatherDay } from '@/utils/rulesStorage';
import { postToFollowers } from '@/lib/ap-posting';
import {
  ensureUpcomingOccurrences,
  getActiveSpecialDates,
  pickPrimarySpecialDate,
  resolveVerdict,
} from '@/lib/special-dates';

// Allow up to 60 s for the fan-out loop to complete.
export const maxDuration = 60;

// The link shown in the toot's body — human-facing content, not actor
// identity, so it points at the new domain unlike the AP-pinned BASE
// constants in ap-posting.ts/actor routes.
const SITE_URL = 'https://canyoubeatwellington.nz';

export async function GET(req: NextRequest) {
  // When CRON_SECRET is set in Vercel env vars, Vercel Cron automatically
  // includes it in the Authorization header. Manual test calls must too.
  if (!isBearerAuthorized(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = getTodaysNZTDate();

  // Cheap once-a-day side effect: regenerate this year's/next year's
  // occurrences for any fixed-rule special date (e.g. Wellington
  // Anniversary Day) that doesn't have one yet. Self-healing, no separate
  // yearly cron needed.
  await ensureUpcomingOccurrences();

  // Fetch 92 days from Open-Meteo and upsert to Neon.
  const { stored, todayRecord } = await fetchAndStoreBatch();

  if (!todayRecord) {
    return NextResponse.json({ ok: true, stored, fanout: 'skipped — no record for today' });
  }

  // Evaluate today's weather verdict against seasonal rules, then let an
  // active special date's verdict_override (if any) take precedence — the
  // "vibes override weather" mechanic, e.g. a Wellington team winning can
  // force a good day regardless of the weather.
  const weatherIsGood = isGoodWeatherDay(
    { temperature: todayRecord.temperature, windSpeed: todayRecord.wind_speed, rain: todayRecord.rain },
    today,
  );

  const activeSpecialDates = await getActiveSpecialDates(today);
  const special = pickPrimarySpecialDate(activeSpecialDates);
  const isGood = resolveVerdict(weatherIsGood, special?.verdict_override ?? null);

  if (!isGood) {
    return NextResponse.json({
      ok: true,
      stored,
      today: { temperature: todayRecord.temperature, wind_speed: todayRecord.wind_speed, rain: todayRecord.rain },
      fanout: 'skipped — not a good day',
    });
  }

  const specialLine = special
    ? `<p>${special.title}${special.outcome_note ? ` — ${special.outcome_note}` : ''}</p>`
    : '';

  const htmlContent =
    `<p>You can&#39;t beat Wellington today ☀️</p>` +
    specialLine +
    `<p>🌡️ ${todayRecord.temperature.toFixed(1)}°C  ` +
    `💨 ${todayRecord.wind_speed.toFixed(1)} km/h  ` +
    `🌧️ ${todayRecord.rain.toFixed(1)} mm rain</p>` +
    `<p><a href="${SITE_URL}">${SITE_URL}</a></p>`;

  const result = await postToFollowers(htmlContent, today);

  return NextResponse.json({
    ok: true,
    stored,
    today: { temperature: todayRecord.temperature, wind_speed: todayRecord.wind_speed, rain: todayRecord.rain },
    special: special ? { slug: special.slug, title: special.title } : null,
    fanout: result.posted
      ? { delivered: result.delivered, failed: result.failed, total: result.total }
      : `skipped — ${result.reason}`,
  });
}
