export interface DailyWeatherRecord {
  date: string;
  temperature: number;
  wind_speed: number;
  rain: number;
  // Nullable like sunniness: rows older than the ~92-day cron backfill
  // window (from before this column existed) never get a value written.
  feels_like: number | null;
  snowfall: number | null;
  sunniness: number | null;
  agree_count: number;
  disagree_count: number;
  created_at: string;
}
