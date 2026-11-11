import { kv } from "@vercel/kv";
import { signAndDeliver, fetchActivityJson } from "./http-signatures";
import { NEW_ACTOR, OLD_ACTOR, type ActorIdentity } from "./ap-identity";

// Daily posting now targets the new actor — switched over once the Move
// completed and the old actor's followers had migrated (see CLAUDE.md's
// migration backlog). The old actor keeps working exactly as before for
// anything that still needs it (e.g. refresh-note, backfilling historical
// posts still attributed to it) via the actor parameter on
// deliverToFollowers() below.
const BASE = NEW_ACTOR.base;
const ACTOR_ID = NEW_ACTOR.actorId;
// The Note's `url` — "a link to a representation of this object" per the
// ActivityStreams spec, i.e. what Mastodon's "view on the web" link opens.
// Unlike the actor/note id (which must stay on the AP-pinned domain), this
// is just a human-facing pointer, so it goes to the new domain.
const SITE_URL = "https://canyoubeatwellington.nz";

// FEP-044f quote-post context terms, copied verbatim from a live Mastodon
// post's own ActivityPub JSON (fetched directly, not from third-party docs,
// since third-party write-ups disagreed on the exact namespace). Mastodon
// itself uses GoToSocial's "gts:" vocabulary for these terms even though
// they didn't originate there — this is what Mastodon actually parses.
// Exported so the admin refresh-note route can rebuild the same shape for
// posts published before this field existed.
export const QUOTE_CONTEXT = {
  gts: "https://gotosocial.org/ns#",
  interactionPolicy: { "@id": "gts:interactionPolicy", "@type": "@id" },
  canQuote: { "@id": "gts:canQuote", "@type": "@id" },
  automaticApproval: { "@id": "gts:automaticApproval", "@type": "@id" },
};

// Public collection URI in automaticApproval means "anyone may quote this
// without my approval" — without it, Mastodon defaults new posts to
// author-only auto-approval (confirmed by inspecting a real Mastodon post),
// which reads to a quoting user as "you are not allowed to quote this."
// automaticApproval is a bare string, not an array — confirmed against the
// FEP-044f spec text and two independent server-implementer guides.
export const QUOTABLE_BY_ANYONE = {
  canQuote: { automaticApproval: "https://www.w3.org/ns/activitystreams#Public" },
};

// Notes are stored for a year (see the kv.set below) — reapplied whenever a
// stored activity is rewritten (e.g. by the admin refresh-note route) so a
// backfill never accidentally makes the key persist forever.
export const NOTE_TTL_SECONDS = 60 * 60 * 24 * 365;

export interface PostResult {
  posted: boolean;
  delivered?: number;
  failed?: number;
  total?: number;
  removed?: number;
  queued?: number;
  reason?: string;
}

export type DeliveryOutcome = "delivered" | "gone" | "retry" | "failed";

// What an inbox's HTTP answer means for a delivery. 404/410 suggests the
// account is gone (confirmed against the actor itself before anything is
// removed). Timeouts, rate limits and server errors are worth another go.
// Any other 4xx is the server refusing this activity, which a retry won't
// change. Exported for unit testing.
export function classifyDeliveryStatus(status: number): DeliveryOutcome {
  if (status >= 200 && status < 300) return "delivered";
  if (status === 404 || status === 410) return "gone";
  if (status === 408 || status === 429 || status >= 500) return "retry";
  return "failed";
}

class HttpStatusError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Removes a follower, but only once their own server says the account no
// longer exists (404/410 on the actor itself). Returns whether it did.
// Shared by delivery (a dead inbox) and the inbox route (an account-deletion
// notice, which can't be signature-checked because the key is gone too).
export async function removeFollowerIfGone(actor: ActorIdentity, followerUrl: string): Promise<boolean> {
  const res = await fetchActivityJson(followerUrl);
  if (res.status !== 404 && res.status !== 410) return false;
  await kv.srem(actor.followersKey, followerUrl);
  await kv.del(`cybw:ap:inbox:${followerUrl}`);
  console.log(`Removed deleted follower ${followerUrl} (${actor.domain})`);
  return true;
}

async function deliverOnce(
  followerUrl: string,
  activity: object,
  privateKeyPem: string,
  actor: ActorIdentity,
): Promise<DeliveryOutcome> {
  let status: number;
  try {
    const inboxUrl = await getInboxUrl(followerUrl);
    status = await signAndDeliver(inboxUrl, activity, actor.keyId, privateKeyPem);
  } catch (err) {
    // Looking up the inbox fetches the actor, so a 404/410 there already is
    // the actor's own server saying it's gone.
    if (err instanceof HttpStatusError && classifyDeliveryStatus(err.status) === "gone") {
      await kv.srem(actor.followersKey, followerUrl);
      console.log(`Removed deleted follower ${followerUrl} (${actor.domain})`);
      return "gone";
    }
    return "retry";
  }

  const outcome = classifyDeliveryStatus(status);
  if (outcome !== "gone") return outcome;
  try {
    if (await removeFollowerIfGone(actor, followerUrl)) return "gone";
  } catch {
    // Couldn't check — treat like any other temporary failure.
  }
  // The account exists but its inbox doesn't: the cached inbox URL is stale.
  await kv.del(`cybw:ap:inbox:${followerUrl}`);
  return "retry";
}

