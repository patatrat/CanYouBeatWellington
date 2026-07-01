// Pure special-dates logic and types — no DB imports, so client components
// (e.g. CalendarHistory) can use these without pulling the Neon client into
// the browser bundle. Server-side data access lives in special-dates.ts,
// which re-exports everything here.

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
