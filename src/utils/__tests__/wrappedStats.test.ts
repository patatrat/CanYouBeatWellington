import { describe, it, expect } from 'vitest';
import { computeWrapped, isPlaceholderRecord } from '../wrappedStats';
import { canViewWrapped, isWrappedReleased } from '@/lib/wrapped-release';
import type { DailyWeatherRecord } from '@/types/db';
import type { ActiveSpecialDate } from '@/lib/special-dates-logic';

// Summer (Jan–Mar) rules: temp >= 19, wind < 30, rain <= 0.1.
const GOOD = { temperature: 22, wind_speed: 10, rain: 0 };
const BAD = { temperature: 15, wind_speed: 45, rain: 6 };

const rec = (date: string, weather: Partial<DailyWeatherRecord>, votes: [number, number] = [0, 0]): DailyWeatherRecord => ({
  date,
  temperature: 0,
  wind_speed: 0,
  rain: 0,
  feels_like: null,
  snowfall: null,
  sunniness: null,
  agree_count: votes[0],
  disagree_count: votes[1],
  created_at: '',
  ...weather,
});

const special = (overrides: Partial<ActiveSpecialDate>): ActiveSpecialDate => ({
  def_id: 1, slug: 'test', title: 'Test Date', kind: 'sporting', recurrence_rule: null,
  recurring: false, quip_override: null, scenario_quips: null, background_key: null,
  effect: 'none', link_url: null, link_label: null, active: true, occurrence_id: 1,
  start_date: '2026-01-01', end_date: '2026-01-01', status: 'confirmed',
  verdict_override: null, outcome_note: null, ...overrides,
});

describe('computeWrapped', () => {
  const records = [
    rec('2026-01-01', GOOD, [3, 1]),
    rec('2026-01-02', GOOD, [2, 0]),
    rec('2026-01-03', GOOD),
    rec('2026-01-04', BAD, [1, 3]),
    // 2026-01-05 missing entirely
    rec('2026-01-06', BAD),
    rec('2026-01-07', { temperature: 0, wind_speed: 0, rain: 0 }), // zeroed placeholder
    rec('2026-01-08', BAD),
    rec('2025-12-31', GOOD), // outside the year, ignored
  ];

  it('counts good/bad days and treats placeholders and gaps as missing', () => {
    const s = computeWrapped(2026, records, [], '2026-01-08');
    expect(s.isPartialYear).toBe(true);
    expect(s.daysElapsed).toBe(8);
    expect(s.recordedDays).toBe(6);
    expect(s.missingDates).toEqual(['2026-01-05', '2026-01-07']);
    expect(s.goodDays).toBe(3);
    expect(s.badDays).toBe(3);
  });

  it('breaks streaks across missing days', () => {
    const s = computeWrapped(2026, records, [], '2026-01-08');
    expect(s.longestGoodStreak).toEqual({ length: 3, start: '2026-01-01', end: '2026-01-03' });
    // 01-04 bad, 01-05 missing, 01-06 bad: the gap stops the run at 1.
    expect(s.longestBadStreak?.length).toBe(1);
  });

  it('compares disagreement on good vs bad days', () => {
    const s = computeWrapped(2026, records, [], '2026-01-08');
    expect(s.votes.agree).toBe(6);
    expect(s.votes.disagree).toBe(4);
    expect(s.votes.firstVoteDate).toBe('2026-01-01');
    expect(s.votes.onGoodDays.disagreeRate).toBeCloseTo(1 / 6);
    expect(s.votes.onBadDays.disagreeRate).toBeCloseTo(3 / 4);
  });

  it('applies special-date verdict overrides and reports them', () => {
    const s = computeWrapped(2026, records, [
      special({ start_date: '2026-01-04', end_date: '2026-01-04', verdict_override: true, title: 'Hurricanes win' }),
    ], '2026-01-08');
    expect(s.goodDays).toBe(4);
    expect(s.savedBySpecialDates).toEqual([{ date: '2026-01-04', title: 'Hurricanes win' }]);
    expect(s.longestGoodStreak?.length).toBe(4);
  });

  it('bins wind speeds with the lower bound inclusive', () => {
    const s = computeWrapped(2026, [
      rec('2026-01-01', { ...GOOD, wind_speed: 9.99 }),
      rec('2026-01-02', { ...GOOD, wind_speed: 10 }),
      rec('2026-01-03', { ...GOOD, wind_speed: 30 }),
      rec('2026-01-04', { ...GOOD, wind_speed: 72 }),
    ], [], '2026-12-31');
    expect(s.windBins.map((b) => b.count)).toEqual([1, 1, 0, 1, 1]);
  });

  it('ranks seasons by share of good days and finds the extremes', () => {
    const s = computeWrapped(2026, [
      rec('2026-01-10', GOOD),
      rec('2026-07-10', { temperature: 14, wind_speed: 5, rain: 0 }), // good Winter day
      rec('2026-07-11', { temperature: 14, wind_speed: 5, rain: 0 }),
      rec('2026-07-12', { temperature: 9, wind_speed: 50, rain: 22, snowfall: 0.7 }),
    ], [], '2026-12-31');
    expect(s.isPartialYear).toBe(false);
    // Summer 1 of 1 (100%) beats Winter 2 of 3 (67%) despite fewer good days.
    expect(s.seasons.map((x) => x.label)).toEqual(['Summer', 'Winter']);
    expect(s.rainiestDay).toEqual({ date: '2026-07-12', rain: 22 });
    expect(s.snowDays).toBe(1);
    expect(s.rainDays).toBe(1);
  });
});

