/**
 * Populates daily_weather_records with the last 92 days of Wellington weather.
 * Uses Open-Meteo forecast API (free, no key required).
 * Stores raw measurements only — is_good_day is computed at runtime by the app.
 *
 * Run with:
 *   node --env-file=.env.local scripts/populate-db.js
 */

import { createClient } from '@supabase/supabase-js';
import { calculateSunniness, calculateDaytimeRain } from './utils.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
// Service role key bypasses RLS (safe for server-side scripts only).
// Falls back to anon key for local dev where service key isn't available.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing env vars. Run with: node --env-file=.env.local scripts/populate-db.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);


const main = async () => {
  const today = new Date().toISOString().split('T')[0];
  console.log(`Populating daily_weather_records (last 92 days → ${today})`);
  console.log(`Supabase project: ${SUPABASE_URL}\n`);

  process.stdout.write('Fetching from Open-Meteo... ');

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', '-41.2866');
  url.searchParams.set('longitude', '174.7756');
  url.searchParams.set('past_days', '92');
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,wind_speed_10m_max');
  url.searchParams.set('hourly', 'precipitation');
  url.searchParams.set('timezone', 'Pacific/Auckland');

  const response = await fetch(url.toString());
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Open-Meteo API error ${response.status}: ${text}`);
  }
  const data = await response.json();

  // Only keep past days (the forecast API also returns future dates)
  const records = [];
  for (let i = 0; i < data.daily.time.length; i++) {
    if (data.daily.time[i] > today) break;
    records.push({
      date: data.daily.time[i],
      temperature: data.daily.temperature_2m_max[i] ?? 0,
      wind_speed: data.daily.wind_speed_10m_max[i] ?? 0,
      sunniness: calculateSunniness(data.daily.weather_code[i] ?? 0),
      rain: parseFloat(calculateDaytimeRain(data.hourly.precipitation, i).toFixed(2)),
    });
  }

  console.log(`✓ ${records.length} days fetched`);
  process.stdout.write('Upserting to Supabase... ');

  const BATCH_SIZE = 100;
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const { error } = await supabase
      .from('daily_weather_records')
      .upsert(records.slice(i, i + BATCH_SIZE), { onConflict: 'date' });
    if (error) throw new Error(`Supabase upsert error: ${JSON.stringify(error)}`);
  }

  console.log(`✓ done\n✅ ${records.length} records upserted.`);
};

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
