import { NextRequest, NextResponse } from 'next/server';
import { actorForWebfingerDomain } from '@/lib/ap-identity';

export function GET(req: NextRequest) {
  const resource = req.nextUrl.searchParams.get('resource');
  const match = resource?.match(/^acct:CanYouBeat@(.+)$/);
  const actor = match ? actorForWebfingerDomain(match[1]) : null;

  if (!resource || !actor) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }

  return NextResponse.json(
    {
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
