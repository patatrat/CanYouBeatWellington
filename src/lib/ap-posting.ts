import { kv } from "@vercel/kv";
import { signAndDeliver } from "./http-signatures";
import { NEW_ACTOR, type ActorIdentity } from "./ap-identity";

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
  reason?: string;
}

// Delivers an already-built, signed-per-recipient activity to every current
// follower's inbox in parallel, with per-request timeouts so one hung remote
// server can't stall the caller's function-execution budget. Shared by
// postToFollowers() (new actor) and the admin refresh-note route (old actor,
// backfilling historical posts still attributed to it) — takes the actor
// explicitly rather than assuming one, since the two callers need different
// identities/keys.
export async function deliverToFollowers(
  activity: object,
  privateKeyPem: string,
  actor: ActorIdentity,
): Promise<{ delivered: number; failed: number; total: number }> {
  const followers: string[] = (await kv.smembers(actor.followersKey)) ?? [];
  const results = await Promise.allSettled(
    followers.map(async (followerUrl) => {
      const inboxUrl = await getInboxUrl(followerUrl);
      const status = await signAndDeliver(inboxUrl, activity, actor.keyId, privateKeyPem);
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
  await kv.lpush(NEW_ACTOR.postsListKey, noteIdSuffix);
  await kv.ltrim(NEW_ACTOR.postsListKey, 0, 49);

  const { delivered, failed, total } = await deliverToFollowers(activity, privateKeyPem, NEW_ACTOR);
  return { posted: true, delivered, failed, total };
}
