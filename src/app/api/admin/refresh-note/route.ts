import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { isBearerAuthorized } from '@/lib/auth';
import { deliverToFollowers, NOTE_TTL_SECONDS, QUOTE_CONTEXT, QUOTABLE_BY_ANYONE } from '@/lib/ap-posting';
import { OLD_ACTOR, NEW_ACTOR } from '@/lib/ap-identity';

// Re-stamps a previously-published Note with the current interactionPolicy/
// contentMap shape (fields added after some posts already went out — see
// quote-posts and Translate-button fixes in CLAUDE.md) and sends a signed
// Update to current followers so instances that already cached the old copy
// pick up the change too. Backfilling the KV-stored object alone (what
// /notes/[id] serves) only helps someone whose instance fetches the post
// fresh; already-following instances need the Update to know to re-fetch.
// Same Bearer-token pattern as the other admin routes. `actor` defaults to
// "old" for backward compatibility; pass "new" for posts published under
// the new actor (e.g. the debut post, sent before this contentMap fix
// existed). Triggered manually, e.g.:
//
//   curl -X POST https://canyoubeatwellington.nz/api/admin/refresh-note \
//     -H "Authorization: Bearer $ADMIN_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"noteIdSuffix": "2026-08-03", "actor": "old"}'
export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'ADMIN_SECRET not configured' }, { status: 503 });
  }
  if (!isBearerAuthorized(req.headers.get('authorization'), process.env.ADMIN_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { noteIdSuffix?: unknown; actor?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { noteIdSuffix } = body;
  if (typeof noteIdSuffix !== 'string' || !noteIdSuffix) {
    return NextResponse.json({ error: 'noteIdSuffix must be a non-empty string' }, { status: 400 });
  }
  if (body.actor !== undefined && body.actor !== 'old' && body.actor !== 'new') {
    return NextResponse.json({ error: 'actor must be "old" or "new" if provided' }, { status: 400 });
  }
  const target = body.actor === 'new' ? NEW_ACTOR : OLD_ACTOR;

  const privateKeyPem = process.env[target.privateKeyEnvVar];
  if (!privateKeyPem) {
    return NextResponse.json({ error: `${target.privateKeyEnvVar} not configured` }, { status: 503 });
  }

  const stored = await kv.get<{ object: Record<string, unknown> } & Record<string, unknown>>(
    `cybw:post:${noteIdSuffix}`,
  );
  if (!stored) {
    return NextResponse.json({ error: `No stored post for noteIdSuffix "${noteIdSuffix}"` }, { status: 404 });
  }

  const now = new Date().toISOString();
  const noteId = `${target.base}/notes/${noteIdSuffix}`;
  const existingContent = (stored.object as { content?: unknown }).content;

  const refreshedNote = {
    ...stored.object,
    '@context': ['https://www.w3.org/ns/activitystreams', QUOTE_CONTEXT],
    interactionPolicy: QUOTABLE_BY_ANYONE,
    // Without this, Mastodon can't tell the post's language and offers a
    // "Translate" button regardless of what it's actually written in.
    ...(typeof existingContent === 'string' ? { contentMap: { en: existingContent } } : {}),
  };

  const refreshedActivity = {
    ...stored,
    '@context': ['https://www.w3.org/ns/activitystreams', QUOTE_CONTEXT],
    object: refreshedNote,
  };

  // Reapply the TTL — a bare kv.set with no `ex` would otherwise make the
  // key persist forever, breaking the "notes expire after a year" design.
  await kv.set(`cybw:post:${noteIdSuffix}`, refreshedActivity, { ex: NOTE_TTL_SECONDS });

  // Every note this app has ever published uses this same to/cc pair (see
  // ap-posting.ts) — using the constant directly instead of reading it back
  // off the stored/spread object sidesteps a TS inference quirk where
  // spreading a Record<string, unknown> loses its index signature.
  const updateActivity = {
    '@context': ['https://www.w3.org/ns/activitystreams', QUOTE_CONTEXT],
    id: `${noteId}/updates/${Date.now()}`,
    type: 'Update',
    actor: target.actorId,
    published: now,
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: [`${target.actorId}/followers`],
    object: refreshedNote,
  };

  const { delivered, failed, total } = await deliverToFollowers(updateActivity, privateKeyPem, target);

  return NextResponse.json({ ok: true, noteIdSuffix, actor: body.actor ?? 'old', delivered, failed, total });
}
