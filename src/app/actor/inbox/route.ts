import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { kv } from '@vercel/kv';
import { verifySignature, signAndDeliver } from '@/lib/http-signatures';

const BASE = 'https://canyoubeatwellington.radomski.co.nz';
const ACTOR_ID = `${BASE}/actor`;
const KEY_ID = `${ACTOR_ID}#main-key`;
const FOLLOWERS_KEY = 'cybw:ap:followers';
const NOTES_PREFIX = `${BASE}/notes/`;

// FEP-044f terms needed on the *response* side (Accept + QuoteAuthorization).
// The declaration side (interactionPolicy on outgoing Notes) has its own
// QUOTE_CONTEXT in src/lib/ap-posting.ts — these are deliberately separate
// since each is attached to a different object type.
const ACCEPT_QUOTE_CONTEXT = { QuoteRequest: 'https://w3id.org/fep/044f#QuoteRequest' };
const QUOTE_AUTH_CONTEXT = {
  QuoteAuthorization: 'https://w3id.org/fep/044f#QuoteAuthorization',
  gts: 'https://gotosocial.org/ns#',
  interactingObject: { '@id': 'gts:interactingObject', '@type': '@id' },
  interactionTarget: { '@id': 'gts:interactionTarget', '@type': '@id' },
};

