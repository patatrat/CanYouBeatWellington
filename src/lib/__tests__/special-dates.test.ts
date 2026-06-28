import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ActiveSpecialDate } from '../special-dates';

const mockSql = vi.fn(async () => [] as unknown[]) as ReturnType<typeof vi.fn> & {
  unsafe: ReturnType<typeof vi.fn>;
};
mockSql.unsafe = vi.fn((s: string) => s);

vi.mock('../db', () => ({ sql: mockSql }));

const {
  computeFixedRuleDate,
  pickPrimarySpecialDate,
  resolveVerdict,
  getActiveSpecialDates,
  getSpecialDatesForRange,
  ensureUpcomingOccurrences,
  resolveSportingOccurrence,
} = await import('../special-dates');

beforeEach(() => {
  mockSql.mockReset();
  mockSql.mockResolvedValue([]);
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.useRealTimers();
});

// Minimal stub builder — only the fields each test actually exercises matter.
const stub = (overrides: Partial<ActiveSpecialDate>): ActiveSpecialDate => ({
  def_id: 1,
  slug: 'test',
  title: 'Test Date',
  kind: 'oneoff',
  recurrence_rule: null,
  recurring: false,
  quip_override: null,
  background_key: null,
  effect: 'none',
  link_url: null,
  link_label: null,
  active: true,
  occurrence_id: 1,
  start_date: '2026-06-28',
  end_date: '2026-06-28',
  status: 'confirmed',
  verdict_override: null,
  outcome_note: null,
  ...overrides,
});

// ── computeFixedRuleDate ─────────────────────────────────────────────────────

describe('computeFixedRuleDate', () => {
  it('computes "fixed:month:day" rules directly', () => {
    expect(computeFixedRuleDate('fixed:2:6', 2026)).toEqual({ start: '2026-02-06', end: '2026-02-06' });
    expect(computeFixedRuleDate('fixed:4:25', 2027)).toEqual({ start: '2027-04-25', end: '2027-04-25' });
  });

  it('computes the 4th Monday of January (Wellington Anniversary Day) across known years', () => {
    // 2026: Jan 1 is a Thursday → Mondays fall on 5, 12, 19, 26.
    expect(computeFixedRuleDate('nth_weekday:4:1:1', 2026)).toEqual({ start: '2026-01-26', end: '2026-01-26' });
    // 2027: Jan 1 is a Friday → Mondays fall on 4, 11, 18, 25.
    expect(computeFixedRuleDate('nth_weekday:4:1:1', 2027)).toEqual({ start: '2027-01-25', end: '2027-01-25' });
    // 2024: Jan 1 is a Monday → Mondays fall on 1, 8, 15, 22, 29 (a 5-Monday January).
    // The 4th Monday must still resolve to 22, not be thrown off by the 5th existing.
    expect(computeFixedRuleDate('nth_weekday:4:1:1', 2024)).toEqual({ start: '2024-01-22', end: '2024-01-22' });
  });

  it('throws for an nth weekday that does not exist in the month', () => {
    // No month ever has a 6th occurrence of any weekday.
    expect(() => computeFixedRuleDate('nth_weekday:6:1:1', 2026)).toThrow();
  });

  it('throws for an unrecognised rule format', () => {
    expect(() => computeFixedRuleDate('matariki:2026', 2026)).toThrow(/Unknown recurrence_rule/);
  });
});

// ── pickPrimarySpecialDate ───────────────────────────────────────────────────

describe('pickPrimarySpecialDate', () => {
  it('returns null for an empty list', () => {
    expect(pickPrimarySpecialDate([])).toBeNull();
  });

  it('returns the only date when there is exactly one', () => {
    const only = stub({ occurrence_id: 5 });
    expect(pickPrimarySpecialDate([only])).toBe(only);
  });

  it('prefers the shorter date range when two dates overlap', () => {
    const festival = stub({ occurrence_id: 1, start_date: '2026-03-01', end_date: '2026-03-10' });
    const oneDay = stub({ occurrence_id: 2, start_date: '2026-03-05', end_date: '2026-03-05' });
    expect(pickPrimarySpecialDate([festival, oneDay])).toBe(oneDay);
    expect(pickPrimarySpecialDate([oneDay, festival])).toBe(oneDay); // order-independent
  });

  it('tie-breaks equal-length ranges by earlier start_date', () => {
    const earlier = stub({ occurrence_id: 1, start_date: '2026-03-01', end_date: '2026-03-01' });
    const later = stub({ occurrence_id: 2, start_date: '2026-03-02', end_date: '2026-03-02' });
    expect(pickPrimarySpecialDate([later, earlier])).toBe(earlier);
  });

  it('tie-breaks equal-length, equal-start ranges by lower occurrence_id', () => {
    const lower = stub({ occurrence_id: 1, start_date: '2026-03-01', end_date: '2026-03-01' });
    const higher = stub({ occurrence_id: 2, start_date: '2026-03-01', end_date: '2026-03-01' });
    expect(pickPrimarySpecialDate([higher, lower])).toBe(lower);
  });
});

