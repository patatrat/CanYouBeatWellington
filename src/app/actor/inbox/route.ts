import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { kv } from '@vercel/kv';
import { verifySignature, signAndDeliver } from '@/lib/http-signatures';
import { actorForHost, type ActorIdentity } from '@/lib/ap-identity';

const ACCEPT_QUOTE_CONTEXT = { QuoteRequest: 'https://w3id.org/fep/044f#QuoteRequest' };
const QUOTE_AUTH_CONTEXT = {
  QuoteAuthorization: 'https://w3id.org/fep/044f#QuoteAuthorization',
  gts: 'https://gotosocial.org/ns#',
  interactingObject: { '@id': 'gts:interactingObject', '@type': '@id' },
  interactionTarget: { '@id': 'gts:interactionTarget', '@type': '@id' },
};

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

async function sendAccept(us: ActorIdentity, followActivity: unknown, followerActorUrl: string) {
  const privateKeyPem = process.env[us.privateKeyEnvVar]?.replace(/\\n/g, '\n');
  if (!privateKeyPem) throw new Error(`${us.privateKeyEnvVar} not configured`);

  const inbox = await resolveInboxUrl(followerActorUrl);

  const accept = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${us.base}/actor/accepts/${Date.now()}`,
    type: 'Accept',
    actor: us.actorId,
    object: followActivity,
  };

  await signAndDeliver(inbox, accept, us.keyId, privateKeyPem);
}

// Extracts the noteIdSuffix from one of our own note URLs (used as the
// cybw:post:<suffix> KV key), or null if the URL isn't shaped like one of
// ours. Takes the actor base explicitly rather than assuming one fixed
// actor, since a QuoteRequest resolves against whichever actor's inbox
// actually received it (both can publish posts now) — exported for
// unit testing.
export function noteSuffixFromUrl(url: string, actorBase: string): string | null {
  const prefix = `${actorBase}/notes/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

// Shared shape-normalizer: the spec shows both QuoteRequest's `instrument`
// and Accept/Reject's `object` as either a bare URL string or a fully
// embedded object (whose `id` is the canonical URL in that case) — handle
// both. Exported for testing.
export function instrumentUrl(instrument: unknown): string | null {
  if (typeof instrument === 'string') return instrument;
  if (instrument && typeof instrument === 'object' && typeof (instrument as { id?: unknown }).id === 'string') {
    return (instrument as { id: string }).id;
  }
  return null;
}

// Extracts the follow-request id suffix from one of our own outgoing Follow
// URLs (used as the cybw:ap:pending-follow:<suffix> KV key), or null if the
// URL isn't shaped like one of ours. Exported for unit testing.
export function followSuffixFromUrl(url: string, actorBase: string): string | null {
  const prefix = `${actorBase}/actor/follows/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

// Our policy is unconditional public auto-approval (QUOTABLE_BY_ANYONE in
// ap-posting.ts), so every QuoteRequest for a real post of ours is approved
// automatically — no manual review step. The only rejection case is a
// QuoteRequest for something that isn't actually one of our posts, which we
// silently ignore (no Accept, no authorization minted) rather than send a
// Reject, matching this inbox's existing silent-no-op pattern for
// unrecognized/invalid input elsewhere.
async function handleQuoteRequest(us: ActorIdentity, activity: Record<string, unknown>, signerActorUrl: string) {
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

  const suffix = noteSuffixFromUrl(objectUrl, us.base);
  const stored = suffix
    ? await kv.get<{ object?: { id?: string } }>(`cybw:post:${suffix}`)
    : null;
  if (!stored?.object?.id || stored.object.id !== objectUrl) {
    console.log(`Inbox: QuoteRequest for unknown/mismatched post ${objectUrl} — ignoring`);
    return;
  }

  const privateKeyPem = process.env[us.privateKeyEnvVar]?.replace(/\\n/g, '\n');
  if (!privateKeyPem) throw new Error(`${us.privateKeyEnvVar} not configured`);

  const guid = crypto.randomUUID();
  const authId = `${us.base}/quote-authorizations/${guid}`;
  const authorization = {
    '@context': ['https://www.w3.org/ns/activitystreams', QUOTE_AUTH_CONTEXT],
    id: authId,
    type: 'QuoteAuthorization',
    attributedTo: us.actorId,
    interactingObject: quoterPostUrl,
    interactionTarget: objectUrl,
  };
  // No TTL, unlike notes (1yr) — other instances can dereference this at any
  // point in the future to independently re-verify the quote is authentic.
  await kv.set(`cybw:quote-auth:${guid}`, authorization);

  const accept = {
    '@context': ['https://www.w3.org/ns/activitystreams', ACCEPT_QUOTE_CONTEXT],
    id: `${us.base}/actor/accepts/${Date.now()}`,
    type: 'Accept',
    actor: us.actorId,
    object: activity,
    result: authId,
  };

  const inbox = await resolveInboxUrl(signerActorUrl);
  await signAndDeliver(inbox, accept, us.keyId, privateKeyPem);
  console.log(`Inbox: approved QuoteRequest — ${quoterPostUrl} quoting ${objectUrl}`);
}

// Confirms a Follow we sent (api/admin/follow-account) was accepted —
// cross-checked against the pending-follow record that route stores, so we
// don't blindly trust any Accept that merely claims to reference us.
async function handleFollowAccept(us: ActorIdentity, activity: Record<string, unknown>, signerActorUrl: string) {
  const claimedActor =
    typeof activity.actor === 'string' ? activity.actor : (activity.actor as { id?: string } | undefined)?.id;
  if (claimedActor !== signerActorUrl) {
    console.error(`Inbox: Accept actor mismatch — body claims ${claimedActor}, signed by ${signerActorUrl}`);
    return;
  }

  const followId = instrumentUrl(activity.object);
  const suffix = followId ? followSuffixFromUrl(followId, us.base) : null;
  if (!suffix) {
    // Not a Follow we recognize as one of ours — nothing to do.
    return;
  }

  const pendingKey = `cybw:ap:pending-follow:${suffix}`;
  const pendingTarget = await kv.get<string>(pendingKey);
  if (!pendingTarget || pendingTarget !== signerActorUrl) {
    console.log(`Inbox: Accept for unknown/mismatched pending follow ${followId} — ignoring`);
    return;
  }

  await kv.sadd(us.followingKey, signerActorUrl);
  await kv.del(pendingKey);
  console.log(`Inbox: now following ${signerActorUrl} (${us.domain})`);
}

async function handleFollowReject(us: ActorIdentity, activity: Record<string, unknown>, signerActorUrl: string) {
  const followId = instrumentUrl(activity.object);
  const suffix = followId ? followSuffixFromUrl(followId, us.base) : null;
  if (!suffix) return;

  await kv.del(`cybw:ap:pending-follow:${suffix}`);
  console.log(`Inbox: follow request to ${signerActorUrl} rejected (${us.domain})`);
}

// Records an incoming boost (Announce) of one of our own posts, for our own
// record-keeping — this is separate from, and has no effect on, the
// booster-list Mastodon's own UI already shows natively for any post viewed
// there. No response is sent back: unlike Follow/QuoteRequest, Announce
// isn't a request awaiting an Accept/Reject. Silently ignored if the
// announced object isn't verifiably one of our real posts, same defensive
// pattern as handleQuoteRequest.
async function handleAnnounce(us: ActorIdentity, activity: Record<string, unknown>, signerActorUrl: string) {
  const claimedActor =
    typeof activity.actor === 'string' ? activity.actor : (activity.actor as { id?: string } | undefined)?.id;
  if (claimedActor !== signerActorUrl) {
    console.error(`Inbox: Announce actor mismatch — body claims ${claimedActor}, signed by ${signerActorUrl}`);
    return;
  }

  const objectUrl = instrumentUrl(activity.object);
  if (!objectUrl) return;

  const suffix = noteSuffixFromUrl(objectUrl, us.base);
  const stored = suffix
    ? await kv.get<{ object?: { id?: string } }>(`cybw:post:${suffix}`)
    : null;
  if (!stored?.object?.id || stored.object.id !== objectUrl) {
    console.log(`Inbox: Announce for unknown/mismatched post ${objectUrl} — ignoring`);
    return;
  }

  const record = JSON.stringify({
    actor: signerActorUrl,
    object: objectUrl,
    published: new Date().toISOString(),
  });
  await kv.lpush(us.boostsKey, record);
  await kv.ltrim(us.boostsKey, 0, 199);
  console.log(`Inbox: boost recorded — ${signerActorUrl} announced ${objectUrl} (${us.domain})`);
}

export async function POST(req: NextRequest) {
  const us = actorForHost(req.headers.get('host'));
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
  // of someone else. QuoteRequest/Accept/Reject/Announce do their own
  // equivalent check and log separately, so they're excluded here to avoid a
  // duplicate log line.
  const claimedActor = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id;
  const followerUrl = claimedActor === signerActorUrl ? claimedActor : undefined;
  const selfHandledTypes = ['QuoteRequest', 'Accept', 'Reject', 'Announce'];
  if (claimedActor && !followerUrl && !selfHandledTypes.includes(activity.type)) {
    console.error(`Inbox: actor mismatch — body claims ${claimedActor}, signed by ${signerActorUrl}`);
  }

  const objectType = (activity.object as { type?: string } | undefined)?.type;

  try {
    if (activity.type === 'Follow') {
      if (followerUrl) {
        await kv.sadd(us.followersKey, followerUrl);
        await sendAccept(us, activity, followerUrl);
        console.log(`Inbox: new follower ${followerUrl} (${us.domain})`);
      }
    } else if (activity.type === 'Undo' && objectType === 'Follow') {
      if (followerUrl) {
        await kv.srem(us.followersKey, followerUrl);
        await kv.del(`cybw:ap:inbox:${followerUrl}`);
        console.log(`Inbox: unfollowed ${followerUrl} (${us.domain})`);
      }
    } else if (activity.type === 'QuoteRequest') {
      await handleQuoteRequest(us, activity, signerActorUrl);
    } else if (activity.type === 'Accept' && (objectType === 'Follow' || objectType === undefined)) {
      await handleFollowAccept(us, activity, signerActorUrl);
    } else if (activity.type === 'Reject' && (objectType === 'Follow' || objectType === undefined)) {
      await handleFollowReject(us, activity, signerActorUrl);
    } else if (activity.type === 'Announce') {
      await handleAnnounce(us, activity, signerActorUrl);
    }
    // All other activity types (Delete, etc.) are silently accepted per AP spec
  } catch (err) {
    console.error('Inbox: error processing activity:', (err as Error).message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  return new NextResponse(null, { status: 202 });
}
