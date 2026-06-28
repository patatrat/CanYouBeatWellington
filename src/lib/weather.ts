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

// NUMERIC columns come back from Postgres as strings (to avoid float-precision
// surprises) — cast to float8 so callers get plain JS numbers.
const RECORD_COLUMNS = `
  date::text, temperature::float8, wind_speed::float8, rain::float8,
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
  sunniness: number;
}

export async function upsertWeatherRecord(record: WeatherUpsert): Promise<void> {
  await sql`
    INSERT INTO daily_weather_records (date, temperature, wind_speed, rain, sunniness)
    VALUES (${record.date}, ${record.temperature}, ${record.wind_speed}, ${record.rain}, ${record.sunniness})
    ON CONFLICT (date) DO UPDATE SET
      temperature = EXCLUDED.temperature,
      wind_speed  = EXCLUDED.wind_speed,
      rain        = EXCLUDED.rain,
      sunniness   = EXCLUDED.sunniness
  `;
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
    `&daily=weather_code,temperature_2m_max` +
    `&hourly=precipitation,wind_speed_10m` +
    `&timezone=Pacific%2FAuckland`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo error ${response.status}`);
  const data = await response.json();

  const records: WeatherUpsert[] = [];
  for (let i = 0; i < data.daily.time.length; i++) {
    if (data.daily.time[i] > today) break;
    records.push({
      date: data.daily.time[i],
      temperature: data.daily.temperature_2m_max[i] ?? 0,
      wind_speed: parseFloat(calculateDaytimeWind(data.hourly.wind_speed_10m, i).toFixed(2)),
      sunniness: calculateSunniness(data.daily.weather_code[i] ?? 0),
      rain: parseFloat(calculateDaytimeRain(data.hourly.precipitation, i).toFixed(2)),
    });
  }

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
    "&daily=weather_code,temperature_2m_max" +
    "&hourly=precipitation,wind_speed_10m" +
    "&timezone=Pacific%2FAuckland";

  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data = await response.json();

  if (
    !data.daily?.time?.[0] ||
    data.daily?.temperature_2m_max?.[0] === undefined ||
    data.daily?.weather_code?.[0] === undefined ||
    !Array.isArray(data.hourly?.precipitation) ||
    !Array.isArray(data.hourly?.wind_speed_10m) ||
    data.hourly.precipitation.length < 18 ||
    data.hourly.wind_speed_10m.length < 18
  ) {
    throw new Error("Open-Meteo API returned incomplete data");
  }

  return {
    temperature: data.daily.temperature_2m_max[0],
    windSpeed: calculateDaytimeWind(data.hourly.wind_speed_10m, 0),
    sunniness: calculateSunniness(data.daily.weather_code[0]),
    rain: calculateDaytimeRain(data.hourly.precipitation, 0),
    timestamp: data.daily.time[0],
    source: "https://open-meteo.com/",
    // Days 1–6 (tomorrow → 6 days out). Day 0 is today, shown separately.
    forecast: data.daily.time.slice(1).map((date: string, i: number) => ({
      date,
      temperature: data.daily.temperature_2m_max[i + 1],
      windSpeed: calculateDaytimeWind(data.hourly.wind_speed_10m, i + 1),
      rain: calculateDaytimeRain(data.hourly.precipitation, i + 1),
    })),
  };
}
