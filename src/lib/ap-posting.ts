import { kv } from "@vercel/kv";
import { signAndDeliver } from "./http-signatures";

const BASE = "https://canyoubeatwellington.radomski.co.nz";
const ACTOR_ID = `${BASE}/actor`;
const KEY_ID = `${ACTOR_ID}#main-key`;

export interface PostResult {
  posted: boolean;
  delivered?: number;
  failed?: number;
  total?: number;
  reason?: string;
}

async function getInboxUrl(actorUrl: string): Promise<string> {
  const res = await fetch(actorUrl, { headers: { Accept: "application/activity+json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${actorUrl}`);
  const actor = await res.json();
  if (!actor.inbox) throw new Error(`No inbox at ${actorUrl}`);
  return actor.inbox as string;
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
    "@context": "https://www.w3.org/ns/activitystreams",
    id: noteId,
    type: "Note",
    attributedTo: ACTOR_ID,
    content: htmlContent,
    published: now,
    to: ["https://www.w3.org/ns/activitystreams#Public"],
    cc: [`${ACTOR_ID}/followers`],
    url: BASE,
  };

  const activity = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${noteId}/activity`,
    type: "Create",
    actor: ACTOR_ID,
    published: now,
    to: note.to,
    cc: note.cc,
    object: note,
  };

  await kv.set(`cybw:post:${noteIdSuffix}`, activity);
  await kv.lpush("cybw:posts", noteIdSuffix);
  await kv.ltrim("cybw:posts", 0, 49);

  let delivered = 0;
  let failed = 0;

  for (const followerUrl of followers) {
    try {
      const inboxUrl = await getInboxUrl(followerUrl);
      const status = await signAndDeliver(inboxUrl, activity, KEY_ID, privateKeyPem);
      if (status >= 200 && status < 300) {
        delivered++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { posted: true, delivered, failed, total: followers.length };
}
