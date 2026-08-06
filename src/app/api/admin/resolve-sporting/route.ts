import { NextRequest, NextResponse } from 'next/server';
import { isBearerAuthorized } from '@/lib/auth';
import { sql } from '@/lib/db';
import { resolveSportingOccurrence, type SportingOutcome } from '@/lib/special-dates';

const VALID_OUTCOMES: SportingOutcome[] = ['won', 'lost', 'draw', 'cancelled'];

// Semi-automated sporting-event resolution. Reuses the same Bearer-token
// pattern as the cron route's CRON_SECRET check — no new auth
// infrastructure. Triggered manually after a game, e.g.:
//
//   curl -X POST https://www.canyoubeatwellington.nz/api/admin/resolve-sporting \
//     -H "Authorization: Bearer $ADMIN_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"occurrenceId": 7, "outcome": "won", "note": "Phoenix won 2-1"}'
export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'ADMIN_SECRET not configured' }, { status: 503 });
  }
  if (!isBearerAuthorized(req.headers.get('authorization'), process.env.ADMIN_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { occurrenceId?: unknown; outcome?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { occurrenceId, outcome, note } = body;
  if (typeof occurrenceId !== 'number' || !Number.isInteger(occurrenceId)) {
    return NextResponse.json({ error: 'occurrenceId must be an integer' }, { status: 400 });
  }
  if (typeof outcome !== 'string' || !VALID_OUTCOMES.includes(outcome as SportingOutcome)) {
    return NextResponse.json({ error: `outcome must be one of: ${VALID_OUTCOMES.join(', ')}` }, { status: 400 });
  }
  if (note !== undefined && typeof note !== 'string') {
    return NextResponse.json({ error: 'note must be a string if provided' }, { status: 400 });
  }

  const updated = await resolveSportingOccurrence(occurrenceId, outcome as SportingOutcome, note);
  if (!updated) {
    // Distinguish a typo'd id from a double resolution — this endpoint is
    // driven by hand-typed curl after a game, so a silent no-op that reports
    // success would be easy to miss.
    const existing = await sql`
      SELECT status FROM special_date_occurrences WHERE id = ${occurrenceId}
    `;
    if (existing.length === 0) {
      return NextResponse.json({ error: `No occurrence with id ${occurrenceId}` }, { status: 404 });
    }
    return NextResponse.json(
      { error: `Occurrence ${occurrenceId} is not pending (status: ${(existing[0] as { status: string }).status})` },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, occurrenceId, outcome, note: note ?? null });
}
