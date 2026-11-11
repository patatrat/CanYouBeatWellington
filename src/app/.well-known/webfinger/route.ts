import { NextRequest, NextResponse } from 'next/server';
import { actorForWebfingerDomain, OLD_ACTOR, NEW_ACTOR, type ActorIdentity } from '@/lib/ap-identity';

// Exported for unit testing — usernames in an acct: URI aren't guaranteed to
// arrive in any particular case (someone searching "@canyoubeat@..." rather
// than "@CanYouBeat@..." is a normal lookup, not malformed input), so
// matching must be case-insensitive or real searches 404. Some software
// looks an account up by its URL instead of its handle, so an actor's id or
// profile URL resolves too.
export function resolveWebfingerResource(resource: string | null): ActorIdentity | null {
  if (!resource) return null;
  const match = resource.match(/^acct:CanYouBeat@(.+)$/i);
  if (match) return actorForWebfingerDomain(match[1]);

  const url = resource.replace(/\/$/, '');
  return [NEW_ACTOR, OLD_ACTOR].find((a) => url === a.actorId || url === a.base) ?? null;
}

// WebFinger is meant to be readable from any origin (RFC 7033 §5), which
// browser-based fediverse clients rely on.
const CORS = { 'Access-Control-Allow-Origin': '*' };

export function GET(req: NextRequest) {
  const resource = req.nextUrl.searchParams.get('resource');
  const actor = resolveWebfingerResource(resource);

  if (!resource || !actor) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404, headers: CORS });
  }

  return NextResponse.json(
    {
      // An acct: query is echoed exactly as asked, per the WebFinger spec —
      // not normalized to the actor's own canonical casing. A lookup by URL
      // gets the canonical handle.
      subject: /^acct:/i.test(resource) ? resource : `acct:CanYouBeat@${actor.domain}`,
      aliases: [actor.actorId, actor.base],
      links: [
        {
          rel: 'self',
          type: 'application/activity+json',
          href: actor.actorId,
        },
        {
          rel: 'http://webfinger.net/rel/profile-page',
          type: 'text/html',
          href: actor.base,
        },
      ],
    },
    { headers: { 'Content-Type': 'application/jrd+json', ...CORS } },
  );
}
