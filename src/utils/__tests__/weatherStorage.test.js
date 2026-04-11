import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateSunniness,
  calculateDaytimeRain,
  saveWeatherData,
  getStoredWeatherData,
} from '../weatherStorage';

beforeEach(() => {
  localStorage.clear();
});

describe('calculateSunniness', () => {
  it('returns 100 for clear sky (code 0)', () => {
    expect(calculateSunniness(0)).toBe(100);
  });

  it('returns 100 at the top of the clear/cloudy boundary (code 3)', () => {
    expect(calculateSunniness(3)).toBe(100);
  });

  it('returns 70 just above the clear boundary (code 4)', () => {
    expect(calculateSunniness(4)).toBe(70);
  });

  it('returns 70 at the fog boundary (code 48)', () => {
    expect(calculateSunniness(48)).toBe(70);
  });

  it('returns 50 for drizzle/rain (code 49)', () => {
    expect(calculateSunniness(49)).toBe(50);
  });

  it('returns 50 at the rain boundary (code 67)', () => {
    expect(calculateSunniness(67)).toBe(50);
  });

  it('returns 30 for snow (code 68)', () => {
    expect(calculateSunniness(68)).toBe(30);
  });

  it('returns 30 at the snow boundary (code 77)', () => {
    expect(calculateSunniness(77)).toBe(30);
  });

  it('returns 10 for thunderstorms and beyond (code 78)', () => {
    expect(calculateSunniness(78)).toBe(10);
  });

  it('returns 10 for extreme weather codes', () => {
    expect(calculateSunniness(99)).toBe(10);
  });
});

describe('calculateDaytimeRain', () => {
  it('sums only hours 6–17 (daytime)', () => {
    // 24 hours, all zero except hour 12 (index 12) = 5mm
    const hourly = Array(24).fill(0);
    hourly[12] = 5;
    expect(calculateDaytimeRain(hourly)).toBe(5);
  });

  it('excludes nighttime hours before 6 AM', () => {
    const hourly = Array(24).fill(0);
    hourly[3] = 10; // 3 AM — should be excluded
    expect(calculateDaytimeRain(hourly)).toBe(0);
  });

  it('excludes nighttime hours from 6 PM onward', () => {
    const hourly = Array(24).fill(0);
    hourly[20] = 10; // 8 PM — should be excluded
    expect(calculateDaytimeRain(hourly)).toBe(0);
  });

  it('sums multiple daytime hours correctly', () => {
    const hourly = Array(24).fill(0);
    hourly[6] = 1;
    hourly[10] = 2;
    hourly[17] = 0.5;
    expect(calculateDaytimeRain(hourly)).toBeCloseTo(3.5);
  });

  it('returns 0 for a completely dry day', () => {
    expect(calculateDaytimeRain(Array(24).fill(0))).toBe(0);
  });

  it('treats null/undefined precipitation values as 0', () => {
    const hourly = Array(24).fill(null);
    expect(calculateDaytimeRain(hourly)).toBe(0);
  });
});

describe('saveWeatherData / getStoredWeatherData', () => {
  it('returns null when nothing is stored', () => {
    expect(getStoredWeatherData()).toBeNull();
  });

  it('round-trips weather data through localStorage', () => {
    const data = { temperature: 21, windSpeed: 15, rain: 0, timestamp: '2026-04-11' };
    saveWeatherData(data);
    expect(getStoredWeatherData()).toEqual(data);
  });
});
