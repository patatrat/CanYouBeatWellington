import { NextRequest, NextResponse } from 'next/server';
import { resolveSportingOccurrence, type SportingOutcome } from '@/lib/special-dates';

const VALID_OUTCOMES: SportingOutcome[] = ['won', 'lost', 'draw', 'cancelled'];

// Semi-automated sporting-event resolution. Reuses the same Bearer-token
// pattern as the cron route's CRON_SECRET check — no new auth
// infrastructure. Triggered manually after a game, e.g.:
//
//   curl -X POST https://canyoubeatwellington.radomski.co.nz/api/admin/resolve-sporting \
//     -H "Authorization: Bearer $ADMIN_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"occurrenceId": 7, "outcome": "won", "note": "Phoenix won 2-1"}'
export async function POST(req: NextRequest) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return NextResponse.json({ error: 'ADMIN_SECRET not configured' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${adminSecret}`) {
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

  await resolveSportingOccurrence(occurrenceId, outcome as SportingOutcome, note);

  return NextResponse.json({ ok: true, occurrenceId, outcome, note: note ?? null });
}
