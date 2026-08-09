import { NEW_ACTOR, OLD_ACTOR } from "./ap-identity";

// Constructs the FEP-compliant Move activity that migrates the actor
// identity from the old domain to the new one. Mastodon (on receipt, from
// followers whose server implements Move) verifies `target`'s alsoKnownAs
// lists `actor`/`object` before honoring it, then auto-follows the new
// actor and auto-unfollows the old one on the user's behalf.
//
// Deliberately just a builder — nothing calls this automatically. Sending
// it is a one-way, fediverse-visible action gated behind a manual admin
// route (api/admin/send-move), held until the shared KV database migration
// is complete and burned in.
export function buildMoveActivity(): Record<string, unknown> {
  return {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${OLD_ACTOR.base}/actor/moves/${Date.now()}`,
    type: "Move",
    actor: OLD_ACTOR.actorId,
    object: OLD_ACTOR.actorId,
    target: NEW_ACTOR.actorId,
    published: new Date().toISOString(),
  };
}
