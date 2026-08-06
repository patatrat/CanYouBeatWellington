import { kv } from "@vercel/kv";
import { signAndDeliver } from "./http-signatures";

const BASE = "https://canyoubeatwellington.radomski.co.nz";
// The Note's `url` — "a link to a representation of this object" per the
// ActivityStreams spec, i.e. what Mastodon's "view on the web" link opens.
// Unlike the actor/note id (which must stay on the AP-pinned domain), this
// is just a human-facing pointer, so it goes to the new domain.
const SITE_URL = "https://www.canyoubeatwellington.nz";
const ACTOR_ID = `${BASE}/actor`;
const KEY_ID = `${ACTOR_ID}#main-key`;

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
export const QUOTABLE_BY_ANYONE = {
  canQuote: { automaticApproval: ["https://www.w3.org/ns/activitystreams#Public"] },
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
  reason?: string;
}

// Delivers an already-built, signed-per-recipient activity to every current
// follower's inbox in parallel, with per-request timeouts so one hung remote
// server can't stall the caller's function-execution budget. Shared by
// postToFollowers() and the admin refresh-note route (which sends an Update
// rather than a Create).
export async function deliverToFollowers(
  activity: object,
  privateKeyPem: string,
): Promise<{ delivered: number; failed: number; total: number }> {
  const followers: string[] = (await kv.smembers("cybw:ap:followers")) ?? [];
  const results = await Promise.allSettled(
    followers.map(async (followerUrl) => {
      const inboxUrl = await getInboxUrl(followerUrl);
      const status = await signAndDeliver(inboxUrl, activity, KEY_ID, privateKeyPem);
      if (status < 200 || status >= 300) throw new Error(`HTTP ${status} delivering to ${inboxUrl}`);
    }),
  );
  const delivered = results.filter((r) => r.status === "fulfilled").length;
  return { delivered, failed: followers.length - delivered, total: followers.length };
}

async function getInboxUrl(actorUrl: string): Promise<string> {
  const cacheKey = `cybw:ap:inbox:${actorUrl}`;
  const cached = await kv.get<string>(cacheKey);
  if (cached?.startsWith("https://")) return cached;

  const res = await fetch(actorUrl, {
    headers: { Accept: "application/activity+json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${actorUrl}`);
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
export async function postToFollowers(htmlContent: string, noteIdSuffix: string): Promise<PostResult> {
  const privateKeyPem = process.env.AP_PRIVATE_KEY;
  if (!privateKeyPem) return { posted: false, reason: "AP_PRIVATE_KEY not set" };

  const followerCount = (await kv.scard("cybw:ap:followers")) ?? 0;
  if (followerCount === 0) return { posted: false, reason: "no followers" };

  const now = new Date().toISOString();
  const noteId = `${BASE}/notes/${noteIdSuffix}`;

  const note = {
    "@context": ["https://www.w3.org/ns/activitystreams", QUOTE_CONTEXT],
    id: noteId,
    type: "Note",
    attributedTo: ACTOR_ID,
    content: htmlContent,
    published: now,
    to: ["https://www.w3.org/ns/activitystreams#Public"],
    cc: [`${ACTOR_ID}/followers`],
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
  await kv.lpush("cybw:posts", noteIdSuffix);
  await kv.ltrim("cybw:posts", 0, 49);

  const { delivered, failed, total } = await deliverToFollowers(activity, privateKeyPem);
  return { posted: true, delivered, failed, total };
}
