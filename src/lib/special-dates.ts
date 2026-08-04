import { sql } from "./db";
import { getTodaysNZTDate } from "./weather";
import { computeFixedRuleDate, type ActiveSpecialDate, type SportingOutcome } from "./special-dates-logic";

// Pure logic + types live in special-dates-logic.ts (client-safe, no DB
// import); re-exported here so server-side callers only need one import.
export * from "./special-dates-logic";

// Joined columns for a special_date_occurrences <> special_date_defs row.
// Both tables have their own `id` — aliased here to avoid collision.
const ACTIVE_DATE_COLUMNS = `
  d.id AS def_id, d.slug, d.title, d.kind, d.recurrence_rule, d.recurring,
  d.quip_override, d.scenario_quips, d.background_key, d.effect, d.link_url, d.link_label, d.active,
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
      // ON CONFLICT guards the check-then-insert race if the cron ever runs
      // concurrently (backed by the unique index on (def_id, start_date) —
      // see db/schema.sql).
      const insertedRows = await sql`
        INSERT INTO special_date_occurrences (def_id, start_date, end_date, status)
        VALUES (${def.id}, ${start}::date, ${end}::date, 'confirmed')
        ON CONFLICT DO NOTHING
        RETURNING id
      `;
      inserted += insertedRows.length;
    }
  }
  return inserted;
}

// Flips a pending sporting occurrence once the result is known. Scoped to
// `status = 'pending'` so resolving twice is a no-op rather than silently
// overwriting a previously-recorded outcome. Returns false when nothing was
// updated (unknown id, or already resolved) so callers can surface the no-op
// instead of reporting success.
export async function resolveSportingOccurrence(
  occurrenceId: number,
  outcome: SportingOutcome,
  note?: string,
): Promise<boolean> {
  if (outcome === "cancelled") {
    const rows = await sql`
      UPDATE special_date_occurrences
      SET status = 'cancelled', outcome_note = ${note ?? null}
      WHERE id = ${occurrenceId} AND status = 'pending'
      RETURNING id
    `;
    return rows.length > 0;
  }
  // "draw" intentionally maps to no override (null) — not a celebratory win,
  // but not grounds to force a bad day either; the weather verdict stands.
  const verdictOverride = outcome === "won" ? true : outcome === "lost" ? false : null;
  const rows = await sql`
    UPDATE special_date_occurrences
    SET status = 'confirmed', verdict_override = ${verdictOverride}, outcome_note = ${note ?? null}
    WHERE id = ${occurrenceId} AND status = 'pending'
    RETURNING id
  `;
  return rows.length > 0;
}