// ── resolveVerdict ───────────────────────────────────────────────────────────

describe('resolveVerdict', () => {
  it('passes the weather verdict through unchanged when there is no override', () => {
    expect(resolveVerdict(true, null)).toBe(true);
    expect(resolveVerdict(false, null)).toBe(false);
  });

  it('forces a good day even when the weather says otherwise (the "vibes override weather" case)', () => {
    expect(resolveVerdict(false, true)).toBe(true);
  });

  it('forces a bad day even when the weather says otherwise', () => {
    expect(resolveVerdict(true, false)).toBe(false);
  });
});

// ── DB-backed reads (sql mocked) ─────────────────────────────────────────────

describe('getActiveSpecialDates', () => {
  it('returns whatever rows the query produces', async () => {
    const rows = [stub({ occurrence_id: 1 })];
    mockSql.mockResolvedValue(rows);
    expect(await getActiveSpecialDates('2026-06-28')).toEqual(rows);
  });
});

describe('getSpecialDatesForRange', () => {
  it('returns whatever rows the query produces', async () => {
    const rows = [stub({ occurrence_id: 1 }), stub({ occurrence_id: 2 })];
    mockSql.mockResolvedValue(rows);
    expect(await getSpecialDatesForRange('2026-01-01', '2026-12-31')).toEqual(rows);
  });
});

// ── ensureUpcomingOccurrences (idempotency) ─────────────────────────────────

describe('ensureUpcomingOccurrences', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-28T00:00:00Z'));
  });

  it('inserts an occurrence when none exists yet for the target year', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 1, recurrence_rule: 'fixed:2:6' }]) // defs query
      .mockResolvedValueOnce([]) // existing-occurrence check: none found
      .mockResolvedValueOnce([]); // the INSERT

    const inserted = await ensureUpcomingOccurrences(0); // just this year
    expect(inserted).toBe(1);
    expect(mockSql).toHaveBeenCalledTimes(3);
  });

  it('does nothing when an occurrence already exists for the target year', async () => {
    mockSql
      .mockResolvedValueOnce([{ id: 1, recurrence_rule: 'fixed:2:6' }]) // defs query
      .mockResolvedValueOnce([{ id: 42 }]); // existing-occurrence check: found one

    const inserted = await ensureUpcomingOccurrences(0);
    expect(inserted).toBe(0);
    expect(mockSql).toHaveBeenCalledTimes(2); // no INSERT call follows
  });

  it('returns 0 and makes only the defs query when there are no fixed_rule defs', async () => {
    mockSql.mockResolvedValueOnce([]); // no defs at all

    const inserted = await ensureUpcomingOccurrences(0);
    expect(inserted).toBe(0);
    expect(mockSql).toHaveBeenCalledTimes(1);
  });
});

// ── resolveSportingOccurrence ────────────────────────────────────────────────

describe('resolveSportingOccurrence', () => {
  it('scopes the update to pending rows so a double-resolution is a no-op', async () => {
    await resolveSportingOccurrence(7, 'won', 'Phoenix won 2-1');
    expect(mockSql).toHaveBeenCalledTimes(1);
    const sqlText = (mockSql.mock.calls[0][0] as string[]).join('');
    expect(sqlText).toMatch(/status = 'pending'/);
  });

  it('maps "won" to verdict_override = true and "lost" to false', async () => {
    await resolveSportingOccurrence(1, 'won');
    expect(mockSql.mock.calls[0]).toContain(true);
    mockSql.mockClear();
    await resolveSportingOccurrence(2, 'lost');
    expect(mockSql.mock.calls[0]).toContain(false);
  });

  it('maps "draw" to no verdict override (null) rather than forcing either direction', async () => {
    await resolveSportingOccurrence(3, 'draw');
    expect(mockSql.mock.calls[0]).toContain(null);
  });

  it('sets status to cancelled (and no verdict_override) for a cancelled fixture', async () => {
    await resolveSportingOccurrence(4, 'cancelled', 'Rained off');
    const sqlText = (mockSql.mock.calls[0][0] as string[]).join('');
    expect(sqlText).toMatch(/status = 'cancelled'/);
  });
});
