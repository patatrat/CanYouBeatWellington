import { kv } from "@vercel/kv";
import { signAndDeliver } from "./http-signatures";

const BASE = "https://canyoubeatwellington.radomski.co.nz";
const ACTOR_ID = `${BASE}/actor`;
const KEY_ID = `${ACTOR_ID}#main-key`;

// FEP-044f quote-post context terms, copied verbatim from a live Mastodon
// post's own ActivityPub JSON (fetched directly, not from third-party docs,
// since third-party write-ups disagreed on the exact namespace). Mastodon
// itself uses GoToSocial's "gts:" vocabulary for these terms even though
// they didn't originate there — this is what Mastodon actually parses.
const QUOTE_CONTEXT = {
  gts: "https://gotosocial.org/ns#",
  interactionPolicy: { "@id": "gts:interactionPolicy", "@type": "@id" },
  canQuote: { "@id": "gts:canQuote", "@type": "@id" },
  automaticApproval: { "@id": "gts:automaticApproval", "@type": "@id" },
};

// Public collection URI in automaticApproval means "anyone may quote this
// without my approval" — without it, Mastodon defaults new posts to
// author-only auto-approval (confirmed by inspecting a real Mastodon post),
// which reads to a quoting user as "you are not allowed to quote this."
const QUOTABLE_BY_ANYONE = {
  canQuote: { automaticApproval: ["https://www.w3.org/ns/activitystreams#Public"] },
};

export interface PostResult {
  posted: boolean;
  delivered?: number;
  failed?: number;
  total?: number;
  reason?: string;
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

  const followers: string[] = (await kv.smembers("cybw:ap:followers")) ?? [];
  if (followers.length === 0) return { posted: false, reason: "no followers" };

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
    url: BASE,
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
  await kv.set(`cybw:post:${noteIdSuffix}`, activity, { ex: 60 * 60 * 24 * 365 });
  await kv.lpush("cybw:posts", noteIdSuffix);
  await kv.ltrim("cybw:posts", 0, 49);

  // Deliveries run in parallel with per-request timeouts so one hung remote
  // server can't stall the whole fan-out into the route's maxDuration.
  const results = await Promise.allSettled(
    followers.map(async (followerUrl) => {
      const inboxUrl = await getInboxUrl(followerUrl);
      const status = await signAndDeliver(inboxUrl, activity, KEY_ID, privateKeyPem);
      if (status < 200 || status >= 300) throw new Error(`HTTP ${status} delivering to ${inboxUrl}`);
    }),
  );
  const delivered = results.filter((r) => r.status === "fulfilled").length;

  return { posted: true, delivered, failed: followers.length - delivered, total: followers.length };
}
