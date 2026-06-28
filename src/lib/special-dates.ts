import { sql } from "./db";
import { getTodaysNZTDate } from "./weather";

export type SpecialDateKind = "fixed_rule" | "moveable" | "sporting" | "oneoff";
export type OccurrenceStatus = "confirmed" | "pending" | "cancelled";
export type EffectType = "none" | "confetti" | "balloons";
export type SportingOutcome = "won" | "lost" | "draw" | "cancelled";

export interface ActiveSpecialDate {
  def_id: number;
  slug: string;
  title: string;
  kind: SpecialDateKind;
  recurrence_rule: string | null;
  recurring: boolean;
  quip_override: string | null;
  background_key: string | null;
  effect: EffectType;
  link_url: string | null;
  link_label: string | null;
  active: boolean;
  occurrence_id: number;
  start_date: string;
  end_date: string;
  status: OccurrenceStatus;
  verdict_override: boolean | null;
  outcome_note: string | null;
}

// Joined columns for a special_date_occurrences <> special_date_defs row.
// Both tables have their own `id` — aliased here to avoid collision.
const ACTIVE_DATE_COLUMNS = `
  d.id AS def_id, d.slug, d.title, d.kind, d.recurrence_rule, d.recurring,
  d.quip_override, d.background_key, d.effect, d.link_url, d.link_label, d.active,
  o.id AS occurrence_id, o.start_date::text, o.end_date::text, o.status,
  o.verdict_override, o.outcome_note
`;

// Point-in-time lookup — every special date whose range covers `date`.
// Callers wanting a single "the" special date for today should pass the
// result through pickPrimarySpecialDate().
export async function getActiveSpecialDates(date: string): Promise<ActiveSpecialDate[]> {
  const rows = await sql`
    SELECT ${sql.unsafe(ACTIVE_DATE_COLUMNS)}
    FROM special_date_occurrences o
    JOIN special_date_defs d ON d.id = o.def_id
    WHERE d.active = true AND o.status != 'cancelled'
      AND ${date}::date BETWEEN o.start_date AND o.end_date
  `;
  return rows as unknown as ActiveSpecialDate[];
}

// True range-overlap lookup — used by the History calendar, which needs
// every special date touching any day in a queried span, not just "today".
export async function getSpecialDatesForRange(from: string, to: string): Promise<ActiveSpecialDate[]> {
  const rows = await sql`
    SELECT ${sql.unsafe(ACTIVE_DATE_COLUMNS)}
    FROM special_date_occurrences o
    JOIN special_date_defs d ON d.id = o.def_id
    WHERE d.active = true AND o.status != 'cancelled'
      AND o.start_date <= ${to}::date AND o.end_date >= ${from}::date
    ORDER BY o.start_date ASC
  `;
  return rows as unknown as ActiveSpecialDate[];
}

export async function getUpcomingSpecialDates(limit = 5): Promise<ActiveSpecialDate[]> {
  const today = getTodaysNZTDate();
  const rows = await sql`
    SELECT ${sql.unsafe(ACTIVE_DATE_COLUMNS)}
    FROM special_date_occurrences o
    JOIN special_date_defs d ON d.id = o.def_id
    WHERE d.active = true AND o.status != 'cancelled' AND o.end_date >= ${today}::date
    ORDER BY o.start_date ASC
    LIMIT ${limit}
  `;
  return rows as unknown as ActiveSpecialDate[];
}

