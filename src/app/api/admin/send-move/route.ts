import { NextRequest, NextResponse } from 'next/server';
import { isBearerAuthorized } from '@/lib/auth';
import { deliverToFollowers } from '@/lib/ap-posting';
import { buildMoveActivity } from '@/lib/ap-move';
import { OLD_ACTOR } from '@/lib/ap-identity';

// Sends the FEP-compliant Move activity that migrates the actor identity
// from the old domain to the new one, carrying current followers' relationship
// across — Mastodon auto-follows the new actor and auto-unfollows the old
// one on the user's behalf once it verifies the new actor's alsoKnownAs
// lists this one.
//
// DELIBERATELY NOT CALLED ANYWHERE IN THE APP — this is a one-way,
// fediverse-visible action. Held until the shared KV database migration is
// complete and burned in (see CLAUDE.md's migration backlog). Same
// Bearer-token pattern as the other admin routes. Triggered manually, e.g.:
//
//   curl -X POST https://canyoubeatwellington.nz/api/admin/send-move \
//     -H "Authorization: Bearer $ADMIN_SECRET"
export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'ADMIN_SECRET not configured' }, { status: 503 });
  }
  if (!isBearerAuthorized(req.headers.get('authorization'), process.env.ADMIN_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const privateKeyPem = process.env[OLD_ACTOR.privateKeyEnvVar];
  if (!privateKeyPem) {
    return NextResponse.json({ error: `${OLD_ACTOR.privateKeyEnvVar} not configured` }, { status: 503 });
  }

  const move = buildMoveActivity();
  const { delivered, failed, total } = await deliverToFollowers(move, privateKeyPem, OLD_ACTOR);

  return NextResponse.json({ ok: true, move, delivered, failed, total });
}
