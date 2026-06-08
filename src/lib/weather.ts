import { sql } from "./db";
import type { DailyWeatherRecord } from "@/types/db";

export const getTodaysNZTDate = (): string =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });

export async function getTodaysRecord(): Promise<DailyWeatherRecord | null> {
  const date = getTodaysNZTDate();
  const rows = await sql`
    SELECT date::text, temperature, wind_speed, rain, sunniness, agree_count, disagree_count, created_at
    FROM daily_weather_records
    WHERE date = ${date}
  `;
  return (rows[0] as DailyWeatherRecord) ?? null;
}

export async function getHistoricalRecords(from: string, to: string): Promise<DailyWeatherRecord[]> {
  const rows = await sql`
    SELECT date::text, temperature, wind_speed, rain, sunniness, agree_count, disagree_count, created_at
    FROM daily_weather_records
    WHERE date >= ${from} AND date <= ${to}
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