// Deliveries that failed for a reason that might pass (server down, timeout,
// rate limit) wait here and are retried by retryFailedDeliveries(), which
// both crons call. Mastodon does the same with a backoff queue; without it a
// follower whose server was down for a minute missed that post for good.
const RETRY_QUEUE_KEY = "cybw:ap:delivery-retries";
export const MAX_DELIVERY_ATTEMPTS = 6;
export const MAX_RETRY_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_RETRY_QUEUE = 500;

export interface RetryEntry {
  actor: "old" | "new";
  follower: string;
  activity: object;
  /** Deliveries attempted so far, including the original. */
  attempts: number;
  queuedAt: number;
}

// Whether a queued delivery is still worth another attempt. Exported for
// unit testing.
export function isRetryable(entry: RetryEntry, now: number): boolean {
  return entry.attempts < MAX_DELIVERY_ATTEMPTS && now - entry.queuedAt < MAX_RETRY_AGE_MS;
}

async function queueRetries(entries: RetryEntry[]) {
  if (entries.length === 0) return;
  await kv.rpush(RETRY_QUEUE_KEY, ...entries);
  // Keep the newest if something is persistently failing at volume.
  await kv.ltrim(RETRY_QUEUE_KEY, -MAX_RETRY_QUEUE, -1);
}

export interface DeliveryResult {
  delivered: number;
  failed: number;
  total: number;
  /** Followers removed because their account no longer exists. */
  removed: number;
  /** Failed deliveries queued for another attempt on a later cron run. */
  queued: number;
}

// Delivers an already-built activity to every current follower's inbox in
// parallel, with per-request timeouts so one hung remote server can't stall
// the caller's function-execution budget. Takes the actor explicitly rather
// than assuming one, since callers need different identities/keys (the new
// actor for posts, either for refresh-note/refresh-actor, the old one for
// send-move). `failed` counts everything that didn't arrive this time,
// including followers removed as gone and deliveries queued for retry.
export async function deliverToFollowers(
  activity: object,
  privateKeyPem: string,
  actor: ActorIdentity,
): Promise<DeliveryResult> {
  const followers: string[] = (await kv.smembers(actor.followersKey)) ?? [];
  const outcomes = await Promise.all(
    followers.map((followerUrl) =>
      deliverOnce(followerUrl, activity, privateKeyPem, actor).catch((): DeliveryOutcome => "retry"),
    ),
  );

  const now = Date.now();
  const retries: RetryEntry[] = followers.flatMap((follower, i) =>
    outcomes[i] === "retry"
      ? [{ actor: actor === NEW_ACTOR ? ("new" as const) : ("old" as const), follower, activity, attempts: 1, queuedAt: now }]
      : [],
  );
  let queued = retries.length;
  try {
    await queueRetries(retries);
  } catch (err) {
    console.error("Could not queue delivery retries:", (err as Error).message);
    queued = 0;
  }

  const delivered = outcomes.filter((o) => o === "delivered").length;
  return {
    delivered,
    failed: followers.length - delivered,
    total: followers.length,
    removed: outcomes.filter((o) => o === "gone").length,
    queued,
  };
}

export interface RetryResult {
  retried: number;
  delivered: number;
  requeued: number;
  dropped: number;
}

// Takes the deliveries waiting in the retry queue and tries each once more.
// Ones that fail again go back on the queue until they run out of attempts
// or age. Skips anyone who has since unfollowed. Only pops what was queued
// when it started, so entries it re-queues aren't retried in the same run.
export async function retryFailedDeliveries(): Promise<RetryResult> {
  const result: RetryResult = { retried: 0, delivered: 0, requeued: 0, dropped: 0 };
  const waiting = await kv.llen(RETRY_QUEUE_KEY);
  if (!waiting) return result;

  const entries = (await kv.lpop<RetryEntry[]>(RETRY_QUEUE_KEY, waiting)) ?? [];
  const now = Date.now();

  const requeue: RetryEntry[] = [];
  await Promise.all(
    entries.map(async (entry) => {
      const actor = entry.actor === "new" ? NEW_ACTOR : OLD_ACTOR;
      const privateKeyPem = process.env[actor.privateKeyEnvVar];
      let outcome: DeliveryOutcome | "skip" = "skip";
      try {
        if (privateKeyPem && isRetryable(entry, now) && (await kv.sismember(actor.followersKey, entry.follower))) {
          result.retried++;
          outcome = await deliverOnce(entry.follower, entry.activity, privateKeyPem, actor);
        }
      } catch {
        outcome = "retry";
      }

      const next = { ...entry, attempts: entry.attempts + 1 };
      if (outcome === "delivered") result.delivered++;
      else if (outcome === "retry" && isRetryable(next, now)) requeue.push(next);
      else result.dropped++;
    }),
  );

  result.requeued = requeue.length;
  await queueRetries(requeue);
  return result;
}