const daysBetween = (start: string, end: string): number =>
  (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000;

// Precedence when multiple special dates are active on the same day: the
// narrower (shorter) date range wins — a specific one-day event outranks a
// multi-day festival backdrop — tie-broken by start date, then occurrence id.
// Pure (no DB) so the precedence rule is independently testable.
export function pickPrimarySpecialDate(dates: ActiveSpecialDate[]): ActiveSpecialDate | null {
  if (dates.length === 0) return null;
  const sorted = [...dates].sort((a, b) => {
    const rangeDiff = daysBetween(a.start_date, a.end_date) - daysBetween(b.start_date, b.end_date);
    if (rangeDiff !== 0) return rangeDiff;
    if (a.start_date !== b.start_date) return a.start_date < b.start_date ? -1 : 1;
    return a.occurrence_id - b.occurrence_id;
  });
  return sorted[0];
}

// A non-null verdict_override always wins over the weather-computed verdict.
// This is the "vibes override weather" mechanic — e.g. a Wellington team
// winning can force a good day regardless of temperature/wind/rain.
export function resolveVerdict(weatherIsGood: boolean, override: boolean | null): boolean {
  return override ?? weatherIsGood;
}

// month: 1-12. weekday: 0(Sun)-6(Sat), matching JS Date.getDay()/getUTCDay().
// Computed in UTC throughout so the result never depends on the host's
// local timezone — this is pure calendar arithmetic, not a "now" lookup.
const getNthWeekdayOfMonth = (year: number, month: number, weekday: number, n: number): string => {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const offsetToFirst = (weekday - firstOfMonth.getUTCDay() + 7) % 7;
  const day = 1 + offsetToFirst + (n - 1) * 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) {
    throw new Error(`No ${n}th weekday ${weekday} in ${year}-${month}: would be day ${day}, month only has ${daysInMonth} days`);
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

// Computes the Gregorian Easter Sunday date for a given year via the
// "anonymous Gregorian algorithm" (Meeus/Jones/Butcher) — verified against
// known dates (2024 → Mar 31, 2026 → Apr 5, 2027 → Mar 28).
const getEasterSunday = (year: number): { month: number; day: number } => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
};

// Parses the small recurrence-rule DSL used by kind='fixed_rule' defs.
// Only three shapes are supported — there's no general RRULE engine, because
// NZ's named public holidays only ever need these patterns:
//   fixed:month:day             — e.g. "fixed:2:6" = Feb 6 (Waitangi Day)
//   nth_weekday:n:month:weekday — e.g. "nth_weekday:4:1:1" = 4th Monday of
//                                  January (Wellington Anniversary Day)
//   easter_offset:days          — signed days relative to Easter Sunday,
//                                  e.g. "easter_offset:-2" = Good Friday,
//                                  "easter_offset:1" = Easter Monday
export function computeFixedRuleDate(rule: string, year: number): { start: string; end: string } {
  const parts = rule.split(":");
  if (parts[0] === "fixed") {
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { start: date, end: date };
  }
  if (parts[0] === "nth_weekday") {
    const n = Number(parts[1]);
    const month = Number(parts[2]);
    const weekday = Number(parts[3]);
    const date = getNthWeekdayOfMonth(year, month, weekday, n);
    return { start: date, end: date };
  }
  if (parts[0] === "easter_offset") {
    const offsetDays = Number(parts[1]);
    const easter = getEasterSunday(year);
    const target = new Date(Date.UTC(year, easter.month - 1, easter.day) + offsetDays * 86_400_000);
    const date = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(target.getUTCDate()).padStart(2, "0")}`;
    return { start: date, end: date };
  }
  throw new Error(`Unknown recurrence_rule format: "${rule}"`);
}

// Idempotently regenerates this year's and next `yearsAhead` years' concrete
// occurrence(s) for every active fixed_rule def. Deliberately excludes
// `moveable` defs even when recurring=true — there's no formula for those
// (e.g. Cuba Dupa, WOW), so auto-generation must never apply to them; those
// always need a manually-entered occurrence row each year.
// Called from the daily cron as a cheap side effect — no separate yearly
// cron needed, and it self-heals if a row is ever accidentally deleted.
export async function ensureUpcomingOccurrences(yearsAhead = 1): Promise<number> {
  const currentYear = new Date().getUTCFullYear();
  const defs = (await sql`
    SELECT id, recurrence_rule FROM special_date_defs
    WHERE active = true AND kind = 'fixed_rule' AND recurring = true AND recurrence_rule IS NOT NULL
  `) as unknown as { id: number; recurrence_rule: string }[];

  let inserted = 0;
  for (const def of defs) {
    for (let year = currentYear; year <= currentYear + yearsAhead; year++) {
      const existing = await sql`
        SELECT id FROM special_date_occurrences
        WHERE def_id = ${def.id}
          AND start_date >= ${`${year}-01-01`}::date
          AND start_date <= ${`${year}-12-31`}::date
      `;
      if (existing.length > 0) continue;

      const { start, end } = computeFixedRuleDate(def.recurrence_rule, year);
      await sql`
        INSERT INTO special_date_occurrences (def_id, start_date, end_date, status)
        VALUES (${def.id}, ${start}::date, ${end}::date, 'confirmed')
      `;
      inserted++;
    }
  }
  return inserted;
}

// Flips a pending sporting occurrence once the result is known. Scoped to
// `status = 'pending'` so resolving twice is a no-op rather than silently
// overwriting a previously-recorded outcome.
export async function resolveSportingOccurrence(
  occurrenceId: number,
  outcome: SportingOutcome,
  note?: string,
): Promise<void> {
  if (outcome === "cancelled") {
    await sql`
      UPDATE special_date_occurrences
      SET status = 'cancelled', outcome_note = ${note ?? null}
      WHERE id = ${occurrenceId} AND status = 'pending'
    `;
    return;
  }
  // "draw" intentionally maps to no override (null) — not a celebratory win,
  // but not grounds to force a bad day either; the weather verdict stands.
  const verdictOverride = outcome === "won" ? true : outcome === "lost" ? false : null;
  await sql`
    UPDATE special_date_occurrences
    SET status = 'confirmed', verdict_override = ${verdictOverride}, outcome_note = ${note ?? null}
    WHERE id = ${occurrenceId} AND status = 'pending'
  `;
}
