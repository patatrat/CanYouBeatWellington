import { describe, it, expect } from 'vitest';
import { getSeasonClockAngle, findSeasonArc, SEASON_ARCS } from '../seasonClock';
import { getSeasonLabel } from '../rulesStorage';

const everyDay = (year: number): string[] => {
  const days: string[] = [];
  for (let t = Date.UTC(year, 0, 1); t < Date.UTC(year + 1, 0, 1); t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
};

// Is angle inside [start, end), allowing for arcs that wrap past 360.
const inArc = (angle: number, start: number, end: number) =>
  [angle, angle + 360].some((a) => a >= start && a < end);

describe('getSeasonClockAngle', () => {
  it('every arc covers the season the rules say that day is in', () => {
    for (const day of [...everyDay(2026), ...everyDay(2028)]) {
      expect(findSeasonArc(day).seasons).toContain(getSeasonLabel(day));
    }
  });

  it('puts every day inside its own arc', () => {
    for (const day of [...everyDay(2026), ...everyDay(2028)]) {
      const { start, end } = findSeasonArc(day);
      expect(inArc(getSeasonClockAngle(day), start, end)).toBe(true);
    }
  });

  it('moves clockwise every day, wrapping once at New Year', () => {
    const angles = everyDay(2026).map(getSeasonClockAngle);
    let wraps = 0;
    for (let i = 1; i < angles.length; i++) {
      if (angles[i] < angles[i - 1]) wraps++;
    }
    // The only backwards step is crossing 12 o'clock in Spring 2.
    expect(wraps).toBe(1);
  });

  it('crosses from Spring 2 into Summer smoothly over New Year', () => {
    expect(getSeasonClockAngle('2026-12-31')).toBeCloseTo(13.3, 0);
    expect(getSeasonClockAngle('2027-01-01')).toBeCloseTo(14.1, 0);
  });

  it('lands mid-arc in the middle of a season', () => {
    // Day 31 of 61 in Shitsville.
    const { start, end } = SEASON_ARCS.find((a) => a.seasons.includes('Shitsville'))!;
    expect(getSeasonClockAngle('2026-10-31')).toBeCloseTo((start + end) / 2, 0);
  });

  it('handles leap-year February', () => {
    const { end } = findSeasonArc('2028-02-29');
    expect(getSeasonClockAngle('2028-03-31')).toBeLessThan(end);
  });
});
