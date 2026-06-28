import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockSql = vi.fn(async () => [] as unknown[]) as ReturnType<typeof vi.fn> & {
  unsafe: ReturnType<typeof vi.fn>;
};
mockSql.unsafe = vi.fn((s: string) => s);

vi.mock('../db', () => ({ sql: mockSql }));

// Imported after the mock so the module under test picks up the mocked `sql`.
const {
  getTodaysNZTDate,
  getTodaysRecord,
  getHistoricalRecords,
  getAllHistoricalRecords,
  upsertWeatherRecord,
  fetchLiveWeather,
  fetchAndStoreBatch,
} = await import('../weather');

beforeEach(() => {
  mockSql.mockReset();
  mockSql.mockResolvedValue([]);
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── getTodaysNZTDate ─────────────────────────────────────────────────────────

describe('getTodaysNZTDate', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(getTodaysNZTDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('rolls over to the next NZT day before UTC midnight (NZ is UTC+12/+13)', () => {
    // 2025-12-31T13:00:00Z is already 2026-01-01 in NZT (UTC+13 in NZDT).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-31T13:00:00Z'));
    expect(getTodaysNZTDate()).toBe('2026-01-01');
  });

  it('matches the UTC day when well within NZT daytime hours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T01:00:00Z')); // 14:00 NZDT same day
    expect(getTodaysNZTDate()).toBe('2026-03-15');
  });
});

// ── DB-backed reads/writes (sql mocked) ─────────────────────────────────────

describe('getTodaysRecord', () => {
  it('returns the first row when found', async () => {
    mockSql.mockResolvedValue([{ date: '2026-06-28', temperature: 12 }]);
    const result = await getTodaysRecord();
    expect(result).toEqual({ date: '2026-06-28', temperature: 12 });
  });

  it('returns null when no row matches', async () => {
    mockSql.mockResolvedValue([]);
    expect(await getTodaysRecord()).toBeNull();
  });
});

describe('getHistoricalRecords', () => {
  it('returns all rows from the query', async () => {
    const rows = [{ date: '2026-06-01' }, { date: '2026-06-02' }];
    mockSql.mockResolvedValue(rows);
    expect(await getHistoricalRecords('2026-06-01', '2026-06-02')).toEqual(rows);
  });
});

describe('getAllHistoricalRecords', () => {
  it('returns all rows from the query', async () => {
    const rows = [{ date: '2026-01-01' }];
    mockSql.mockResolvedValue(rows);
    expect(await getAllHistoricalRecords()).toEqual(rows);
  });
});

describe('upsertWeatherRecord', () => {
  it('calls sql with the record values', async () => {
    await upsertWeatherRecord({
      date: '2026-06-28', temperature: 10, wind_speed: 20, rain: 0, sunniness: 50,
    });
    expect(mockSql).toHaveBeenCalledTimes(1);
  });
});

// ── fetchLiveWeather (fetch mocked) ──────────────────────────────────────────

const hourlyOf = (days: number, fill = 5) => Array.from({ length: days * 24 }, () => fill);

const validOpenMeteoResponse = (days = 7) => ({
  daily: {
    time: Array.from({ length: days }, (_, i) => `2026-06-${String(28 + i).padStart(2, '0')}`),
    temperature_2m_max: Array.from({ length: days }, () => 12),
    weather_code: Array.from({ length: days }, () => 1),
  },
  hourly: {
    precipitation: hourlyOf(days, 0),
    wind_speed_10m: hourlyOf(days, 10),
  },
});

describe('fetchLiveWeather', () => {
  it('returns today + forecast on a valid response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => validOpenMeteoResponse(7),
    })));

    const result = await fetchLiveWeather();
    expect(result.temperature).toBe(12);
    expect(result.windSpeed).toBe(10);
    expect(result.rain).toBe(0);
    expect(result.forecast).toHaveLength(6);
  });

  it('throws when the HTTP response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    await expect(fetchLiveWeather()).rejects.toThrow(/HTTP error/);
  });

  it('throws when hourly arrays are shorter than 18 entries', async () => {
    const bad = validOpenMeteoResponse(7);
    bad.hourly.precipitation = bad.hourly.precipitation.slice(0, 10);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => bad })));
    await expect(fetchLiveWeather()).rejects.toThrow(/incomplete data/);
  });

  it('throws when daily.temperature_2m_max[0] is missing', async () => {
    const bad = validOpenMeteoResponse(7);
    // @ts-expect-error - simulating a malformed API response
    bad.daily.temperature_2m_max[0] = undefined;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => bad })));
    await expect(fetchLiveWeather()).rejects.toThrow(/incomplete data/);
  });
});

// ── fetchAndStoreBatch (fetch + sql mocked) ──────────────────────────────────

describe('fetchAndStoreBatch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-29T01:00:00Z')); // 2026-06-29 in NZT
  });

  it('stores only days up to today and returns todayRecord', async () => {
    const data = validOpenMeteoResponse(3);
    data.daily.time = ['2026-06-27', '2026-06-28', '2026-06-29'];
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => data })));
    mockSql.mockResolvedValue([]);

    const result = await fetchAndStoreBatch(3);
    expect(result.stored).toBe(3);
    expect(result.todayRecord?.date).toBe('2026-06-29');
  });

  it('excludes future days from the response (defensive against API drift)', async () => {
    const data = validOpenMeteoResponse(3);
    data.daily.time = ['2026-06-28', '2026-06-29', '2026-06-30'];
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => data })));
    mockSql.mockResolvedValue([]);

    const result = await fetchAndStoreBatch(3);
    expect(result.stored).toBe(2); // 06-30 is after the stubbed "today"
  });

  it('throws when hourly arrays are too short for the requested day count', async () => {
    const data = validOpenMeteoResponse(3);
    data.hourly.precipitation = hourlyOf(2); // needs 3 days' worth, only has 2
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => data })));
    await expect(fetchAndStoreBatch(3)).rejects.toThrow(/incomplete data/);
  });

  it('throws when daily arrays are missing entirely', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ daily: {}, hourly: {} }) })));
    await expect(fetchAndStoreBatch(3)).rejects.toThrow(/incomplete data/);
  });

  it('throws when the HTTP response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    await expect(fetchAndStoreBatch(3)).rejects.toThrow(/Open-Meteo error/);
  });
});