describe('vote insights', () => {
  // Winter (Jul–Aug) rules: temp >= 13, wind < 30, rain <= 0.1.
  const COLD_CALM_DRY = { temperature: 11, wind_speed: 10, rain: 0 };
  const WINDY_WET = { temperature: 11, wind_speed: 50, rain: 8 };
  const WINTER_GOOD = { temperature: 15, wind_speed: 10, rain: 0 };
  const records = [
    rec('2026-07-01', COLD_CALM_DRY, [6, 6]), // 50% disagree
    rec('2026-07-02', COLD_CALM_DRY, [2, 1]), // below the per-day floor
    rec('2026-07-03', WINDY_WET, [12, 0]),
    rec('2026-07-04', WINTER_GOOD, [9, 1]),
    rec('2026-07-05', WINTER_GOOD, [1, 0]),
  ];
  const s = computeWrapped(2026, records, [], '2026-12-31');

  it('groups votes by why a day failed, most disputed first', () => {
    expect(s.votes.byReason.map((g) => g.reason)).toEqual(['cold', 'good', 'wind', 'rain']);
    const cold = s.votes.byReason[0];
    expect(cold.days).toBe(2);
    expect(cold.disagreeRate).toBeCloseTo(7 / 15);
    // A windy, wet day counts under both reasons.
    expect(s.votes.byReason.find((g) => g.reason === 'wind')?.days).toBe(1);
    expect(s.votes.byReason.find((g) => g.reason === 'rain')?.days).toBe(1);
  });

  it('drops reason groups below the vote floor', () => {
    const thin = computeWrapped(2026, [rec('2026-07-01', COLD_CALM_DRY, [3, 3])], [], '2026-12-31');
    expect(thin.votes.byReason).toEqual([]);
  });

  it('picks the most contested, most unanimous and busiest days', () => {
    expect(s.votes.mostContested?.date).toBe('2026-07-01');
    // 07-03 (12-0) beats 07-05 (1-0), which is under the per-day floor.
    expect(s.votes.mostUnanimous?.date).toBe('2026-07-03');
    expect(s.votes.busiest?.date).toBe('2026-07-01');
  });

  it('excludes days an override ruled bad despite good weather', () => {
    const o = computeWrapped(2026, [rec('2026-07-01', WINTER_GOOD, [4, 8])], [
      special({ start_date: '2026-07-01', end_date: '2026-07-01', verdict_override: false }),
    ], '2026-12-31');
    expect(o.votes.byReason).toEqual([]);
  });
});

describe('isPlaceholderRecord', () => {
  it('only flags rows that are zero on all three measures', () => {
    expect(isPlaceholderRecord({ temperature: 0, wind_speed: 0, rain: 0 })).toBe(true);
    expect(isPlaceholderRecord({ temperature: 0, wind_speed: 12, rain: 0 })).toBe(false);
  });
});

describe('wrapped release gate', () => {
  it('hides unreleased years on Vercel production only', () => {
    expect(canViewWrapped(2026, { VERCEL_ENV: 'production' })).toBe(false);
    expect(canViewWrapped(2026, { VERCEL_ENV: 'preview' })).toBe(true);
    expect(canViewWrapped(2026, {})).toBe(true);
  });

  it('shows a year on production once it is listed as released', () => {
    const env = { VERCEL_ENV: 'production', WRAPPED_RELEASED_YEARS: '2025, 2026' };
    expect(isWrappedReleased(2026, env)).toBe(true);
    expect(canViewWrapped(2026, env)).toBe(true);
    expect(canViewWrapped(2027, env)).toBe(false);
  });
});
