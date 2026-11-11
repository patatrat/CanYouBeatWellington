import { describe, it, expect } from "vitest";
import { mentionsActor, buildReplyRecord } from "../ap-interactions";
import { noteText, renderNoteHtml } from "../note-html";

const US = "https://canyoubeatwellington.nz/actor";
const AUTHOR = "https://mastodon.example/users/pat";
const NOW = new Date("2026-11-11T08:00:00Z");

describe("mentionsActor", () => {
  it("finds us in to/cc or in a Mention tag", () => {
    expect(mentionsActor({ to: [US] }, US)).toBe(true);
    expect(mentionsActor({ cc: US }, US)).toBe(true);
    expect(mentionsActor({ tag: [{ type: "Mention", href: US }] }, US)).toBe(true);
    expect(mentionsActor({ tag: { type: "Mention", href: US } }, US)).toBe(true);
  });

  it("ignores posts for other people, and hashtags", () => {
    expect(mentionsActor({ to: ["https://www.w3.org/ns/activitystreams#Public"] }, US)).toBe(false);
    expect(mentionsActor({ tag: [{ type: "Mention", href: AUTHOR }, { type: "Hashtag", href: US }] }, US)).toBe(false);
    expect(mentionsActor({}, US)).toBe(false);
  });
});

describe("buildReplyRecord", () => {
  const post = {
    id: "https://mastodon.example/users/pat/statuses/1",
    url: "https://mastodon.example/@pat/1",
    attributedTo: AUTHOR,
    inReplyTo: "https://canyoubeatwellington.nz/notes/2026-11-08",
    content: "<p>Too right</p>",
    published: "2026-11-11T07:59:00Z",
  };

  it("keeps the fields worth reading back", () => {
    expect(buildReplyRecord(post, AUTHOR, NOW)).toEqual({
      id: post.id,
      actor: AUTHOR,
      url: post.url,
      inReplyTo: post.inReplyTo,
      content: post.content,
      published: post.published,
      received: NOW.toISOString(),
    });
  });

  it("caps very long content", () => {
    expect(buildReplyRecord({ ...post, content: "x".repeat(9000) }, AUTHOR, NOW)?.content).toHaveLength(5000);
  });

  it("refuses a post by someone other than the signer, or hosted elsewhere", () => {
    expect(buildReplyRecord({ ...post, attributedTo: "https://mastodon.example/users/bob" }, AUTHOR, NOW)).toBeNull();
    expect(buildReplyRecord({ ...post, id: "https://evil.example/statuses/1" }, AUTHOR, NOW)).toBeNull();
    expect(buildReplyRecord({ ...post, id: undefined }, AUTHOR, NOW)).toBeNull();
    expect(buildReplyRecord("https://mastodon.example/users/pat/statuses/1", AUTHOR, NOW)).toBeNull();
  });
});

describe("post pages", () => {
  const content =
    "<p>You can&#39;t beat Wellington on a good day! And today is a good day!</p><p>🌡️ 19.2°C</p>" +
    '<p><a href="https://canyoubeatwellington.nz">https://canyoubeatwellington.nz</a></p>';

  it("reduces a post to plain text for link previews", () => {
    expect(noteText(content)).toBe(
      "You can't beat Wellington on a good day! And today is a good day! 🌡️ 19.2°C https://canyoubeatwellington.nz",
    );
  });

  it("renders the post, its NZ-time date and preview tags", () => {
    const html = renderNoteHtml({
      id: "https://canyoubeatwellington.nz/notes/2026-11-08",
      content,
      published: "2026-11-07T21:30:05Z",
    });
    expect(html).toContain(`<div class="content">${content}</div>`);
    expect(html).toContain("8 November 2026");
    expect(html).toContain('<meta property="og:url" content="https://canyoubeatwellington.nz/notes/2026-11-08">');
    expect(html).toContain("og:description\" content=\"You can&#39;t beat Wellington on a good day!");
    expect(html).toContain('<link rel="alternate" type="application/activity+json"');
  });

  it("escapes the id and copes with a missing date", () => {
    const html = renderNoteHtml({ id: 'https://canyoubeatwellington.nz/notes/"><script>', content: "<p>hi</p>" });
    expect(html).not.toContain('"><script>');
    expect(html).not.toContain("<time");
  });
});
