import { describe, it, expect } from 'vitest';
import { format, parseISO, addDays } from 'date-fns';
import { calculateFunFacts } from '../weatherFunFacts';
import type { DailyWeatherRecord } from '@/types/db';

// Summer good day: 20°C, light wind, dry. Bad day: windy.
const GOOD = { temperature: 20, wind_speed: 10, rain: 0 };
const BAD = { temperature: 20, wind_speed: 40, rain: 0 };

const record = (date: string, weather: typeof GOOD, extra: Partial<DailyWeatherRecord> = {}): DailyWeatherRecord => ({
  date,
  ...weather,
  feels_like: null,
  snowfall: null,
  sunniness: null,
  agree_count: 0,
  disagree_count: 0,
  created_at: '',
  ...extra,
});

// Consecutive days from start, good when pattern(i) is true.
const run = (start: string, count: number, pattern: (i: number) => boolean) =>
  Array.from({ length: count }, (_, i) =>
    record(format(addDays(parseISO(start), i), 'yyyy-MM-dd'), pattern(i) ? GOOD : BAD),
  );

const texts = (history: DailyWeatherRecord[], today: string) =>
  calculateFunFacts(history, today).map((f) => `[${f.scope}] ${f.text}`);

describe('calculateFunFacts', () => {
  it('needs at least a month of data', () => {
    expect(calculateFunFacts(run('2026-01-01', 20, () => true), '2026-02-01')).toEqual([]);
  });

  it('leaves out today, since its record is still partly forecast', () => {
    const history = [...run('2026-01-01', 40, () => false), record('2026-02-10', { ...GOOD, temperature: 30 })];
    expect(texts(history, '2026-02-10')).toContain('[All time] The hottest day on record reached 20.0°C, on 1 January 2026.');
  });

  it('ignores the all-zero placeholder rows the old cron wrote', () => {
    const history = [...run('2026-01-01', 40, () => true), record('2026-02-10', { temperature: 0, wind_speed: 0, rain: 0 })];
    expect(texts(history, '2026-02-20')).toContain('[All time] The coldest day on record only got to 20.0°C, on 1 January 2026.');
  });

  it('formats dates the NZ way', () => {
    const history = [...run('2026-01-01', 40, () => false), record('2026-01-16', { ...BAD, temperature: 28 })];
    expect(texts(history, '2026-03-01')).toContain('[All time] The hottest day on record reached 28.0°C, on 16 January 2026.');
  });

  it('does not count a streak across a gap in the data', () => {
    const history = [...run('2026-01-01', 3, () => true), ...run('2026-01-05', 40, (i) => i < 3)];
    expect(texts(history, '2026-03-01')).toContain('[All time] The longest run of good days was 3 in a row, from 1 January 2026.');
  });

  it('reports the current good-day streak', () => {
    const history = run('2026-01-01', 40, (i) => i >= 37);
    expect(texts(history, '2026-02-10')).toContain('[Right now] The last 3 days have all been good days.');
  });

  it('says how long since the last good day', () => {
    const history = run('2026-01-01', 40, (i) => i === 30);
    expect(texts(history, '2026-02-10')).toContain('[Right now] The last good day was 31 January 2026, 10 days ago.');
  });

  it("looks at this date in earlier years, not this year's", () => {
    const history = [
      ...run('2024-01-01', 40, (i) => i === 9),
      ...run('2025-01-01', 40, () => false),
      ...run('2026-01-01', 40, () => true),
    ];
    expect(texts(history, '2026-01-10')).toContain('[On this day] 10 January has been a good day in 1 of the last 2 years.');
  });
});
