import { describe, it, expect } from "vitest";
import { getRedirectUrl } from "../middleware";

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

  it("does not touch requests already on the new domain", () => {
    expect(getRedirectUrl("canyoubeatwellington.nz", "/", "")).toBeNull();
  });

  it("does not false-positive match paths that merely start with 'actor' or 'notes'", () => {
    expect(getRedirectUrl(OLD, "/actorial", "")).toBe("https://canyoubeatwellington.nz/actorial");
    expect(getRedirectUrl(OLD, "/notesomething", "")).toBe(
      "https://canyoubeatwellington.nz/notesomething",
    );
  });
});
