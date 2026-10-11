import { sql } from "./db";
import type { DailyWeatherRecord } from "@/types/db";

const calculateSunniness = (weatherCode: number): number => {
  if (weatherCode <= 3) return 100;
  if (weatherCode <= 48) return 70;
  if (weatherCode <= 67) return 50;
  if (weatherCode <= 77) return 30;
  return 10;
};

// Daytime window is hours 6 AM–6 PM for a given day index (0 = today) within
// the multi-day hourly array Open-Meteo returns (24 entries per day).
const daytimeSlice = <T>(hourly: T[], dayIndex: number): T[] =>
  hourly.slice(dayIndex * 24 + 6, dayIndex * 24 + 18);

const calculateDaytimeRain = (hourlyPrecipitation: number[], dayIndex: number): number =>
  daytimeSlice(hourlyPrecipitation, dayIndex).reduce((sum, rain) => sum + (rain || 0), 0);

// Average (not max) so calm days aren't penalised for evening gusts.
const calculateDaytimeWind = (hourlyWind: number[], dayIndex: number): number => {
  const slice = daytimeSlice(hourlyWind, dayIndex);
  if (!slice.length) return 0;
  return slice.reduce((sum, w) => sum + (w || 0), 0) / slice.length;
};

// Minimum (not average) — captures the coldest it actually felt at some point
// during the day (e.g. a windy afternoon), which is the number people mean
// when they say "it felt like -7 out there", not a blander daytime average.
const calculateDaytimeFeelsLike = (hourlyApparentTemp: number[], dayIndex: number): number => {
  const slice = daytimeSlice(hourlyApparentTemp, dayIndex);
  if (!slice.length) return 0;
  return Math.min(...slice);
};

// NUMERIC columns come back from Postgres as strings (to avoid float-precision
// surprises) — cast to float8 so callers get plain JS numbers.
const RECORD_COLUMNS = `
  date::text, temperature::float8, wind_speed::float8, rain::float8, feels_like::float8, snowfall::float8,
  sunniness, agree_count, disagree_count, created_at
`;

export const getTodaysNZTDate = (): string =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });

export async function getTodaysRecord(): Promise<DailyWeatherRecord | null> {
  const date = getTodaysNZTDate();
  const rows = await sql`
    SELECT ${sql.unsafe(RECORD_COLUMNS)}
    FROM daily_weather_records
    WHERE date = ${date}
  `;
  return (rows[0] as DailyWeatherRecord) ?? null;
}

export async function getHistoricalRecords(from: string, to: string): Promise<DailyWeatherRecord[]> {
  const rows = await sql`
    SELECT ${sql.unsafe(RECORD_COLUMNS)}
    FROM daily_weather_records
    WHERE date >= ${from} AND date <= ${to}
    ORDER BY date DESC
  `;
  return rows as DailyWeatherRecord[];
}

export async function getAllHistoricalRecords(): Promise<DailyWeatherRecord[]> {
  const rows = await sql`
    SELECT ${sql.unsafe(RECORD_COLUMNS)}
    FROM daily_weather_records
    ORDER BY date DESC
  `;
  return rows as DailyWeatherRecord[];
}

export interface WeatherUpsert {
  date: string;
  temperature: number;
  wind_speed: number;
  rain: number;
  feels_like: number;
  snowfall: number;
  sunniness: number;
}

export async function upsertWeatherRecord(record: WeatherUpsert): Promise<void> {
  await sql`
    INSERT INTO daily_weather_records (date, temperature, wind_speed, rain, feels_like, snowfall, sunniness)
    VALUES (${record.date}, ${record.temperature}, ${record.wind_speed}, ${record.rain}, ${record.feels_like}, ${record.snowfall}, ${record.sunniness})
    ON CONFLICT (date) DO UPDATE SET
      temperature = EXCLUDED.temperature,
      wind_speed  = EXCLUDED.wind_speed,
      rain        = EXCLUDED.rain,
      feels_like  = EXCLUDED.feels_like,
      snowfall    = EXCLUDED.snowfall,
      sunniness   = EXCLUDED.sunniness
  `;
}

// Open-Meteo's daily/hourly response shape, as far as the batch upsert needs.
// Both the forecast API (with past_days) and the historical archive API
// return this same shape, so the cron and scripts/backfill-weather.ts share it.
export interface OpenMeteoBatchResponse {
  daily: {
    time: string[];
    weather_code: (number | null)[];
    temperature_2m_max: (number | null)[];
    snowfall_sum: (number | null)[];
  };
  hourly: {
    precipitation: (number | null)[];
    wind_speed_10m: (number | null)[];
    apparent_temperature: (number | null)[];
  };
}

// Turns an Open-Meteo batch response into upsertable rows, up to and
// including `today`. Days whose max temperature or daytime wind is null are
// SKIPPED, not stored as zero: the forecast API returns explicit nulls for
// the oldest part of its past_days window (confirmed 2026-10-11 — the oldest
// 18 of 92 days came back null), and the old `?? 0` fallback meant every
// daily cron run overwrote real history with 0°C / 0 km/h / 0 mm rows.
// Skipping leaves whatever was stored when that day was recent untouched.
export function buildDailyRecords(data: OpenMeteoBatchResponse, today: string): WeatherUpsert[] {
  const records: WeatherUpsert[] = [];
  for (let i = 0; i < data.daily.time.length; i++) {
    if (data.daily.time[i] > today) break;
    const temperature = data.daily.temperature_2m_max[i];
    const windSlice = daytimeSlice(data.hourly.wind_speed_10m, i);
    if (temperature == null || windSlice.every((w) => w == null)) continue;
    records.push({
      date: data.daily.time[i],
      temperature,
      wind_speed: parseFloat(calculateDaytimeWind(data.hourly.wind_speed_10m as number[], i).toFixed(2)),
      sunniness: calculateSunniness(data.daily.weather_code[i] ?? 0),
      rain: parseFloat(calculateDaytimeRain(data.hourly.precipitation as number[], i).toFixed(2)),
      snowfall: data.daily.snowfall_sum[i] ?? 0,
      feels_like: parseFloat(calculateDaytimeFeelsLike(data.hourly.apparent_temperature as number[], i).toFixed(2)),
    });
  }
  return records;
}

