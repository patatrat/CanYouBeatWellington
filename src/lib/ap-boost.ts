import { NEW_ACTOR } from "./ap-identity";

const PUBLIC = "https://www.w3.org/ns/activitystreams#Public";

export interface BoostTarget {
  id: string;
  attributedTo: string;
}

const asList = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value];

// Checks a fetched remote object is something we're allowed to boost:
// public or unlisted (Public in `to` or `cc` — Mastodon itself refuses to
// boost followers-only or direct posts), with an https id on the same host
// we fetched it from, so a hostile server can't hand back an object
// claiming to be someone else's post.
export function parseBoostTarget(object: unknown, fetchedFrom: string): BoostTarget | { error: string } {
  if (!object || typeof object !== "object") return { error: "Not an ActivityPub object" };
  const { id, attributedTo, to, cc } = object as Record<string, unknown>;

  if (typeof id !== "string" || !id.startsWith("https://")) return { error: "Object has no https id" };
  if (new URL(id).host !== new URL(fetchedFrom).host) return { error: "Object id is on a different host than the URL" };

  const author = Array.isArray(attributedTo) ? attributedTo[0] : attributedTo;
  if (typeof author !== "string" || !author.startsWith("https://")) return { error: "Object has no author" };

  if (![...asList(to), ...asList(cc)].includes(PUBLIC)) return { error: "Post isn't public, so it can't be boosted" };

  return { id, attributedTo: author };
}

// Mastodon's own Announce shape: object is the bare id (receivers fetch it
// themselves), addressed publicly and cc'd to the original author so their
// server notifies them and counts the boost.
export function buildAnnounceActivity(target: BoostTarget, announceId: string): Record<string, unknown> {
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${NEW_ACTOR.actorId}/announces/${announceId}`,
    type: "Announce",
    actor: NEW_ACTOR.actorId,
    published: new Date().toISOString(),
    to: [PUBLIC],
    cc: [target.attributedTo, `${NEW_ACTOR.actorId}/followers`],
    object: target.id,
  };
}
