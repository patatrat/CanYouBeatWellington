import { describe, it, expect } from "vitest";
import { getRedirectUrl, config } from "../middleware";

const OLD = "canyoubeatwellington.radomski.co.nz";

describe("getRedirectUrl", () => {
  it("redirects ordinary pages on the old domain to the new domain", () => {
    expect(getRedirectUrl(OLD, "/", "")).toBe("https://canyoubeatwellington.nz/");
    expect(getRedirectUrl(OLD, "/about", "")).toBe("https://canyoubeatwellington.nz/about");
  });

  it("preserves the query string", () => {
    expect(getRedirectUrl(OLD, "/history", "?year=2026")).toBe(
      "https://canyoubeatwellington.nz/history?year=2026",
    );
  });

  it("leaves ActivityPub actor paths on the old domain", () => {
    expect(getRedirectUrl(OLD, "/actor", "")).toBeNull();
    expect(getRedirectUrl(OLD, "/actor/inbox", "")).toBeNull();
    expect(getRedirectUrl(OLD, "/actor/outbox", "")).toBeNull();
    expect(getRedirectUrl(OLD, "/actor/followers", "")).toBeNull();
  });

  it("leaves webfinger and notes on the old domain", () => {
    expect(getRedirectUrl(OLD, "/.well-known/webfinger", "")).toBeNull();
    expect(getRedirectUrl(OLD, "/notes/12345", "")).toBeNull();
  });

  it("leaves quote-authorizations on the old domain", () => {
    expect(getRedirectUrl(OLD, "/quote-authorizations", "")).toBeNull();
    expect(getRedirectUrl(OLD, "/quote-authorizations/abc-123", "")).toBeNull();
  });

  it("does not touch requests already on the new domain", () => {
    expect(getRedirectUrl("canyoubeatwellington.nz", "/", "")).toBeNull();
  });

  it("does not false-positive match paths that merely start with 'actor' or 'notes'", () => {
    expect(getRedirectUrl(OLD, "/actorial", "")).toBe("https://canyoubeatwellington.nz/actorial");
    expect(getRedirectUrl(OLD, "/notesomething", "")).toBe(
      "https://canyoubeatwellington.nz/notesomething",
    );
    expect(getRedirectUrl(OLD, "/quote-authorizationsomething", "")).toBe(
      "https://canyoubeatwellington.nz/quote-authorizationsomething",
    );
  });
});

// The matcher decides whether the middleware function runs at all — for the
// AP-identity paths, getRedirectUrl() above already proves the answer is
// always null, so excluding them here is a pure invocation-count reduction,
// not a behaviour change. Directly exercises the compiled pattern the app
// actually ships, anchored the way Next.js applies path matchers, rather
// than trusting the regex by inspection alone.
describe("middleware matcher", () => {
  const pattern = new RegExp(`^${config.matcher[0]}$`);

  it("excludes AP-identity paths and their sub-paths — matches getRedirectUrl's own exclusions", () => {
    for (const path of [
      "/actor",
      "/actor/inbox",
      "/actor/outbox",
      "/actor/followers",
      "/.well-known/webfinger",
      "/notes/12345",
      "/quote-authorizations/abc-123",
    ]) {
      expect(pattern.test(path)).toBe(false);
    }
  });

  it("still matches ordinary pages, so the old-domain redirect keeps working", () => {
    for (const path of ["/", "/about", "/history", "/some/other/path"]) {
      expect(pattern.test(path)).toBe(true);
    }
  });

  it("still excludes the pre-existing Next.js static-asset paths", () => {
    expect(pattern.test("/_next/static/chunk.js")).toBe(false);
    expect(pattern.test("/_next/image")).toBe(false);
    expect(pattern.test("/favicon.ico")).toBe(false);
  });
});
