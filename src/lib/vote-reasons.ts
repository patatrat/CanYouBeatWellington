import { sql } from "./db";

// Records why a voter disagreed. Only accepted from a browser token that
// actually voted that day, and only once per token per day (the primary key),
// so the reason counts can't outnumber real votes. Returns whether a row was
// written; a repeat or an unknown token is simply ignored.
export async function recordDisagreeReason(
  date: string,
  verdict: string,
  reason: string,
  token: string,
): Promise<boolean> {
  const rows = await sql`
    INSERT INTO vote_reasons (date, token, verdict, reason)
    SELECT ${date}::date, ${token}, ${verdict}, ${reason}
    WHERE EXISTS (SELECT 1 FROM vote_tokens WHERE token = ${token} AND date = ${date}::date)
    ON CONFLICT (token, date) DO NOTHING
    RETURNING 1
  `;
  return rows.length > 0;
}
