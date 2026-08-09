// Minimal HTML rendering for actor-URL collections (followers/following),
// content-negotiated on the same URL as the ActivityPub JSON — mirrors how
// real Mastodon instances serve the same collection endpoint as either JSON
// (for federation) or HTML (for a browser), rather than needing a second
// route. Not linked from anywhere in the site's own nav — reachable only by
// visiting the URL directly, or via another instance's own "view on the
// original profile" link.

// Mastodon/AP clients always ask explicitly for one of these; a plain
// browser's default Accept header doesn't include either, so it falls
// through to the HTML branch — matching Mastodon's own negotiation.
export function wantsActivityJson(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false;
  return acceptHeader.includes('application/activity+json') || acceptHeader.includes('application/ld+json');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Actor URLs come from remote servers (followers we didn't choose, accounts
// we did) — always https (enforced at signature-verification time for
// followers; hardcoded https for who we follow), but still escaped before
// interpolating into HTML since they're otherwise attacker-influenced text.
export function renderActorListHtml(title: string, actorUrls: string[]): string {
  const items = actorUrls
    .map((url) => `    <li><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></li>`)
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} — Can You Beat Wellington?</title>
<meta name="robots" content="noindex">
<style>
  body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; }
  li { margin-bottom: 0.4rem; word-break: break-all; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)} (${actorUrls.length})</h1>
  <ul>
${items || '    <li>None yet.</li>'}
  </ul>
</body>
</html>
`;
}
