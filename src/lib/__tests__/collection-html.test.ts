import { describe, it, expect } from "vitest";
import { wantsActivityJson, renderActorListHtml } from "../collection-html";

describe("wantsActivityJson", () => {
  it("returns true for AP-flavoured Accept headers", () => {
    expect(wantsActivityJson("application/activity+json")).toBe(true);
    expect(wantsActivityJson('application/ld+json; profile="https://www.w3.org/ns/activitystreams"')).toBe(true);
  });

  it("returns false for a browser's Accept header or a missing one", () => {
    expect(wantsActivityJson("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")).toBe(false);
    expect(wantsActivityJson(null)).toBe(false);
  });
});

describe("renderActorListHtml", () => {
  it("lists each actor URL as a link and includes the count", () => {
    const html = renderActorListHtml("Followers", [
      "https://mastodon.nz/users/Pat",
      "https://mastodon.social/users/archaelus",
    ]);
    expect(html).toContain("Followers (2)");
    expect(html).toContain('<a href="https://mastodon.nz/users/Pat">https://mastodon.nz/users/Pat</a>');
    expect(html).toContain(
      '<a href="https://mastodon.social/users/archaelus">https://mastodon.social/users/archaelus</a>',
    );
  });

  it("renders a placeholder when the list is empty", () => {
    const html = renderActorListHtml("Following", []);
    expect(html).toContain("Following (0)");
    expect(html).toContain("None yet.");
  });

  it("escapes HTML-significant characters in actor URLs so they can't break out of the markup", () => {
    const html = renderActorListHtml("Followers", ['https://evil.example/"><script>alert(1)</script>']);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
