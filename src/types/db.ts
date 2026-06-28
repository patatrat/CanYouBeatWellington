export interface DailyWeatherRecord {
  date: string;
  temperature: number;
  wind_speed: number;
  rain: number;
  sunniness: number | null;
  agree_count: number;
  disagree_count: number;
  created_at: string;
}
