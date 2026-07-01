import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { verifySignature, signAndDeliver } from '@/lib/http-signatures';

const BASE = 'https://canyoubeatwellington.radomski.co.nz';
const ACTOR_ID = `${BASE}/actor`;
const KEY_ID = `${ACTOR_ID}#main-key`;
const FOLLOWERS_KEY = 'cybw:ap:followers';

async function sendAccept(followActivity: unknown, followerActorUrl: string) {
  const privateKeyPem = process.env.AP_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!privateKeyPem) throw new Error('AP_PRIVATE_KEY not configured');

  const res = await fetch(followerActorUrl, {
    headers: { Accept: 'application/activity+json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Could not fetch follower actor (${res.status})`);
  const actor = await res.json();
  if (!actor.inbox) throw new Error(`Follower actor has no inbox: ${followerActorUrl}`);

  // Cache the inbox URL so the daily fan-out doesn't have to re-fetch every
  // follower's actor document on every post.
  await kv.set(`cybw:ap:inbox:${followerActorUrl}`, actor.inbox);

  const accept = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${BASE}/actor/accepts/${Date.now()}`,
    type: 'Accept',
    actor: ACTOR_ID,
    object: followActivity,
  };

  await signAndDeliver(actor.inbox, accept, KEY_ID, privateKeyPem);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  let signerActorUrl: string;
  try {
    signerActorUrl = await verifySignature('POST', '/actor/inbox', headers, rawBody);
  } catch (err) {
    console.error('Inbox: signature rejected:', (err as Error).message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let activity: { type: string; actor: string | { id?: string }; object?: { type: string } };
  try {
    activity = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // The body is attacker-supplied even when the signature is valid — only act
  // on Follow/Undo when the claimed actor is the actor that signed the
  // request, or anyone with a fediverse account could (un)follow on behalf
  // of someone else.
  const claimedActor = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id;
  const followerUrl = claimedActor === signerActorUrl ? claimedActor : undefined;
  if (claimedActor && !followerUrl) {
    console.error(`Inbox: actor mismatch — body claims ${claimedActor}, signed by ${signerActorUrl}`);
  }

  try {
    if (activity.type === 'Follow') {
      if (followerUrl) {
        await kv.sadd(FOLLOWERS_KEY, followerUrl);
        await sendAccept(activity, followerUrl);
        console.log(`Inbox: new follower ${followerUrl}`);
      }
    } else if (activity.type === 'Undo' && activity.object?.type === 'Follow') {
      if (followerUrl) {
        await kv.srem(FOLLOWERS_KEY, followerUrl);
        await kv.del(`cybw:ap:inbox:${followerUrl}`);
        console.log(`Inbox: unfollowed ${followerUrl}`);
      }
    }
    // All other activity types (Delete, etc.) are silently accepted per AP spec
  } catch (err) {
    console.error('Inbox: error processing activity:', (err as Error).message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  return new NextResponse(null, { status: 202 });
}
