import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { isBearerAuthorized } from '@/lib/auth';
import { signAndDeliver } from '@/lib/http-signatures';
import { NEW_ACTOR } from '@/lib/ap-identity';

// Sends a Follow from the new actor to a target account. The relationship
// isn't recorded as "following" until the target's server sends back a
// signed Accept — actor/inbox/route.ts handles that, correlating it
// against the pending-follow record this stores (so an Accept has to
// actually reference a Follow we sent, not just claim to). Same
// Bearer-token pattern as the other admin routes. Triggered manually, e.g.:
//
//   curl -X POST https://canyoubeatwellington.nz/api/admin/follow-account \
//     -H "Authorization: Bearer $ADMIN_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"targetActorUrl": "https://mastodon.nz/users/Pat"}'
export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'ADMIN_SECRET not configured' }, { status: 503 });
  }
  if (!isBearerAuthorized(req.headers.get('authorization'), process.env.ADMIN_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const privateKeyPem = process.env[NEW_ACTOR.privateKeyEnvVar]?.replace(/\\n/g, '\n');
  if (!privateKeyPem) {
    return NextResponse.json({ error: `${NEW_ACTOR.privateKeyEnvVar} not configured` }, { status: 503 });
  }

  let body: { targetActorUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { targetActorUrl } = body;
  if (typeof targetActorUrl !== 'string' || !targetActorUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'targetActorUrl must be an https URL' }, { status: 400 });
  }

  let inbox: string;
  try {
    const res = await fetch(targetActorUrl, {
      headers: { Accept: 'application/activity+json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const targetActor = await res.json();
    if (typeof targetActor.inbox !== 'string' || !targetActor.inbox.startsWith('https://')) {
      throw new Error('no https inbox in actor document');
    }
    inbox = targetActor.inbox;
  } catch (err) {
    return NextResponse.json(
      { error: `Could not resolve target actor's inbox: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const followSuffix = `${Date.now()}`;
  const followId = `${NEW_ACTOR.base}/actor/follows/${followSuffix}`;
  const follow = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: followId,
    type: 'Follow',
    actor: NEW_ACTOR.actorId,
    object: targetActorUrl,
  };

  // 30-day TTL — if nobody responds by then it's not going to happen.
  await kv.set(`cybw:ap:pending-follow:${followSuffix}`, targetActorUrl, { ex: 60 * 60 * 24 * 30 });

  const status = await signAndDeliver(inbox, follow, NEW_ACTOR.keyId, privateKeyPem);

  return NextResponse.json({ ok: status >= 200 && status < 300, status, followId, targetActorUrl });
}
