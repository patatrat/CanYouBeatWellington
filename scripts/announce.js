/**
 * Send a one-off announcement Note to all current ActivityPub followers.
 * Triggered via the GitHub Actions "announce" workflow (workflow_dispatch).
 *
 * The NOTE_CONTENT env var supplies the message text (plain text; the script
 * wraps it in minimal HTML for ActivityPub). If unset, the script exits without
 * posting. TARGET_ACTOR selects which actor posts: "old" or "new" (default).
 *
 * Run locally with:
 *   NOTE_CONTENT="..." TARGET_ACTOR=old node --env-file=.env.local scripts/announce.js
 */

import { kv } from '@vercel/kv';
import { signAndDeliver } from '../src/lib/http-signatures.ts';
import { OLD_ACTOR, NEW_ACTOR } from '../src/lib/ap-identity.ts';

// Defaults to the new actor — daily posting (ap-posting.ts) still targets
// the old actor separately either way, unchanged, until that's a
// deliberate later decision (see CLAUDE.md's migration backlog). TARGET_ACTOR
// exists for the one-off exception: a heads-up post on the old actor
// announcing the move, before the Move activity itself goes out.
const TARGET = process.env.TARGET_ACTOR === 'old' ? OLD_ACTOR : NEW_ACTOR;
const BASE = TARGET.base;
const ACTOR_ID = TARGET.actorId;
const KEY_ID = TARGET.keyId;
// The Note's `url` (human-facing "view on the web" link) — unlike the
// actor/note id above, this isn't part of the AP-pinned identity, so it
// points at the new domain. See src/lib/ap-posting.ts for the same split.
const SITE_URL = 'https://canyoubeatwellington.nz';

// FEP-044f quote-post context terms — kept in sync with src/lib/ap-posting.ts
// (see the comment there for why these exact values, copied from a live
// Mastodon post's own JSON rather than third-party docs).
const QUOTE_CONTEXT = {
  gts: 'https://gotosocial.org/ns#',
  interactionPolicy: { '@id': 'gts:interactionPolicy', '@type': '@id' },
  canQuote: { '@id': 'gts:canQuote', '@type': '@id' },
  automaticApproval: { '@id': 'gts:automaticApproval', '@type': '@id' },
};
// automaticApproval is a bare string, not an array — see ap-posting.ts.
const QUOTABLE_BY_ANYONE = {
  canQuote: { automaticApproval: 'https://www.w3.org/ns/activitystreams#Public' },
};

const AP_PRIVATE_KEY = process.env[TARGET.privateKeyEnvVar]?.replace(/\\n/g, '\n');
// GitHub Actions workflow_dispatch inputs are single-line, so the user types
// \n where they want line breaks. Convert those to actual newlines here.
const NOTE_CONTENT = process.env.NOTE_CONTENT?.replace(/\\n/g, '\n');

if (!AP_PRIVATE_KEY) {
  console.error(`❌ Missing ${TARGET.privateKeyEnvVar}`);
  process.exit(1);
}
if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  console.error('❌ Missing KV_REST_API_URL / KV_REST_API_TOKEN');
  process.exit(1);
}
if (!NOTE_CONTENT) {
  console.error('❌ Missing NOTE_CONTENT — set it as an env var');
  process.exit(1);
}

async function getInboxUrl(actorUrl) {
  const res = await fetch(actorUrl, {
    headers: { Accept: 'application/activity+json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${actorUrl}`);
  const actor = await res.json();
  if (!actor.inbox) throw new Error(`No inbox at ${actorUrl}`);
  return actor.inbox;
}

// Wraps bare mentions of our own domains in a real link — but only once
// escaping has already happened, and only when NOT immediately preceded by
// "@" (an acct handle like canyoubeat@canyoubeatwellington.nz, not a URL —
// linkifying just the domain half of that would look broken).
const OWN_DOMAINS = [OLD_ACTOR.domain, NEW_ACTOR.domain];
function linkifyOwnDomains(escapedText) {
  let result = escapedText;
  for (const domain of OWN_DOMAINS) {
    const pattern = new RegExp(`(?<!@)\\b${domain.replace(/\./g, '\\.')}\\b`, 'g');
    result = result.replace(
      pattern,
      `<a href="https://${domain}" rel="noopener noreferrer" target="_blank">${domain}</a>`,
    );
  }
  return result;
}

// Convert plain text to minimal ActivityPub HTML.
// Double newlines become paragraph breaks; single newlines become <br>.
// Escaping must happen before the <br>/link substitutions, not after —
// otherwise the real markup those insert gets re-escaped into literal
// "&lt;br&gt;" text instead of rendering.
function toHtml(text) {
  return text
    .split(/\n\n+/)
    .map(para => {
      const escaped = para
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
      return `<p>${linkifyOwnDomains(escaped)}</p>`;
    })
    .join('');
}

const main = async () => {
  const followers = await kv.smembers(TARGET.followersKey);
  if (!followers || followers.length === 0) {
    console.log('No followers yet — nothing to deliver.');
    return;
  }
  console.log(`Announcing to ${followers.length} follower(s):`);
  console.log(`\n${NOTE_CONTENT}\n`);

  const now = new Date().toISOString();
  const kvId = `announce-${Date.now()}`;
  const noteId = `${BASE}/notes/${kvId}`;

  const note = {
    '@context': ['https://www.w3.org/ns/activitystreams', QUOTE_CONTEXT],
    id: noteId,
    type: 'Note',
    attributedTo: ACTOR_ID,
    content: toHtml(NOTE_CONTENT),
    published: now,
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: [`${ACTOR_ID}/followers`],
    url: SITE_URL,
    interactionPolicy: QUOTABLE_BY_ANYONE,
  };

  const activity = {
    '@context': ['https://www.w3.org/ns/activitystreams', QUOTE_CONTEXT],
    id: `${noteId}/activity`,
    type: 'Create',
    actor: ACTOR_ID,
    published: now,
    to: note.to,
    cc: note.cc,
    object: note,
  };

  // Store before delivery so the note ID URL is resolvable when Mastodon fetches it
  await kv.set(`cybw:post:${kvId}`, activity);
  await kv.lpush(TARGET.postsListKey, kvId);
  await kv.ltrim(TARGET.postsListKey, 0, 49);

  let delivered = 0;
  let failed = 0;

  for (const followerUrl of followers) {
    try {
      const inboxUrl = await getInboxUrl(followerUrl);
      const status = await signAndDeliver(inboxUrl, activity, KEY_ID, AP_PRIVATE_KEY);
      if (status >= 200 && status < 300) {
        console.log(`  ✓ ${followerUrl} [${status}]`);
        delivered++;
      } else {
        console.warn(`  ✗ ${followerUrl} [${status}]`);
        failed++;
      }
    } catch (err) {
      console.warn(`  ✗ ${followerUrl}: ${err.message}`);
      failed++;
    }
  }

  console.log(
    `\n✅ ${delivered}/${followers.length} delivered${failed ? `, ${failed} failed` : ''}.`
  );
};

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});