// Fetch the last `pastDays` of Wellington weather from Open-Meteo, upsert
// all past records into Neon, and return the count + today's record.
// Used by the daily cron route (/api/cron/daily-weather).
export async function fetchAndStoreBatch(
  pastDays = 92,
): Promise<{ stored: number; todayRecord: WeatherUpsert | null }> {
  const today = getTodaysNZTDate();

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=-41.2866&longitude=174.7756` +
    `&past_days=${pastDays}` +
    `&daily=weather_code,temperature_2m_max,snowfall_sum` +
    `&hourly=precipitation,wind_speed_10m,apparent_temperature` +
    `&timezone=Pacific%2FAuckland`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo error ${response.status}`);
  const data = await response.json();

  const dayCount = data.daily?.time?.length ?? 0;
  if (
    !dayCount ||
    !Array.isArray(data.daily.temperature_2m_max) ||
    !Array.isArray(data.daily.weather_code) ||
    !Array.isArray(data.daily.snowfall_sum) ||
    data.daily.temperature_2m_max.length < dayCount ||
    data.daily.weather_code.length < dayCount ||
    data.daily.snowfall_sum.length < dayCount ||
    !Array.isArray(data.hourly?.precipitation) ||
    !Array.isArray(data.hourly?.wind_speed_10m) ||
    !Array.isArray(data.hourly?.apparent_temperature) ||
    data.hourly.precipitation.length < dayCount * 24 ||
    data.hourly.wind_speed_10m.length < dayCount * 24 ||
    data.hourly.apparent_temperature.length < dayCount * 24
  ) {
    throw new Error("Open-Meteo API returned incomplete data");
  }

  const records = buildDailyRecords(data, today);

  await Promise.all(records.map(r => upsertWeatherRecord(r)));

  return {
    stored: records.length,
    todayRecord: records.find(r => r.date === today) ?? null,
  };
}

export interface ForecastDay {
  date: string;
  temperature: number;
  windSpeed: number;
  rain: number;
}

export interface LiveWeather {
  temperature: number;
  windSpeed: number;
  sunniness: number;
  rain: number;
  feelsLike: number;
  snowfall: number;
  timestamp: string;
  source: string;
  forecast: ForecastDay[];
}

// Live fetch from Open-Meteo — used when today's cron-written record doesn't
// exist yet (the window before the daily cron runs) and to source forecast
// data, which isn't persisted to the DB.
export async function fetchLiveWeather(): Promise<LiveWeather> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    "?latitude=-41.2866&longitude=174.7756" +
    "&daily=weather_code,temperature_2m_max,snowfall_sum" +
    "&hourly=precipitation,wind_speed_10m,apparent_temperature" +
    "&timezone=Pacific%2FAuckland";

  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data = await response.json();

  if (
    !data.daily?.time?.[0] ||
    data.daily?.temperature_2m_max?.[0] == null ||
    data.daily?.weather_code?.[0] === undefined ||
    data.daily?.snowfall_sum?.[0] === undefined ||
    !Array.isArray(data.hourly?.precipitation) ||
    !Array.isArray(data.hourly?.wind_speed_10m) ||
    !Array.isArray(data.hourly?.apparent_temperature) ||
    data.hourly.precipitation.length < 18 ||
    data.hourly.wind_speed_10m.length < 18 ||
    data.hourly.apparent_temperature.length < 18
  ) {
    throw new Error("Open-Meteo API returned incomplete data");
  }

  return {
    temperature: data.daily.temperature_2m_max[0],
    windSpeed: calculateDaytimeWind(data.hourly.wind_speed_10m, 0),
    sunniness: calculateSunniness(data.daily.weather_code[0]),
    rain: calculateDaytimeRain(data.hourly.precipitation, 0),
    feelsLike: calculateDaytimeFeelsLike(data.hourly.apparent_temperature, 0),
    snowfall: data.daily.snowfall_sum[0] ?? 0,
    timestamp: data.daily.time[0],
    source: "https://open-meteo.com/",
    // Days 1–6 (tomorrow → 6 days out). Day 0 is today, shown separately.
    // Open-Meteo occasionally returns an explicit null (not just a missing
    // index) for a given day's max temperature — seen live, crashing
    // ForecastStrip's .toFixed() calls — so incomplete days are dropped
    // rather than assumed valid; a 5- or 6-day strip beats a broken page.
    forecast: (
      data.daily.time.slice(1).map((date: string, i: number) => ({
        date,
        temperature: data.daily.temperature_2m_max[i + 1] as number | null | undefined,
        windSpeed: calculateDaytimeWind(data.hourly.wind_speed_10m, i + 1),
        rain: calculateDaytimeRain(data.hourly.precipitation, i + 1),
      })) as { date: string; temperature: number | null | undefined; windSpeed: number; rain: number }[]
    ).filter((day): day is ForecastDay => day.temperature != null),
  };
}
