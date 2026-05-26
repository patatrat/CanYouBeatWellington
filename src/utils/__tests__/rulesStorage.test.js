import { describe, it, expect } from 'vitest';
import { getSeasonLabel, getThresholds, countCriteriaMet } from '../rulesStorage';

// Helper: date string for a given month (1-based) in an arbitrary non-leap year
const d = (month) => `2025-${String(month).padStart(2, '0')}-15`;

// ── getSeasonLabel ──────────────────────────────────────────────────────────

describe('getSeasonLabel', () => {
  it('returns Summer for January', () => expect(getSeasonLabel(d(1))).toBe('Summer'));
  it('returns Summer for February', () => expect(getSeasonLabel(d(2))).toBe('Summer'));
  it('returns Summer for March', () => expect(getSeasonLabel(d(3))).toBe('Summer'));
  it('returns Autumn for April', () => expect(getSeasonLabel(d(4))).toBe('Autumn'));
  it('returns Late Autumn for May', () => expect(getSeasonLabel(d(5))).toBe('Late Autumn'));
  it('returns Late Autumn for June', () => expect(getSeasonLabel(d(6))).toBe('Late Autumn'));
  it('returns Winter for July', () => expect(getSeasonLabel(d(7))).toBe('Winter'));
  it('returns Winter for August', () => expect(getSeasonLabel(d(8))).toBe('Winter'));
  it('returns Spring 1 for September', () => expect(getSeasonLabel(d(9))).toBe('Spring 1'));
  it('returns Shitsville for October', () => expect(getSeasonLabel(d(10))).toBe('Shitsville'));
  it('returns Shitsville for November', () => expect(getSeasonLabel(d(11))).toBe('Shitsville'));
  it('returns Spring 2 for December', () => expect(getSeasonLabel(d(12))).toBe('Spring 2'));

  // Month boundary transitions
  it('March is Summer, April is Autumn', () => {
    expect(getSeasonLabel('2025-03-31')).toBe('Summer');
    expect(getSeasonLabel('2025-04-01')).toBe('Autumn');
  });
  it('June is Late Autumn, July is Winter', () => {
    expect(getSeasonLabel('2025-06-30')).toBe('Late Autumn');
    expect(getSeasonLabel('2025-07-01')).toBe('Winter');
  });
  it('accepts a Date object', () => {
    expect(getSeasonLabel(new Date('2025-10-01'))).toBe('Shitsville');
  });
});

// ── getThresholds ───────────────────────────────────────────────────────────

describe('getThresholds', () => {
  it('Summer: minTemp 19, maxWind 30, maxRain 0', () =>
    expect(getThresholds(d(1))).toEqual({ minTemp: 19, maxWind: 30, maxRain: 0 }));

  it('Autumn (Apr): minTemp 16, maxWind 30, maxRain 0', () =>
    expect(getThresholds(d(4))).toEqual({ minTemp: 16, maxWind: 30, maxRain: 0 }));

  it('Late Autumn (May–Jun): minTemp 14, maxWind 30, maxRain 0', () =>
    expect(getThresholds(d(5))).toEqual({ minTemp: 14, maxWind: 30, maxRain: 0 }));

  it('Winter: minTemp 13, maxWind 30, maxRain 0', () =>
    expect(getThresholds(d(7))).toEqual({ minTemp: 13, maxWind: 30, maxRain: 0 }));

  it('Spring 1: minTemp 14, maxWind 30, maxRain 0', () =>
    expect(getThresholds(d(9))).toEqual({ minTemp: 14, maxWind: 30, maxRain: 0 }));

  it('Shitsville: minTemp 16, maxWind 30, maxRain 0', () =>
    expect(getThresholds(d(10))).toEqual({ minTemp: 16, maxWind: 30, maxRain: 0 }));

  it('Spring 2: minTemp 18, maxWind 30, maxRain 0', () =>
    expect(getThresholds(d(12))).toEqual({ minTemp: 18, maxWind: 30, maxRain: 0 }));
});

// ── countCriteriaMet ────────────────────────────────────────────────────────

