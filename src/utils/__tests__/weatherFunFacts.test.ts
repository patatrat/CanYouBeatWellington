import { describe, it, expect } from 'vitest';
import { format, parseISO, addDays } from 'date-fns';
import { calculateFunFacts, calculateNotSoFunFacts } from '../weatherFunFacts';
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

  it("looks at this date in earlier years, not this year's", () => {
    const history = [
      ...run('2024-01-01', 40, (i) => i === 9),
      ...run('2025-01-01', 40, () => false),
      ...run('2026-01-01', 40, () => true),
    ];
    expect(texts(history, '2026-01-10')).toContain('[On this day] 10 January has been a good day in 1 of the last 2 years.');
  });
});

const gloomy = (history: DailyWeatherRecord[], today: string) =>
  calculateNotSoFunFacts(history, today).map((f) => `[${f.scope}] ${f.text}`);

describe('calculateNotSoFunFacts', () => {
  it('needs at least a month of data', () => {
    expect(calculateNotSoFunFacts(run('2026-01-01', 20, () => false), '2026-02-01')).toEqual([]);
  });

  it('says how long since the last good day', () => {
    const history = run('2026-01-01', 40, (i) => i === 30);
    expect(gloomy(history, '2026-02-10')).toContain("[Right now] It's been 10 days since the last good day, on 31 January 2026.");
  });

  it('gives the average good run while a streak is on', () => {
    // Runs of 1 and 3 days: average 2.
    const history = run('2026-01-01', 40, (i) => i === 5 || i >= 37);
    expect(gloomy(history, '2026-02-10')).toContain('[Right now] Enjoy it while it lasts. A run of good days lasts 2.0 days on average.');
  });

  it('reports the longest stretch without a good day', () => {
    const history = run('2026-01-01', 40, (i) => i === 0 || i === 39);
    expect(gloomy(history, '2026-03-01')).toContain('[All time] The longest stretch without a good day lasted 38 days, from 2 January to 8 February 2026.');
  });

  it('counts finished months with no good day, ignoring the current month', () => {
    const history = run('2026-01-01', 70, () => false);
    const facts = gloomy(history, '2026-03-11');
    expect(facts).toContain("[All time] 2 separate months went without a single good day: January 2026 and February 2026.");
  });

  it('counts weeks with a good weekday but no good weekend day', () => {
    // 5 Jan 2026 is a Monday. Good on Mondays only.
    const history = run('2026-01-05', 35, (i) => i % 7 === 0);
    expect(gloomy(history, '2026-03-01')).toContain("[All time] 5 times, the week had a good day and the weekend didn't. Classic.");
  });

  it('counts calm, dry days that missed by less than a degree', () => {
    // Summer needs 19°C; 18.5 is a near miss, 17 is not.
    const history = [
      ...run('2026-01-01', 30, () => false),
      record('2026-02-01', { ...GOOD, temperature: 18.5 }),
      record('2026-02-02', { ...GOOD, temperature: 17 }),
    ];
    expect(gloomy(history, '2026-03-01')).toContain('[All time] 1 day was calm and dry, and missed out by less than a degree. So close.');
  });

  it('says every year when a date has always been bad, and keeps a zero out of the fun facts', () => {
    const history = [...run('2024-01-01', 40, () => false), ...run('2025-01-01', 40, () => false), ...run('2026-01-01', 40, () => true)];
    expect(gloomy(history, '2026-01-10')).toContain('[On this day] 10 January has been a bad day in every one of the last 2 years.');
    expect(texts(history, '2026-01-10').some((f) => f.includes('has been a good day in 0'))).toBe(false);
  });
});
