// The human-readable page for one of our posts, served at the same URL as
// its ActivityPub JSON (see notes/[id]/route.ts) — what "open original
// page" on Mastodon, or a pasted link, lands on.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Plain text of a post's HTML, for link-preview descriptions. Exported for
// unit testing.
export function noteText(html: string): string {
  return html
    .replace(/<\/p>\s*<p>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface NoteForPage {
  id: string;
  content: string;
  published?: string;
}

const SITE = 'https://canyoubeatwellington.nz';

// `content` is the post's own HTML. It's written by this app (and anything
// from outside, like warning text, is escaped when the post is built), so
// it's inserted as-is; everything else is escaped.
export function renderNoteHtml(note: NoteForPage): string {
  const text = noteText(note.content);
  const description = text.length > 200 ? `${text.slice(0, 197)}…` : text;
  const date = note.published ? new Date(note.published) : null;
  const when =
    date && !Number.isNaN(date.getTime())
      ? new Intl.DateTimeFormat('en-NZ', {
          timeZone: 'Pacific/Auckland',
          dateStyle: 'long',
          timeStyle: 'short',
        }).format(date)
      : '';
  const title = 'Can You Beat Wellington?';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(description || title)} — ${title}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(note.id)}">
<link rel="alternate" type="application/activity+json" href="${escapeHtml(note.id)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${title}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(note.id)}">
<meta property="og:image" content="${SITE}/canyoubeatwellington_og_image.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="fediverse:creator" content="@CanYouBeat@canyoubeatwellington.nz">
<style>
  :root { color-scheme: light dark; --bg: #f8fafc; --card: #fff; --text: #0f172a; --muted: #64748b; --line: #e2e8f0; --link: #0369a1; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0b1220; --card: #111a2e; --text: #e2e8f0; --muted: #94a3b8; --line: #1e293b; --link: #7dd3fc; } }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; line-height: 1.5; }
  main { max-width: 36rem; margin: 0 auto; padding: 2rem 1rem; }
  article { background: var(--card); border: 1px solid var(--line); border-radius: 0.75rem; padding: 1.25rem; overflow-wrap: anywhere; }
  header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
  header img { width: 3rem; height: 3rem; border-radius: 0.5rem; }
  header strong { display: block; }
  header span, time, footer { color: var(--muted); font-size: 0.875rem; }
  .content { font-size: 1.125rem; }
  .content p { margin: 0 0 0.75rem; }
  a { color: var(--link); }
  footer { margin-top: 1.25rem; text-align: center; }
</style>
</head>
<body>
<main>
  <article>
    <header>
      <img src="${SITE}/canyoubeatwellington_avatar.png" alt="">
      <div><strong>${title}</strong><span>@CanYouBeat@canyoubeatwellington.nz</span></div>
    </header>
    <div class="content">${note.content}</div>
    ${when ? `<time datetime="${escapeHtml(note.published ?? '')}">${escapeHtml(when)}</time>` : ''}
  </article>
  <footer><a href="${SITE}">Can you beat Wellington today?</a></footer>
</main>
</body>
</html>
`;
}
