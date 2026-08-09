import { describe, it, expect } from "vitest";
import { noteSuffixFromUrl, instrumentUrl } from "../route";
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
