import { NextRequest, NextResponse } from 'next/server';
import { isBearerAuthorized } from '@/lib/auth';
import { deliverToFollowers } from '@/lib/ap-posting';
import { OLD_ACTOR, NEW_ACTOR, buildActorDocument } from '@/lib/ap-identity';

// Sends a signed Update{Actor} to current followers — the AP mechanism for
// "my profile changed, please refresh your cached copy." Mastodon only
// re-checks a remote account's data (including rel=me link verification)
// when something triggers a genuine resolve; ordinary page views of an
// already-cached profile don't (confirmed against Mastodon's own source —
// ResolveAccountService.possibly_stale?/1-day threshold gates a refetch,
// and UpdateAccountService — which applies the new data and unconditionally
// re-runs VerifyAccountLinksWorker, no Person-only gating — is what a
// receiving instance runs against an incoming Update{Actor}). This exists
// to force that refresh on followers directly rather than waiting on an
// incidental trigger; it can't reach non-follower instances that have only
// ever viewed the profile without following; those need someone on that
// specific instance to search the handle again. Same Bearer-token pattern
// as the other admin routes. Triggered manually, e.g.:
//
//   curl -X POST https://canyoubeatwellington.nz/api/admin/refresh-actor \
//     -H "Authorization: Bearer $ADMIN_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"actor": "new"}'
export async function POST(req: NextRequest) {
  if (!process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'ADMIN_SECRET not configured' }, { status: 503 });
  }
  if (!isBearerAuthorized(req.headers.get('authorization'), process.env.ADMIN_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { actor?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.actor !== 'old' && body.actor !== 'new') {
    return NextResponse.json({ error: 'actor must be "old" or "new"' }, { status: 400 });
  }
  const target = body.actor === 'new' ? NEW_ACTOR : OLD_ACTOR;

  const privateKeyPem = process.env[target.privateKeyEnvVar];
  if (!privateKeyPem) {
    return NextResponse.json({ error: `${target.privateKeyEnvVar} not configured` }, { status: 503 });
  }

  const document = buildActorDocument(target);
  if (!document) {
    return NextResponse.json({ error: `${target.publicKeyEnvVar} not configured` }, { status: 503 });
  }

  const updateActivity = {
    '@context': ['https://www.w3.org/ns/activitystreams', 'https://w3id.org/security/v1'],
    id: `${target.actorId}/updates/${Date.now()}`,
    type: 'Update',
    actor: target.actorId,
    published: new Date().toISOString(),
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: [`${target.actorId}/followers`],
    object: document,
  };

  const { delivered, failed, total } = await deliverToFollowers(updateActivity, privateKeyPem, target);

  return NextResponse.json({ ok: true, actor: body.actor, delivered, failed, total });
}
