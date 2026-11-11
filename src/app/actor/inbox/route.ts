import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { kv } from '@vercel/kv';
import { verifySignature, signAndDeliver } from '@/lib/http-signatures';
import { getInboxUrl, removeFollowerIfGone } from '@/lib/ap-posting';
import { actorForHost, OLD_ACTOR, type ActorIdentity } from '@/lib/ap-identity';
import { addRecord, removeRecords, mentionsActor, buildReplyRecord } from '@/lib/ap-interactions';

const ACCEPT_QUOTE_CONTEXT = { QuoteRequest: 'https://w3id.org/fep/044f#QuoteRequest' };
const QUOTE_AUTH_CONTEXT = {
  QuoteAuthorization: 'https://w3id.org/fep/044f#QuoteAuthorization',
  gts: 'https://gotosocial.org/ns#',
  interactingObject: { '@id': 'gts:interactingObject', '@type': '@id' },
  interactionTarget: { '@id': 'gts:interactionTarget', '@type': '@id' },
};

// Answers a Follow with an Accept or a Reject.
async function answerFollow(
  us: ActorIdentity,
  type: 'Accept' | 'Reject',
  followActivity: unknown,
  followerActorUrl: string,
) {
  const privateKeyPem = process.env[us.privateKeyEnvVar]?.replace(/\\n/g, '\n');
  if (!privateKeyPem) throw new Error(`${us.privateKeyEnvVar} not configured`);

  const inbox = await getInboxUrl(followerActorUrl);

  const answer = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${us.base}/actor/${type.toLowerCase()}s/${Date.now()}`,
    type,
    actor: us.actorId,
    object: followActivity,
  };

  await signAndDeliver(inbox, answer, us.keyId, privateKeyPem);
}

// What to do with a verified Follow. It must actually be aimed at this
// actor (a Follow of someone else, delivered here, isn't ours to accept).
// The old actor has moved and no longer posts, so a new follower there
// would hear nothing: those are rejected, which also clears the "pending"
// state on the follower's side. Exported for unit testing.
export function followDecision(us: ActorIdentity, followObject: unknown): 'accept' | 'reject' | 'ignore' {
  if (instrumentUrl(followObject) !== us.actorId) return 'ignore';
  return us === OLD_ACTOR ? 'reject' : 'accept';
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

  const inbox = await getInboxUrl(signerActorUrl);
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

// A Reject of a Follow we sent: either our request was declined, or (later)
// the account removed us as a follower. Either way we're not following them.
// Only the signer's own relationship with us is touched, so a Reject can't
// affect anyone else's.
async function handleFollowReject(us: ActorIdentity, activity: Record<string, unknown>, signerActorUrl: string) {
  if (instrumentUrl(activity.actor) !== signerActorUrl) {
    console.error(`Inbox: Reject actor mismatch — signed by ${signerActorUrl}`);
    return;
  }

  const followId = instrumentUrl(activity.object);
  const suffix = followId ? followSuffixFromUrl(followId, us.base) : null;
  if (!suffix) return;

  const pendingKey = `cybw:ap:pending-follow:${suffix}`;
  if ((await kv.get<string>(pendingKey)) === signerActorUrl) await kv.del(pendingKey);
  await kv.srem(us.followingKey, signerActorUrl);
  console.log(`Inbox: follow of ${signerActorUrl} rejected or removed (${us.domain})`);
}

// Whether a URL is one of this actor's own published posts.
async function isOurPost(us: ActorIdentity, url: string): Promise<boolean> {
  const suffix = noteSuffixFromUrl(url, us.base);
  if (!suffix) return false;
  const stored = await kv.get<{ object?: { id?: string } }>(`cybw:post:${suffix}`);
  return stored?.object?.id === url;
}

// Records an incoming boost (Announce) or Like of one of our own posts, for
// our own record-keeping — this is separate from, and has no effect on,
// the counts Mastodon's own UI already shows natively for any post viewed
// there. No response is sent back: unlike Follow/QuoteRequest, these
// aren't requests awaiting an Accept/Reject. Silently ignored if the object
// isn't verifiably one of our real posts, same defensive pattern as
// handleQuoteRequest.
async function handleReaction(
  us: ActorIdentity,
  kind: 'boost' | 'like',
  activity: Record<string, unknown>,
  signerActorUrl: string,
) {
  if (instrumentUrl(activity.actor) !== signerActorUrl) {
    console.error(`Inbox: ${activity.type} actor mismatch — signed by ${signerActorUrl}`);
    return;
  }

  const objectUrl = instrumentUrl(activity.object);
  if (!objectUrl) return;
  if (!(await isOurPost(us, objectUrl))) {
    console.log(`Inbox: ${activity.type} for unknown/mismatched post ${objectUrl} — ignoring`);
    return;
  }

  await addRecord(
    kind === 'boost' ? us.boostsKey : us.likesKey,
    {
      ...(typeof activity.id === 'string' ? { id: activity.id } : {}),
      actor: signerActorUrl,
      object: objectUrl,
      published: new Date().toISOString(),
    },
    (r) => r.actor === signerActorUrl && r.object === objectUrl,
  );
  console.log(`Inbox: ${kind} recorded — ${signerActorUrl} on ${objectUrl} (${us.domain})`);
}

// Someone took back a boost or a like: drop our record of it. Only the
// signer's own records can be removed.
async function handleUndoReaction(us: ActorIdentity, activity: Record<string, unknown>, signerActorUrl: string) {
  if (instrumentUrl(activity.actor) !== signerActorUrl) return;

  const undone = activity.object as { type?: string; object?: unknown } | string | undefined;
  const undoneId = instrumentUrl(undone);
  const undoneType = typeof undone === 'object' ? undone?.type : undefined;
  const target = typeof undone === 'object' ? instrumentUrl(undone?.object) : null;
  const matches = (r: { id?: string; actor: string; object?: string }) =>
    r.actor === signerActorUrl && ((!!undoneId && r.id === undoneId) || (!!target && r.object === target));

  let removed = 0;
  if (undoneType !== 'Like') removed += await removeRecords(us.boostsKey, matches);
  if (undoneType !== 'Announce') removed += await removeRecords(us.likesKey, matches);
  if (removed) console.log(`Inbox: ${signerActorUrl} undid a boost/like (${us.domain})`);
}

// A new post from someone else. Kept only if it's a reply to one of our
// posts or addressed to us (a mention). The bot doesn't answer; this is
// so replies aren't silently lost.
async function handleCreate(us: ActorIdentity, activity: Record<string, unknown>, signerActorUrl: string) {
  if (instrumentUrl(activity.actor) !== signerActorUrl) {
    console.error(`Inbox: Create actor mismatch — signed by ${signerActorUrl}`);
    return;
  }

  const record = buildReplyRecord(activity.object, signerActorUrl, new Date());
  if (!record) return;

  const post = activity.object as Record<string, unknown>;
  const isReply = typeof record.inReplyTo === 'string' && (await isOurPost(us, record.inReplyTo));
  if (!isReply && !mentionsActor(post, us.actorId)) return;

  await addRecord(us.repliesKey, record, (r) => r.id === record.id);
  console.log(`Inbox: ${isReply ? 'reply' : 'mention'} recorded — ${record.id} (${us.domain})`);
}

// The author deleted a post: if it's a reply we recorded, drop it.
async function handleDeletePost(us: ActorIdentity, activity: Record<string, unknown>, signerActorUrl: string) {
  if (instrumentUrl(activity.actor) !== signerActorUrl) return;
  const postId = instrumentUrl(activity.object);
  if (!postId) return;
  const removed = await removeRecords(us.repliesKey, (r) => r.id === postId && r.actor === signerActorUrl);
  if (removed) console.log(`Inbox: removed deleted reply ${postId} (${us.domain})`);
}

// When an account is deleted, its server sends a Delete of the actor itself
// to every inbox it has ever heard of. Returns that actor's URL if the
// activity is one of those, else null. Exported for unit testing.
export function selfDeletedActor(activity: unknown): string | null {
  if (!activity || typeof activity !== 'object') return null;
  const { type, actor, object } = activity as Record<string, unknown>;
  if (type !== 'Delete') return null;
  const actorUrl = instrumentUrl(actor);
  return actorUrl && actorUrl === instrumentUrl(object) ? actorUrl : null;
}

// These Deletes can't be signature-checked the normal way: the account is
// gone, so its key no longer resolves (410). Rejecting them cost an
// outbound fetch each, and the 401 made the sender try a second time. They
// were nearly all of this inbox's traffic. Nothing here is trusted from the
// unverified body: for a stranger there's nothing to do, and for a follower
// we ask the actor's own server whether it's really gone before removing it.
async function handleSelfDelete(us: ActorIdentity, actorUrl: string) {
  if (!actorUrl.startsWith('https://')) return;
  if (!(await kv.sismember(us.followersKey, actorUrl))) return;
  await removeFollowerIfGone(us, actorUrl);
}

export async function POST(req: NextRequest) {
  const us = actorForHost(req.headers.get('host'));
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    // Reported as 400 below, but only to a sender with a valid signature.
  }

  const deletedActor = selfDeletedActor(parsed);
  if (deletedActor) {
    try {
      await handleSelfDelete(us, deletedActor);
    } catch (err) {
      console.error('Inbox: error handling account deletion:', (err as Error).message);
    }
    return new NextResponse(null, { status: 202 });
  }

  let signerActorUrl: string;
  try {
    signerActorUrl = await verifySignature('POST', '/actor/inbox', headers, rawBody);
  } catch (err) {
    console.error('Inbox: signature rejected:', (err as Error).message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const activity = parsed as Record<string, unknown> & {
    type: string;
    actor: string | { id?: string };
    object?: unknown;
  };

  // The body is attacker-supplied even when the signature is valid — only act
  // on Follow/Undo when the claimed actor is the actor that signed the
  // request, or anyone with a fediverse account could (un)follow on behalf
  // of someone else. QuoteRequest/Accept/Reject/Announce do their own
  // equivalent check and log separately, so they're excluded here to avoid a
  // duplicate log line.
  const claimedActor = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id;
  const followerUrl = claimedActor === signerActorUrl ? claimedActor : undefined;
  const selfHandledTypes = ['QuoteRequest', 'Accept', 'Reject', 'Announce', 'Like', 'Create', 'Delete', 'Undo'];
  if (claimedActor && !followerUrl && !selfHandledTypes.includes(activity.type)) {
    console.error(`Inbox: actor mismatch — body claims ${claimedActor}, signed by ${signerActorUrl}`);
  }

  const objectType = (activity.object as { type?: string } | undefined)?.type;

  try {
    if (activity.type === 'Follow') {
      const decision = followerUrl ? followDecision(us, activity.object) : 'ignore';
      if (followerUrl && decision === 'accept') {
        await kv.sadd(us.followersKey, followerUrl);
        await answerFollow(us, 'Accept', activity, followerUrl);
        console.log(`Inbox: new follower ${followerUrl} (${us.domain})`);
      } else if (followerUrl && decision === 'reject') {
        await answerFollow(us, 'Reject', activity, followerUrl);
        console.log(`Inbox: rejected follow of moved actor from ${followerUrl} (${us.domain})`);
      } else if (followerUrl) {
        console.log(`Inbox: ignored Follow from ${followerUrl} aimed at ${instrumentUrl(activity.object)}`);
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
      await handleReaction(us, 'boost', activity, signerActorUrl);
    } else if (activity.type === 'Like') {
      await handleReaction(us, 'like', activity, signerActorUrl);
    } else if (activity.type === 'Undo') {
      // Undo{Follow} was handled above; this is a boost or like taken back.
      await handleUndoReaction(us, activity, signerActorUrl);
    } else if (activity.type === 'Create') {
      await handleCreate(us, activity, signerActorUrl);
    } else if (activity.type === 'Delete') {
      // Account deletions were answered before signature checks; this is a post.
      await handleDeletePost(us, activity, signerActorUrl);
    }
    // All other activity types (Update, etc.) are silently accepted per AP spec
  } catch (err) {
    console.error('Inbox: error processing activity:', (err as Error).message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  return new NextResponse(null, { status: 202 });
}
