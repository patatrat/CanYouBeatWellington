import { describe, it, expect } from 'vitest';
import { buildYearGrid } from '../yearGrid';
import type { DailyWeatherRecord } from '@/types/db';

// Summer (Jan–Mar) rules: temp >= 19, wind < 30, rain <= 0.1.
const rec = (date: string, temperature: number, wind_speed: number, rain: number): DailyWeatherRecord => ({
  date, temperature, wind_speed, rain,
  feels_like: null, snowfall: null, sunniness: null, agree_count: 0, disagree_count: 0, created_at: '',
});

describe('buildYearGrid', () => {
  it('lays the year out in Monday-first week columns', () => {
    // 1 Jan 2026 is a Thursday.
    const grid = buildYearGrid(2026, [], {}, '2026-12-31');
    expect(grid.cells).toHaveLength(365);
    expect(grid.cells[0]).toMatchObject({ date: '2026-01-01', col: 0, row: 3 });
    expect(grid.cells[4]).toMatchObject({ date: '2026-01-05', col: 1, row: 0 });
    expect(grid.weeks).toBe(53);
    expect(grid.monthStarts[0]).toEqual({ month: 0, col: 0 });
    expect(grid.monthStarts).toHaveLength(12);
  });

  it('handles leap years', () => {
    expect(buildYearGrid(2024, [], {}, '2024-12-31').cells).toHaveLength(366);
  });

  it('counts how many of the three checks a bad day failed', () => {
    const grid = buildYearGrid(2026, [
      rec('2026-01-01', 22, 10, 0),   // good
      rec('2026-01-02', 15, 10, 0),   // cold
      rec('2026-01-03', 15, 40, 0),   // cold + windy
      rec('2026-01-04', 15, 40, 3),   // all three
    ], {}, '2026-12-31');
    expect(grid.cells.slice(0, 4).map((c) => [c.status, c.failed])).toEqual([
      ['good', 0], ['bad', 1], ['bad', 2], ['bad', 3],
    ]);
    expect(grid.cells[2].checks).toEqual({ temp: false, wind: false, rain: true });
    expect(grid.stats).toMatchObject({ goodDays: 1, recordedDays: 4, failedAllThree: 1 });
  });

  it('judges weather only, at the 0.1mm rain tolerance', () => {
    const grid = buildYearGrid(2026, [rec('2026-01-01', 19, 29.9, 0.1)], {}, '2026-12-31');
    expect(grid.cells[0].status).toBe('good');
  });

  it('leaves future, missing and placeholder days empty', () => {
    const grid = buildYearGrid(2026, [
      rec('2026-01-02', 0, 0, 0),
      rec('2026-01-05', 22, 10, 0),
    ], {}, '2026-01-04');
    expect(grid.cells[0].status).toBe('empty');  // missing
    expect(grid.cells[1].status).toBe('empty');  // placeholder
    expect(grid.cells[4].status).toBe('empty');  // after today
    expect(grid.stats.recordedDays).toBe(0);
  });

  it('finds the longest good run, broken by gaps', () => {
    const grid = buildYearGrid(2026, [
      rec('2026-01-01', 22, 10, 0),
      rec('2026-01-02', 22, 10, 0),
      // 3 Jan missing
      rec('2026-01-04', 22, 10, 0),
      rec('2026-01-05', 22, 10, 0),
      rec('2026-01-06', 22, 10, 0),
      rec('2026-01-07', 15, 10, 0),
    ], {}, '2026-12-31');
    expect(grid.stats.longestRun).toEqual({ length: 3, start: '2026-01-04', end: '2026-01-06' });
  });

  it('picks the best month by share of good days', () => {
    const grid = buildYearGrid(2026, [
      rec('2026-01-01', 22, 10, 0), rec('2026-01-02', 15, 10, 0), rec('2026-01-03', 22, 10, 0),
      rec('2026-02-01', 22, 10, 0),
    ], {}, '2026-12-31');
    expect(grid.stats.bestMonth).toEqual({ month: 1, good: 1, total: 1 });
  });

  it('marks warning days up to today', () => {
    const warn = { colour: '#FFA500', colourName: 'Orange' };
    const grid = buildYearGrid(2026, [rec('2026-01-01', 22, 10, 0)], { '2026-01-01': warn, '2026-06-01': warn }, '2026-01-10');
    expect(grid.cells[0].warning).toEqual(warn);
    expect(grid.stats.warningDays).toBe(1);
  });
});
