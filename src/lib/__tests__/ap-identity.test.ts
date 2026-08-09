import { describe, it, expect } from "vitest";
import {
  OLD_ACTOR,
  NEW_ACTOR,
  NEW_ACTOR_ALSO_KNOWN_AS,
  OLD_ACTOR_MOVED_TO,
  actorForHost,
  actorForWebfingerDomain,
} from "../ap-identity";

describe("actorForHost", () => {
  it("resolves the new actor's own domain to the new actor", () => {
    expect(actorForHost("canyoubeatwellington.nz")).toBe(NEW_ACTOR);
  });

  it("resolves the old actor's domain to the old actor", () => {
    expect(actorForHost("canyoubeatwellington.radomski.co.nz")).toBe(OLD_ACTOR);
  });

  it("defaults to the old actor for any unrecognized host", () => {
    // www no longer resolves to anything on our side — Vercel's own domain
    // config redirects it to the bare apex before we ever see the request.
    expect(actorForHost("www.canyoubeatwellington.nz")).toBe(OLD_ACTOR);
    expect(actorForHost("some-preview-url.vercel.app")).toBe(OLD_ACTOR);
    expect(actorForHost(null)).toBe(OLD_ACTOR);
  });
});

describe("actorForWebfingerDomain", () => {
  it("resolves the old actor's acct domain", () => {
    expect(actorForWebfingerDomain("canyoubeatwellington.radomski.co.nz")).toBe(OLD_ACTOR);
  });

  it("resolves the new actor's acct domain", () => {
    expect(actorForWebfingerDomain("canyoubeatwellington.nz")).toBe(NEW_ACTOR);
  });

  it("returns null for an unrecognized domain", () => {
    expect(actorForWebfingerDomain("www.canyoubeatwellington.nz")).toBeNull();
    expect(actorForWebfingerDomain("example.com")).toBeNull();
  });
});

describe("identity consistency", () => {
  it("the two actors have distinct ids, keys, followers/following/posts-list keys", () => {
    expect(OLD_ACTOR.actorId).not.toBe(NEW_ACTOR.actorId);
    expect(OLD_ACTOR.keyId).not.toBe(NEW_ACTOR.keyId);
    expect(OLD_ACTOR.followersKey).not.toBe(NEW_ACTOR.followersKey);
    expect(OLD_ACTOR.followingKey).not.toBe(NEW_ACTOR.followingKey);
    expect(OLD_ACTOR.postsListKey).not.toBe(NEW_ACTOR.postsListKey);
    expect(OLD_ACTOR.publicKeyEnvVar).not.toBe(NEW_ACTOR.publicKeyEnvVar);
    expect(OLD_ACTOR.privateKeyEnvVar).not.toBe(NEW_ACTOR.privateKeyEnvVar);
  });

  it("alsoKnownAs/movedTo cross-reference each other correctly", () => {
    expect(NEW_ACTOR_ALSO_KNOWN_AS).toEqual([OLD_ACTOR.actorId]);
    expect(OLD_ACTOR_MOVED_TO).toBe(NEW_ACTOR.actorId);
  });
});