// Shared by the Follow-accept flow and the QuoteRequest-accept flow — both
// need to resolve an arbitrary remote actor's inbox URL, with the same KV
// cache used by the daily fan-out (src/lib/ap-posting.ts's getInboxUrl).
async function resolveInboxUrl(actorUrl: string): Promise<string> {
  const cacheKey = `cybw:ap:inbox:${actorUrl}`;
  const cached = await kv.get<string>(cacheKey);
  if (cached?.startsWith('https://')) return cached;

  const res = await fetch(actorUrl, {
    headers: { Accept: 'application/activity+json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Could not fetch actor (${res.status}): ${actorUrl}`);
  const actor = await res.json();
  if (!actor.inbox) throw new Error(`Actor has no inbox: ${actorUrl}`);
  await kv.set(cacheKey, actor.inbox);
  return actor.inbox;
}

async function sendAccept(followActivity: unknown, followerActorUrl: string) {
  const privateKeyPem = process.env.AP_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!privateKeyPem) throw new Error('AP_PRIVATE_KEY not configured');

  const inbox = await resolveInboxUrl(followerActorUrl);

  const accept = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${BASE}/actor/accepts/${Date.now()}`,
    type: 'Accept',
    actor: ACTOR_ID,
    object: followActivity,
  };

  await signAndDeliver(inbox, accept, KEY_ID, privateKeyPem);
}

// Extracts the noteIdSuffix from one of our own note URLs (used as the
// cybw:post:<suffix> KV key), or null if the URL isn't shaped like one of
// ours — exported for unit testing.
export function noteSuffixFromUrl(url: string): string | null {
  return url.startsWith(NOTES_PREFIX) ? url.slice(NOTES_PREFIX.length) : null;
}

// QuoteRequest's `instrument` (the quoting post) is shown in the FEP-044f
// spec both as a bare URL string and as a fully embedded object (whose `id`
// is the canonical URL in that case) — handle both. Exported for testing.
export function instrumentUrl(instrument: unknown): string | null {
  if (typeof instrument === 'string') return instrument;
  if (instrument && typeof instrument === 'object' && typeof (instrument as { id?: unknown }).id === 'string') {
    return (instrument as { id: string }).id;
  }
  return null;
}

// Our policy is unconditional public auto-approval (QUOTABLE_BY_ANYONE in
// ap-posting.ts), so every QuoteRequest for a real post of ours is approved
// automatically — no manual review step. The only rejection case is a
// QuoteRequest for something that isn't actually one of our posts, which we
// silently ignore (no Accept, no authorization minted) rather than send a
// Reject, matching this inbox's existing silent-no-op pattern for
// unrecognized/invalid input elsewhere.
async function handleQuoteRequest(activity: Record<string, unknown>, signerActorUrl: string) {
  const claimedActor =
    typeof activity.actor === 'string' ? activity.actor : (activity.actor as { id?: string } | undefined)?.id;
  if (claimedActor !== signerActorUrl) {
    console.error(`Inbox: QuoteRequest actor mismatch — body claims ${claimedActor}, signed by ${signerActorUrl}`);
    return;
  }

  const objectUrl = typeof activity.object === 'string' ? activity.object : undefined;
  const quoterPostUrl = instrumentUrl(activity.instrument);
  if (!objectUrl || !quoterPostUrl) {
    console.error('Inbox: QuoteRequest missing object or instrument', {
      object: activity.object,
      instrument: activity.instrument,
    });
    return;
  }

  const suffix = noteSuffixFromUrl(objectUrl);
  const stored = suffix
    ? await kv.get<{ object?: { id?: string } }>(`cybw:post:${suffix}`)
    : null;
  if (!stored?.object?.id || stored.object.id !== objectUrl) {
    console.log(`Inbox: QuoteRequest for unknown/mismatched post ${objectUrl} — ignoring`);
    return;
  }

  const privateKeyPem = process.env.AP_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!privateKeyPem) throw new Error('AP_PRIVATE_KEY not configured');

  const guid = crypto.randomUUID();
  const authId = `${BASE}/quote-authorizations/${guid}`;
  const authorization = {
    '@context': ['https://www.w3.org/ns/activitystreams', QUOTE_AUTH_CONTEXT],
    id: authId,
    type: 'QuoteAuthorization',
    attributedTo: ACTOR_ID,
    interactingObject: quoterPostUrl,
    interactionTarget: objectUrl,
  };
  // No TTL, unlike notes (1yr) — other instances can dereference this at any
  // point in the future to independently re-verify the quote is authentic.
  await kv.set(`cybw:quote-auth:${guid}`, authorization);

  const accept = {
    '@context': ['https://www.w3.org/ns/activitystreams', ACCEPT_QUOTE_CONTEXT],
    id: `${BASE}/actor/accepts/${Date.now()}`,
    type: 'Accept',
    actor: ACTOR_ID,
    object: activity,
    result: authId,
  };

  const inbox = await resolveInboxUrl(signerActorUrl);
  await signAndDeliver(inbox, accept, KEY_ID, privateKeyPem);
  console.log(`Inbox: approved QuoteRequest — ${quoterPostUrl} quoting ${objectUrl}`);
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

  let activity: Record<string, unknown> & {
    type: string;
    actor: string | { id?: string };
    object?: unknown;
  };
  try {
    activity = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // The body is attacker-supplied even when the signature is valid — only act
  // on Follow/Undo when the claimed actor is the actor that signed the
  // request, or anyone with a fediverse account could (un)follow on behalf
  // of someone else. QuoteRequest does its own equivalent check and logs
  // separately, so it's excluded here to avoid a duplicate log line.
  const claimedActor = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id;
  const followerUrl = claimedActor === signerActorUrl ? claimedActor : undefined;
  if (claimedActor && !followerUrl && activity.type !== 'QuoteRequest') {
    console.error(`Inbox: actor mismatch — body claims ${claimedActor}, signed by ${signerActorUrl}`);
  }

  try {
    if (activity.type === 'Follow') {
      if (followerUrl) {
        await kv.sadd(FOLLOWERS_KEY, followerUrl);
        await sendAccept(activity, followerUrl);
        console.log(`Inbox: new follower ${followerUrl}`);
      }
    } else if (activity.type === 'Undo' && (activity.object as { type?: string } | undefined)?.type === 'Follow') {
      if (followerUrl) {
        await kv.srem(FOLLOWERS_KEY, followerUrl);
        await kv.del(`cybw:ap:inbox:${followerUrl}`);
        console.log(`Inbox: unfollowed ${followerUrl}`);
      }
    } else if (activity.type === 'QuoteRequest') {
      await handleQuoteRequest(activity, signerActorUrl);
    }
    // All other activity types (Delete, etc.) are silently accepted per AP spec
  } catch (err) {
    console.error('Inbox: error processing activity:', (err as Error).message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  return new NextResponse(null, { status: 202 });
}
