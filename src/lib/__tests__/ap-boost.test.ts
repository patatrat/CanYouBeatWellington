import { describe, it, expect } from "vitest";
import { parseBoostTarget, buildAnnounceActivity } from "../ap-boost";
import { NEW_ACTOR } from "../ap-identity";

const PUBLIC = "https://www.w3.org/ns/activitystreams#Public";
const URL_ = "https://mastodon.nz/@Pat/117452510736334789";
const post = {
  id: "https://mastodon.nz/users/Pat/statuses/117452510736334789",
  type: "Note",
  attributedTo: "https://mastodon.nz/users/Pat",
  to: [PUBLIC],
  cc: ["https://mastodon.nz/users/Pat/followers"],
};

describe("parseBoostTarget", () => {
  it("accepts a public post", () => {
    expect(parseBoostTarget(post, URL_)).toEqual({ id: post.id, attributedTo: post.attributedTo });
  });

  it("accepts an unlisted post (Public in cc)", () => {
    const unlisted = { ...post, to: ["https://mastodon.nz/users/Pat/followers"], cc: [PUBLIC] };
    expect(parseBoostTarget(unlisted, URL_)).not.toHaveProperty("error");
  });

  it("rejects followers-only posts", () => {
    const privatePost = { ...post, to: ["https://mastodon.nz/users/Pat/followers"], cc: [] };
    expect(parseBoostTarget(privatePost, URL_)).toHaveProperty("error");
  });

  it("rejects an object whose id is on a different host", () => {
    expect(parseBoostTarget({ ...post, id: "https://evil.example/statuses/1" }, URL_)).toHaveProperty("error");
  });

  it("rejects non-objects and objects without an author", () => {
    expect(parseBoostTarget(null, URL_)).toHaveProperty("error");
    expect(parseBoostTarget({ ...post, attributedTo: undefined }, URL_)).toHaveProperty("error");
  });
});

describe("buildAnnounceActivity", () => {
  it("announces the post as the new actor, cc'ing the author", () => {
    const announce = buildAnnounceActivity({ id: post.id, attributedTo: post.attributedTo }, "abc");
    expect(announce.type).toBe("Announce");
    expect(announce.actor).toBe(NEW_ACTOR.actorId);
    expect(announce.object).toBe(post.id);
    expect(announce.id).toBe(`${NEW_ACTOR.actorId}/announces/abc`);
    expect(announce.to).toEqual([PUBLIC]);
    expect(announce.cc).toEqual([post.attributedTo, `${NEW_ACTOR.actorId}/followers`]);
  });
});
