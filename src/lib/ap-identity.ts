// Two ActivityPub actor identities coexist during the domain migration: the
// original actor (still what all current followers' servers know), and a
// new one at the new domain that followers will eventually be moved to via
// a FEP-compliant Move activity (see the admin/send-move route). Both are
// defined here so every route serves a self-consistent identity instead of
// hardcoding one domain string independently in eight separate files.

export interface ActorIdentity {
  domain: string;
  base: string;
  actorId: string;
  keyId: string;
  followersKey: string;
  /** KV set key of actor URLs this actor is following (accounts we follow, not our followers). */
  followingKey: string;
  /** KV list key indexing this actor's own published post ids, for its outbox. */
  postsListKey: string;
  /** KV list key of recorded Announce (boost) events on this actor's posts — internal record-keeping only, not exposed via any AP collection. */
  boostsKey: string;
  publicKeyEnvVar: string;
  privateKeyEnvVar: string;
}

const OLD_DOMAIN = "canyoubeatwellington.radomski.co.nz";
const OLD_BASE = `https://${OLD_DOMAIN}`;

export const OLD_ACTOR: ActorIdentity = {
  domain: OLD_DOMAIN,
  base: OLD_BASE,
  actorId: `${OLD_BASE}/actor`,
  keyId: `${OLD_BASE}/actor#main-key`,
  followersKey: "cybw:ap:followers",
  followingKey: "cybw:ap:following",
  postsListKey: "cybw:posts",
  boostsKey: "cybw:ap:boosts",
  publicKeyEnvVar: "AP_PUBLIC_KEY",
  privateKeyEnvVar: "AP_PRIVATE_KEY",
};

// The bare apex — canyoubeatwellington.nz is now the canonical, non-
// redirected domain (Vercel's own domain config redirects www to the apex,
// flipped from the original apex-to-www setup), so the new actor's id,
// WebFinger handle, and endpoints all live at the same clean domain with no
// split needed between "what the handle says" and "what actually resolves."
const NEW_DOMAIN = "canyoubeatwellington.nz";
const NEW_BASE = `https://${NEW_DOMAIN}`;

export const NEW_ACTOR: ActorIdentity = {
  domain: NEW_DOMAIN,
  base: NEW_BASE,
  actorId: `${NEW_BASE}/actor`,
  keyId: `${NEW_BASE}/actor#main-key`,
  followersKey: "cybw:ap:followers:new",
  followingKey: "cybw:ap:following:new",
  postsListKey: "cybw:posts:new",
  boostsKey: "cybw:ap:boosts:new",
  publicKeyEnvVar: "AP_PUBLIC_KEY_NEW",
  privateKeyEnvVar: "AP_PRIVATE_KEY_NEW",
};

// The new actor claims succession from the old one — Mastodon cross-checks
// this against the old actor's movedTo before it'll honor a future Move.
export const NEW_ACTOR_ALSO_KNOWN_AS = [OLD_ACTOR.actorId];

// The old actor pre-announces where it's moving to. Safe to publish ahead
// of actually sending the Move activity: this is a declarative field on a
// document that only gets (re-)fetched when something looks at this actor,
// not itself a fediverse-wide broadcast the way delivering a signed Move
// activity to every follower's inbox is.
export const OLD_ACTOR_MOVED_TO = NEW_ACTOR.actorId;

// Route handlers branch on the request's Host header to decide which actor
// to serve — defaults to the old actor for any unrecognized host, since
// that's the identity that's actually live/authoritative right now.
export function actorForHost(host: string | null): ActorIdentity {
  return host === NEW_ACTOR.domain ? NEW_ACTOR : OLD_ACTOR;
}

// WebFinger resolves by the resource param's domain part, not the request
// Host header — a single physical host can and does answer WebFinger
// queries for either acct domain regardless of which hostname the HTTP
// request itself arrived on.
export function actorForWebfingerDomain(domain: string): ActorIdentity | null {
  if (domain === OLD_ACTOR.domain) return OLD_ACTOR;
  if (domain === NEW_ACTOR.domain) return NEW_ACTOR;
  return null;
}
