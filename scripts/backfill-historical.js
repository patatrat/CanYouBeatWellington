/**
 * Backfills daily_weather_records from the Open-Meteo archive API.
 * Use this to seed historical data that predates the 92-day forecast window.
 *
 * Note: uses daily precipitation_sum (full 24h) rather than daytime-only hours.
 * This is slightly more conservative — a night-rain day may be flagged as rainy
 * even if the daytime was dry. Acceptable trade-off for historical archive data.
 *
 * Run with:
 *   START_DATE=2020-01-01 END_DATE=2025-12-31 node --env-file=.env.local scripts/backfill-historical.js
 *
 * Or via the GitHub Actions "Backfill Historical Weather" workflow_dispatch.
 */

import { createClient } from '@supabase/supabase-js';
import { calculateSunniness } from './utils.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const START_DATE = process.env.START_DATE || '2020-01-01';
const END_DATE = process.env.END_DATE || '2025-12-31';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing env vars. Run with: node --env-file=.env.local scripts/backfill-historical.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);


const main = async () => {
  console.log(`Backfilling daily_weather_records: ${START_DATE} → ${END_DATE}`);
  console.log(`Supabase project: ${SUPABASE_URL}\n`);

  process.stdout.write('Fetching from Open-Meteo archive API... ');

  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', '-41.2866');
  url.searchParams.set('longitude', '174.7756');
  url.searchParams.set('start_date', START_DATE);
  url.searchParams.set('end_date', END_DATE);
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,wind_speed_10m_max,precipitation_sum');
  url.searchParams.set('timezone', 'Pacific/Auckland');

  const response = await fetch(url.toString());
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Open-Meteo archive API error ${response.status}: ${text}`);
  }
  const data = await response.json();

  const records = data.daily.time.map((date, i) => ({
    date,
    temperature: data.daily.temperature_2m_max[i] ?? 0,
    wind_speed: data.daily.wind_speed_10m_max[i] ?? 0,
    sunniness: calculateSunniness(data.daily.weather_code[i] ?? 0),
    rain: parseFloat((data.daily.precipitation_sum[i] ?? 0).toFixed(2)),
  }));

  console.log(`✓ ${records.length} days fetched`);
  process.stdout.write('Upserting to Supabase... ');

  const BATCH_SIZE = 100;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const { error } = await supabase
      .from('daily_weather_records')
      .upsert(records.slice(i, i + BATCH_SIZE), { onConflict: 'date' });
    if (error) throw new Error(`Supabase upsert error: ${JSON.stringify(error)}`);
  }

  console.log(`✓ done\n✅ ${records.length} records upserted (${START_DATE} → ${END_DATE}).`);
};

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
