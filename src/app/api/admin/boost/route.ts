import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { isBearerAuthorized } from '@/lib/auth';
import { deliverToFollowers, getInboxUrl } from '@/lib/ap-posting';
import { NEW_ACTOR } from '@/lib/ap-identity';
import { parseBoostTarget, buildAnnounceActivity } from '@/lib/ap-boost';
import { signAndDeliver } from '@/lib/http-signatures';

// Boosts someone else's public post as the new actor: a signed Announce to
// our followers, plus the post author's inbox so they're notified and the
// boost counts on their post. The Announce is stored in KV and served at its
// id (actor/announces/[id]) in case a receiving instance dereferences it.
// Same Bearer-token pattern as the other admin routes. Triggered manually,
// e.g.:
//
//   curl -X POST https://canyoubeatwellington.nz/api/admin/boost \
//     -H "Authorization: Bearer $ADMIN_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"url": "https://mastodon.nz/@Pat/117452510736334789"}'
export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'ADMIN_SECRET not configured' }, { status: 503 });
  }
  if (!isBearerAuthorized(req.headers.get('authorization'), process.env.ADMIN_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body.url !== 'string' || !body.url.startsWith('https://')) {
    return NextResponse.json({ error: 'url must be an https URL' }, { status: 400 });
  }

  const privateKeyPem = process.env[NEW_ACTOR.privateKeyEnvVar];
  if (!privateKeyPem) {
    return NextResponse.json({ error: `${NEW_ACTOR.privateKeyEnvVar} not configured` }, { status: 503 });
  }

  // Mastodon serves the post's ActivityPub object at its human-facing URL
  // too, given the right Accept header.
  let object: unknown;
  try {
    const res = await fetch(body.url, {
      headers: { Accept: 'application/activity+json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    object = await res.json();
  } catch (err) {
    return NextResponse.json({ error: `Couldn't fetch the post: ${(err as Error).message}` }, { status: 502 });
  }

  const target = parseBoostTarget(object, body.url);
  if ('error' in target) {
    return NextResponse.json({ error: target.error }, { status: 422 });
  }

  const announce = buildAnnounceActivity(target, randomUUID());
  await kv.set(`cybw:announce:${String(announce.id).split('/').pop()}`, announce);

  const followers = await deliverToFollowers(announce, privateKeyPem, NEW_ACTOR);

  // The author's server is already covered if they follow us.
  let author: 'delivered' | 'already a follower' | string = 'already a follower';
  if (!(await kv.sismember(NEW_ACTOR.followersKey, target.attributedTo))) {
    try {
      const status = await signAndDeliver(await getInboxUrl(target.attributedTo), announce, NEW_ACTOR.keyId, privateKeyPem);
      author = status >= 200 && status < 300 ? 'delivered' : `failed: HTTP ${status}`;
    } catch (err) {
      author = `failed: ${(err as Error).message}`;
    }
  }

  return NextResponse.json({ ok: true, announce: announce.id, object: target.id, followers, author });
}
