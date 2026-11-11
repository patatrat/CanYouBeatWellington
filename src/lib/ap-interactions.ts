import { kv } from "@vercel/kv";

// Records of what other people do with our posts: boosts, likes, and
// replies/mentions. Kept for our own reference (read them back with
// GET /api/admin/interactions) — nothing here is published, shown on the
// site, or answered. Each is a capped KV list, newest first.
const MAX_RECORDS = 200;

export interface InteractionRecord {
  /** The activity's id (a Like/Announce), or the post's id (a reply). */
  id?: string;
  actor: string;
  /** For likes and boosts: which of our posts. */
  object?: string;
  published: string;
  [key: string]: unknown;
}

// Older boost records were stored as JSON strings; KV hands most values
// back already parsed, but cope with either.
function parse(item: unknown): InteractionRecord | null {
  if (typeof item === "string") {
    try {
      return JSON.parse(item);
    } catch {
      return null;
    }
  }
  return item && typeof item === "object" ? (item as InteractionRecord) : null;
}

export async function readRecords(listKey: string): Promise<InteractionRecord[]> {
  const items = (await kv.lrange(listKey, 0, -1)) ?? [];
  return items.map(parse).filter((r): r is InteractionRecord => r !== null);
}

// Removes every record matching `matches`; returns how many went.
export async function removeRecords(
  listKey: string,
  matches: (record: InteractionRecord) => boolean,
): Promise<number> {
  const records = await readRecords(listKey);
  const kept = records.filter((r) => !matches(r));
  if (kept.length === records.length) return 0;
  await kv.del(listKey);
  if (kept.length) await kv.rpush(listKey, ...kept);
  return records.length - kept.length;
}

// Adds a record at the front, replacing any earlier one `replaces` matches
// (servers re-deliver, and a like is still one like).
export async function addRecord(
  listKey: string,
  record: InteractionRecord,
  replaces: (existing: InteractionRecord) => boolean,
): Promise<void> {
  await removeRecords(listKey, replaces);
  await kv.lpush(listKey, record);
  await kv.ltrim(listKey, 0, MAX_RECORDS - 1);
}

const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : value == null ? [] : [value]);

// Whether a post is addressed to an actor: named in `to`/`cc`, or tagged
// with a Mention of it. Exported for unit testing.
export function mentionsActor(post: Record<string, unknown>, actorId: string): boolean {
  if ([...asList(post.to), ...asList(post.cc)].includes(actorId)) return true;
  return asList(post.tag).some(
    (tag) =>
      !!tag &&
      typeof tag === "object" &&
      (tag as { type?: unknown }).type === "Mention" &&
      (tag as { href?: unknown }).href === actorId,
  );
}

const MAX_CONTENT_LENGTH = 5000;

// The record kept for a reply or mention. Returns null unless the post is
// a well-formed one written by `author` and hosted on the author's own
// server (so nobody can file a post under someone else's name). Exported
// for unit testing.
export function buildReplyRecord(
  post: unknown,
  author: string,
  now: Date,
): (InteractionRecord & { id: string }) | null {
  if (!post || typeof post !== "object") return null;
  const p = post as Record<string, unknown>;

  const attributedTo = asList(p.attributedTo)[0];
  const postAuthor =
    typeof attributedTo === "string" ? attributedTo : (attributedTo as { id?: unknown } | undefined)?.id;
  if (postAuthor !== author) return null;

  if (typeof p.id !== "string" || !p.id.startsWith("https://")) return null;
  try {
    if (new URL(p.id).host !== new URL(author).host) return null;
  } catch {
    return null;
  }

  return {
    id: p.id,
    actor: author,
    url: typeof p.url === "string" ? p.url : p.id,
    inReplyTo: typeof p.inReplyTo === "string" ? p.inReplyTo : null,
    content: typeof p.content === "string" ? p.content.slice(0, MAX_CONTENT_LENGTH) : "",
    published: typeof p.published === "string" ? p.published : now.toISOString(),
    received: now.toISOString(),
  };
}
