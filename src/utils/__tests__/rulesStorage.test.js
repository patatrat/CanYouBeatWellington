import { describe, it, expect, beforeEach } from 'vitest';
import { loadRules, saveRules, countCriteriaMet } from '../rulesStorage';

const DEFAULT_RULES = { minTemp: 18, maxWind: 20, maxRain: 0 };

beforeEach(() => {
  localStorage.clear();
});

describe('loadRules', () => {
  it('returns default rules when nothing is stored', () => {
    expect(loadRules()).toEqual(DEFAULT_RULES);
  });

  it('returns saved rules when present', () => {
    const custom = { minTemp: 20, maxWind: 15, maxRain: 1 };
    saveRules(custom);
    expect(loadRules()).toEqual(custom);
  });
});

describe('countCriteriaMet', () => {
  const rules = DEFAULT_RULES;

  it('returns 3 when all criteria are met — good day', () => {
    expect(countCriteriaMet({ temperature: 22, windSpeed: 10, rain: 0 }, rules)).toBe(3);
  });

  it('returns 0 when no criteria are met', () => {
    expect(countCriteriaMet({ temperature: 10, windSpeed: 40, rain: 5 }, rules)).toBe(0);
  });

  // Temperature boundary
  it('passes temperature at exactly the minimum (18°C)', () => {
    expect(countCriteriaMet({ temperature: 18, windSpeed: 10, rain: 0 }, rules)).toBe(3);
  });

  it('fails temperature one tenth below the minimum (17.9°C)', () => {
    expect(countCriteriaMet({ temperature: 17.9, windSpeed: 10, rain: 0 }, rules)).toBe(2);
  });

  // Wind boundary
  it('passes wind strictly below the maximum (19.9 km/h)', () => {
    expect(countCriteriaMet({ temperature: 22, windSpeed: 19.9, rain: 0 }, rules)).toBe(3);
  });

  it('fails wind at exactly the maximum (20 km/h is not strictly less than)', () => {
    expect(countCriteriaMet({ temperature: 22, windSpeed: 20, rain: 0 }, rules)).toBe(2);
  });

  // Rain boundary
  it('passes rain at exactly 0 mm', () => {
    expect(countCriteriaMet({ temperature: 22, windSpeed: 10, rain: 0 }, rules)).toBe(3);
  });

  it('fails rain above 0 mm', () => {
    expect(countCriteriaMet({ temperature: 22, windSpeed: 10, rain: 0.1 }, rules)).toBe(2);
  });

  // Partial passes
  it('returns 2 when only temperature fails', () => {
    expect(countCriteriaMet({ temperature: 15, windSpeed: 10, rain: 0 }, rules)).toBe(2);
  });

  it('returns 2 when only wind fails', () => {
    expect(countCriteriaMet({ temperature: 22, windSpeed: 25, rain: 0 }, rules)).toBe(2);
  });

  it('returns 2 when only rain fails', () => {
    expect(countCriteriaMet({ temperature: 22, windSpeed: 10, rain: 2 }, rules)).toBe(2);
  });

  it('returns 1 when only temperature passes', () => {
    expect(countCriteriaMet({ temperature: 22, windSpeed: 25, rain: 2 }, rules)).toBe(1);
  });
});
