import { NextRequest, NextResponse } from 'next/server';
import { actorForWebfingerDomain, type ActorIdentity } from '@/lib/ap-identity';

// Exported for unit testing — usernames in an acct: URI aren't guaranteed to
// arrive in any particular case (someone searching "@canyoubeat@..." rather
// than "@CanYouBeat@..." is a normal lookup, not malformed input), so
// matching must be case-insensitive or real searches 404.
export function resolveWebfingerResource(resource: string | null): ActorIdentity | null {
  const match = resource?.match(/^acct:CanYouBeat@(.+)$/i);
  return match ? actorForWebfingerDomain(match[1]) : null;
}

export function GET(req: NextRequest) {
  const resource = req.nextUrl.searchParams.get('resource');
  const actor = resolveWebfingerResource(resource);

  if (!resource || !actor) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }

  return NextResponse.json(
    {
      // Echoes the resource exactly as queried, per the WebFinger spec —
      // not normalized to the actor's own canonical casing.
      subject: resource,
      links: [
        {
          rel: 'self',
          type: 'application/activity+json',
          href: actor.actorId,
        },
      ],
    },
    { headers: { 'Content-Type': 'application/jrd+json' } },
  );
}
