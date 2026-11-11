import { NextRequest, NextResponse } from 'next/server';
import { isBearerAuthorized } from '@/lib/auth';
import { OLD_ACTOR, NEW_ACTOR } from '@/lib/ap-identity';
import { readRecords } from '@/lib/ap-interactions';

// Reads back what the inbox has recorded about other people's interactions
// with our posts: boosts, likes, and replies/mentions (newest first, up to
// 200 of each). Read-only. `actor` defaults to "new". Same Bearer-token
// pattern as the other admin routes:
//
//   curl https://canyoubeatwellington.nz/api/admin/interactions \
//     -H "Authorization: Bearer $ADMIN_SECRET"
export async function GET(req: NextRequest) {
  if (!process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'ADMIN_SECRET not configured' }, { status: 503 });
  }
  if (!isBearerAuthorized(req.headers.get('authorization'), process.env.ADMIN_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const which = req.nextUrl.searchParams.get('actor') ?? 'new';
  if (which !== 'old' && which !== 'new') {
    return NextResponse.json({ error: 'actor must be "old" or "new"' }, { status: 400 });
  }
  const actor = which === 'new' ? NEW_ACTOR : OLD_ACTOR;

  const [boosts, likes, replies] = await Promise.all([
    readRecords(actor.boostsKey),
    readRecords(actor.likesKey),
    readRecords(actor.repliesKey),
  ]);

  return NextResponse.json({ actor: which, boosts, likes, replies });
}