export async function getInboxUrl(actorUrl: string): Promise<string> {
  const cacheKey = `cybw:ap:inbox:${actorUrl}`;
  const cached = await kv.get<string>(cacheKey);
  if (cached?.startsWith("https://")) return cached;

  const res = await fetchActivityJson(actorUrl);
  if (!res.ok) throw new HttpStatusError(`HTTP ${res.status} fetching ${actorUrl}`, res.status);
  const actor = await res.json();
  const inbox = actor.inbox as string | undefined;
  if (!inbox?.startsWith("https://")) throw new Error(`No https inbox at ${actorUrl}`);
  await kv.set(cacheKey, inbox);
  return inbox;
}

// Builds a Note wrapped in a Create activity, stores it in KV (so the note
// URL is resolvable when remote servers fetch it to verify the activity),
// and delivers it to every current follower's inbox.
//
// noteIdSuffix must be unique per post — e.g. today's date for the daily
// weather post, `announce-${Date.now()}` for a one-off announcement, or
// `special-${slug}-${date}` for a special-date post.
//
// hashtags (plain names, no leading #) become a `tag` array of Hashtag
// objects — this is what Mastodon actually relies on to index/search a
// remote post under a tag; a plain "#word" string in content alone isn't
// reliably enough. No href on each entry: Mastodon substitutes its own
// local tag-browse URL when rendering to its own users regardless of what
// we'd put there, and we don't have a hashtag-browsing page of our own for
// it to point at.
export async function postToFollowers(
  htmlContent: string,
  noteIdSuffix: string,
  hashtags: string[] = [],
): Promise<PostResult> {
  const privateKeyPem = process.env[NEW_ACTOR.privateKeyEnvVar];
  if (!privateKeyPem) return { posted: false, reason: `${NEW_ACTOR.privateKeyEnvVar} not set` };

  const followerCount = (await kv.scard(NEW_ACTOR.followersKey)) ?? 0;
  if (followerCount === 0) return { posted: false, reason: "no followers" };

  const now = new Date().toISOString();
  const noteId = `${BASE}/notes/${noteIdSuffix}`;

  const note = {
    "@context": ["https://www.w3.org/ns/activitystreams", QUOTE_CONTEXT],
    id: noteId,
    type: "Note",
    attributedTo: ACTOR_ID,
    content: htmlContent,
    // Without this, Mastodon can't tell the post's language and offers a
    // "Translate" button regardless of what it's actually written in —
    // confirmed against a real Mastodon post's own JSON (same shape,
    // content duplicated under the language key).
    contentMap: { en: htmlContent },
    published: now,
    to: ["https://www.w3.org/ns/activitystreams#Public"],
    cc: [`${ACTOR_ID}/followers`],
    tag: hashtags.map((name) => ({ type: "Hashtag", name: `#${name}` })),
    url: SITE_URL,
    interactionPolicy: QUOTABLE_BY_ANYONE,
  };

  const activity = {
    "@context": ["https://www.w3.org/ns/activitystreams", QUOTE_CONTEXT],
    id: `${noteId}/activity`,
    type: "Create",
    actor: ACTOR_ID,
    published: now,
    to: note.to,
    cc: note.cc,
    object: note,
  };

  // Expire stored notes after a year — the outbox list is trimmed to 50
  // entries below, so without a TTL the trimmed cybw:post:* keys would
  // accumulate in KV forever.
  await kv.set(`cybw:post:${noteIdSuffix}`, activity, { ex: NOTE_TTL_SECONDS });
  // Drop any earlier entry first, so re-posting the same note (a cron
  // re-run) doesn't list it in the outbox twice.
  await kv.lrem(NEW_ACTOR.postsListKey, 0, noteIdSuffix);
  await kv.lpush(NEW_ACTOR.postsListKey, noteIdSuffix);
  await kv.ltrim(NEW_ACTOR.postsListKey, 0, 49);

  return { posted: true, ...(await deliverToFollowers(activity, privateKeyPem, NEW_ACTOR)) };
}
