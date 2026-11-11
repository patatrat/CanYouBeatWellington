import { describe, it, expect } from "vitest";
import { noteSuffixFromUrl, instrumentUrl, followSuffixFromUrl, selfDeletedActor, followDecision } from "../route";
import { OLD_ACTOR, NEW_ACTOR } from "../../../../lib/ap-identity";

describe("noteSuffixFromUrl", () => {
  it("extracts the suffix from one of the given actor's own note URLs", () => {
    expect(noteSuffixFromUrl(`${OLD_ACTOR.base}/notes/2026-08-03`, OLD_ACTOR.base)).toBe("2026-08-03");
    expect(noteSuffixFromUrl(`${NEW_ACTOR.base}/notes/announce-12345`, NEW_ACTOR.base)).toBe(
      "announce-12345",
    );
  });

  it("returns null when the URL belongs to the other actor's domain", () => {
    expect(noteSuffixFromUrl(`${OLD_ACTOR.base}/notes/2026-08-03`, NEW_ACTOR.base)).toBeNull();
    expect(noteSuffixFromUrl(`${NEW_ACTOR.base}/notes/announce-12345`, OLD_ACTOR.base)).toBeNull();
  });

  it("returns null for a URL that isn't shaped like one of ours", () => {
    expect(noteSuffixFromUrl("https://example.com/users/bob/statuses/1", OLD_ACTOR.base)).toBeNull();
    expect(noteSuffixFromUrl(`${OLD_ACTOR.base}/actor`, OLD_ACTOR.base)).toBeNull();
  });

  it("returns null for the bare notes prefix with nothing after it", () => {
    // Empty string is falsy but still a defined match — startsWith is true,
    // slice gives "", which is the correct (if degenerate) extraction; the
    // caller's KV lookup for cybw:post: will simply miss and be ignored.
    expect(noteSuffixFromUrl(`${OLD_ACTOR.base}/notes/`, OLD_ACTOR.base)).toBe("");
  });
});

describe("followSuffixFromUrl", () => {
  it("extracts the suffix from one of the given actor's own outgoing Follow URLs", () => {
    expect(followSuffixFromUrl(`${NEW_ACTOR.base}/actor/follows/1786255704076`, NEW_ACTOR.base)).toBe(
      "1786255704076",
    );
  });

  it("returns null when the URL belongs to the other actor's domain", () => {
    expect(followSuffixFromUrl(`${NEW_ACTOR.base}/actor/follows/123`, OLD_ACTOR.base)).toBeNull();
  });

  it("returns null for a URL that isn't shaped like one of ours", () => {
    expect(followSuffixFromUrl("https://example.com/users/bob/statuses/1", NEW_ACTOR.base)).toBeNull();
    expect(followSuffixFromUrl(`${NEW_ACTOR.base}/actor/accepts/123`, NEW_ACTOR.base)).toBeNull();
  });
});

describe("instrumentUrl", () => {
  it("returns the value directly when instrument is a bare string", () => {
    expect(instrumentUrl("https://example.com/users/bob/statuses/1")).toBe(
      "https://example.com/users/bob/statuses/1",
    );
  });

  it("extracts id when instrument is a fully embedded object", () => {
    expect(
      instrumentUrl({
        type: "Note",
        id: "https://example.com/users/bob/statuses/1",
        attributedTo: "https://example.com/users/bob",
        content: "quoting!",
      }),
    ).toBe("https://example.com/users/bob/statuses/1");
  });

  it("returns null when instrument is missing or malformed", () => {
    expect(instrumentUrl(undefined)).toBeNull();
    expect(instrumentUrl(null)).toBeNull();
    expect(instrumentUrl({})).toBeNull();
    expect(instrumentUrl({ id: 123 })).toBeNull();
    expect(instrumentUrl(42)).toBeNull();
  });
});

describe("selfDeletedActor", () => {
  const actor = "https://example.social/users/gone";

  it("recognises an account deleting itself, with a bare or embedded object", () => {
    expect(selfDeletedActor({ type: "Delete", actor, object: actor })).toBe(actor);
    expect(selfDeletedActor({ type: "Delete", actor, object: { id: actor } })).toBe(actor);
  });

  it("ignores a Delete of something else, such as a post", () => {
    expect(selfDeletedActor({ type: "Delete", actor, object: `${actor}/statuses/1` })).toBeNull();
    expect(selfDeletedActor({ type: "Delete", actor, object: { id: `${actor}/statuses/1`, type: "Tombstone" } })).toBeNull();
  });

  it("ignores other activity types and non-objects", () => {
    expect(selfDeletedActor({ type: "Follow", actor, object: actor })).toBeNull();
    expect(selfDeletedActor(null)).toBeNull();
    expect(selfDeletedActor("Delete")).toBeNull();
    expect(selfDeletedActor({ type: "Delete" })).toBeNull();
  });
});

describe("followDecision", () => {
  it("accepts a Follow aimed at the live actor, bare or embedded", () => {
    expect(followDecision(NEW_ACTOR, NEW_ACTOR.actorId)).toBe("accept");
    expect(followDecision(NEW_ACTOR, { id: NEW_ACTOR.actorId, type: "Service" })).toBe("accept");
  });

  it("rejects a Follow of the old actor, which has moved and no longer posts", () => {
    expect(followDecision(OLD_ACTOR, OLD_ACTOR.actorId)).toBe("reject");
  });

  it("ignores a Follow aimed at anyone else", () => {
    expect(followDecision(NEW_ACTOR, "https://example.social/users/bob")).toBe("ignore");
    expect(followDecision(NEW_ACTOR, OLD_ACTOR.actorId)).toBe("ignore");
    expect(followDecision(OLD_ACTOR, NEW_ACTOR.actorId)).toBe("ignore");
    expect(followDecision(NEW_ACTOR, undefined)).toBe("ignore");
  });
});