describe('countCriteriaMet', () => {
  // Good day in each season
  it('Summer: all criteria met → 3', () =>
    expect(countCriteriaMet({ temperature: 22, windSpeed: 15, rain: 0 }, d(1))).toBe(3));
  it('Autumn (Apr): all criteria met → 3', () =>
    expect(countCriteriaMet({ temperature: 18, windSpeed: 15, rain: 0 }, d(4))).toBe(3));
  it('Late Autumn (May): all criteria met → 3', () =>
    expect(countCriteriaMet({ temperature: 15, windSpeed: 15, rain: 0 }, d(5))).toBe(3));
  it('Winter: all criteria met → 3', () =>
    expect(countCriteriaMet({ temperature: 14, windSpeed: 15, rain: 0 }, d(7))).toBe(3));
  it('Spring 1: all criteria met → 3', () =>
    expect(countCriteriaMet({ temperature: 15, windSpeed: 15, rain: 0 }, d(9))).toBe(3));
  it('Shitsville: all criteria met → 3', () =>
    expect(countCriteriaMet({ temperature: 17, windSpeed: 15, rain: 0 }, d(10))).toBe(3));
  it('Spring 2: all criteria met → 3', () =>
    expect(countCriteriaMet({ temperature: 19, windSpeed: 15, rain: 0 }, d(12))).toBe(3));

  // No criteria met
  it('returns 0 when all criteria fail', () =>
    expect(countCriteriaMet({ temperature: 5, windSpeed: 50, rain: 10 }, d(1))).toBe(0));

  // Temperature boundaries
  it('Summer: passes at exactly 19°C', () =>
    expect(countCriteriaMet({ temperature: 19, windSpeed: 15, rain: 0 }, d(2))).toBe(3));
  it('Summer: fails at 18.9°C', () =>
    expect(countCriteriaMet({ temperature: 18.9, windSpeed: 15, rain: 0 }, d(2))).toBe(2));

  it('Autumn (Apr): passes at exactly 16°C', () =>
    expect(countCriteriaMet({ temperature: 16, windSpeed: 15, rain: 0 }, d(4))).toBe(3));
  it('Autumn (Apr): fails at 15.9°C', () =>
    expect(countCriteriaMet({ temperature: 15.9, windSpeed: 15, rain: 0 }, d(4))).toBe(2));

  it('Late Autumn (May): passes at exactly 14°C', () =>
    expect(countCriteriaMet({ temperature: 14, windSpeed: 15, rain: 0 }, d(5))).toBe(3));
  it('Late Autumn (May): fails at 13.9°C', () =>
    expect(countCriteriaMet({ temperature: 13.9, windSpeed: 15, rain: 0 }, d(5))).toBe(2));

  it('Winter: passes at exactly 13°C', () =>
    expect(countCriteriaMet({ temperature: 13, windSpeed: 15, rain: 0 }, d(8))).toBe(3));
  it('Winter: fails at 12.9°C', () =>
    expect(countCriteriaMet({ temperature: 12.9, windSpeed: 15, rain: 0 }, d(8))).toBe(2));

  it('Spring 1: passes at exactly 14°C', () =>
    expect(countCriteriaMet({ temperature: 14, windSpeed: 15, rain: 0 }, d(9))).toBe(3));
  it('Spring 1: fails at 13.9°C', () =>
    expect(countCriteriaMet({ temperature: 13.9, windSpeed: 15, rain: 0 }, d(9))).toBe(2));

  it('Shitsville: passes at exactly 16°C', () =>
    expect(countCriteriaMet({ temperature: 16, windSpeed: 15, rain: 0 }, d(11))).toBe(3));
  it('Shitsville: fails at 15.9°C', () =>
    expect(countCriteriaMet({ temperature: 15.9, windSpeed: 15, rain: 0 }, d(11))).toBe(2));

  it('Spring 2: passes at exactly 18°C', () =>
    expect(countCriteriaMet({ temperature: 18, windSpeed: 15, rain: 0 }, d(12))).toBe(3));
  it('Spring 2: fails at 17.9°C', () =>
    expect(countCriteriaMet({ temperature: 17.9, windSpeed: 15, rain: 0 }, d(12))).toBe(2));

  // Wind boundary (same across all seasons)
  it('passes wind strictly below 30 km/h (29.9)', () =>
    expect(countCriteriaMet({ temperature: 22, windSpeed: 29.9, rain: 0 }, d(1))).toBe(3));
  it('fails wind at exactly 30 km/h (not strictly less than)', () =>
    expect(countCriteriaMet({ temperature: 22, windSpeed: 30, rain: 0 }, d(1))).toBe(2));

  // Rain boundary (same across all seasons)
  it('passes rain at exactly 0 mm', () =>
    expect(countCriteriaMet({ temperature: 22, windSpeed: 15, rain: 0 }, d(1))).toBe(3));
  it('fails rain above 0 mm (0.1 mm)', () =>
    expect(countCriteriaMet({ temperature: 22, windSpeed: 15, rain: 0.1 }, d(1))).toBe(2));

  // Partial passes
  it('returns 2 when only temperature fails', () =>
    expect(countCriteriaMet({ temperature: 10, windSpeed: 15, rain: 0 }, d(1))).toBe(2));
  it('returns 2 when only wind fails', () =>
    expect(countCriteriaMet({ temperature: 22, windSpeed: 31, rain: 0 }, d(1))).toBe(2));
  it('returns 2 when only rain fails', () =>
    expect(countCriteriaMet({ temperature: 22, windSpeed: 15, rain: 1 }, d(1))).toBe(2));
  it('returns 1 when only temperature passes', () =>
    expect(countCriteriaMet({ temperature: 22, windSpeed: 31, rain: 1 }, d(1))).toBe(1));

  // Month boundary: March (Summer) vs April (Autumn) vs May (Late Autumn)
  it('16°C qualifies in Autumn (April) but not in Summer (March)', () => {
    const weather = { temperature: 16, windSpeed: 15, rain: 0 };
    expect(countCriteriaMet(weather, '2025-04-15')).toBe(3); // Autumn threshold 16°C
    expect(countCriteriaMet(weather, '2025-03-15')).toBe(2); // Summer threshold 19°C
  });
  it('14°C qualifies in Late Autumn (May) but not in Autumn (April)', () => {
    const weather = { temperature: 14, windSpeed: 15, rain: 0 };
    expect(countCriteriaMet(weather, '2025-05-15')).toBe(3); // Late Autumn threshold 14°C
    expect(countCriteriaMet(weather, '2025-04-15')).toBe(2); // Autumn threshold 16°C
  });

  // defaults to today when no date provided (smoke test — just check it returns a number)
  it('defaults to today when date is omitted', () => {
    const result = countCriteriaMet({ temperature: 20, windSpeed: 15, rain: 0 });
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(3);
  });
});
