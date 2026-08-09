import { describe, it, expect } from "vitest";
import { resolveWebfingerResource } from "../route";
import { OLD_ACTOR, NEW_ACTOR } from "../../../../lib/ap-identity";

describe("resolveWebfingerResource", () => {
  it("resolves the exact-case username on both actor domains", () => {
    expect(resolveWebfingerResource(`acct:CanYouBeat@${OLD_ACTOR.domain}`)).toBe(OLD_ACTOR);
    expect(resolveWebfingerResource(`acct:CanYouBeat@${NEW_ACTOR.domain}`)).toBe(NEW_ACTOR);
  });

  it("resolves regardless of username case — real lookups aren't guaranteed exact case", () => {
    expect(resolveWebfingerResource(`acct:canyoubeat@${NEW_ACTOR.domain}`)).toBe(NEW_ACTOR);
    expect(resolveWebfingerResource(`acct:CANYOUBEAT@${NEW_ACTOR.domain}`)).toBe(NEW_ACTOR);
    expect(resolveWebfingerResource(`acct:CanYouBEAT@${OLD_ACTOR.domain}`)).toBe(OLD_ACTOR);
  });

  it("returns null for an unrecognized domain", () => {
    expect(resolveWebfingerResource("acct:CanYouBeat@example.com")).toBeNull();
  });

  it("returns null for a different username entirely", () => {
    expect(resolveWebfingerResource(`acct:SomeoneElse@${NEW_ACTOR.domain}`)).toBeNull();
  });

  it("returns null for missing or malformed resource", () => {
    expect(resolveWebfingerResource(null)).toBeNull();
    expect(resolveWebfingerResource("")).toBeNull();
    expect(resolveWebfingerResource("not-an-acct-uri")).toBeNull();
  });
});
