/**
 * Repairs daily_weather_records rows that the daily cron zeroed out.
 *
 * Until 2026-10-11 the cron stored Open-Meteo's explicit nulls (returned for
 * the oldest part of its 92-day past_days window) as 0°C / 0 km/h / 0 mm,
 * overwriting real history on every run. This re-fetches the affected range
 * from Open-Meteo's historical archive API (complete, no nulls) and rewrites
 * ONLY rows that are all-zero placeholders, plus any dates missing outright.
 * Rows holding real readings are never touched, and votes are never touched
 * (the upsert doesn't set agree_count/disagree_count).
 *
 * Dry run by default — prints what it would write and changes nothing:
 *   DATABASE_URL=... npx jiti scripts/backfill-weather.ts --from 2026-01-01 --to 2026-08-31
 * Then, to actually write:
 *   DATABASE_URL=... npx jiti scripts/backfill-weather.ts --from 2026-01-01 --to 2026-08-31 --apply
 */

import { sql } from "../src/lib/db";
import { buildDailyRecords, upsertWeatherRecord, type OpenMeteoBatchResponse } from "../src/lib/weather";

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

const from = arg("from");
const to = arg("to");
const apply = process.argv.includes("--apply");
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to) || from > to) {
  console.error("Usage: npx jiti scripts/backfill-weather.ts --from YYYY-MM-DD --to YYYY-MM-DD [--apply]");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set.");
  process.exit(1);
}

const url =
  `https://archive-api.open-meteo.com/v1/archive` +
  `?latitude=-41.2866&longitude=174.7756` +
  `&start_date=${from}&end_date=${to}` +
  `&daily=weather_code,temperature_2m_max,snowfall_sum` +
  `&hourly=precipitation,wind_speed_10m,apparent_temperature` +
  `&timezone=Pacific%2FAuckland`;

const response = await fetch(url);
if (!response.ok) throw new Error(`Open-Meteo archive error ${response.status}`);
const data = (await response.json()) as OpenMeteoBatchResponse;
const fetched = buildDailyRecords(data, to);

const existing = (await sql`
  SELECT date::text, temperature::float8, wind_speed::float8, rain::float8
  FROM daily_weather_records
  WHERE date >= ${from} AND date <= ${to}
`) as { date: string; temperature: number; wind_speed: number; rain: number }[];
const byDate = new Map(existing.map((r) => [r.date, r]));

const isZeroPlaceholder = (r: { temperature: number; wind_speed: number; rain: number }) =>
  r.temperature === 0 && r.wind_speed === 0 && r.rain === 0;

const toWrite = fetched.filter((r) => {
  const row = byDate.get(r.date);
  return !row || isZeroPlaceholder(row);
});

console.log(`Archive returned ${fetched.length} complete days for ${from}..${to}.`);
console.log(`${existing.length} rows exist in that range; ${toWrite.length} are zeroed or missing and would be written.`);
for (const r of toWrite) {
  const status = byDate.has(r.date) ? "zeroed " : "missing";
  console.log(`  ${status} ${r.date}  ${r.temperature}°C  ${r.wind_speed} km/h  ${r.rain} mm`);
}

if (!apply) {
  console.log("\nDry run: nothing written. Re-run with --apply to write these rows.");
  process.exit(0);
}

for (const r of toWrite) await upsertWeatherRecord(r);
console.log(`\nWrote ${toWrite.length} rows.`);
