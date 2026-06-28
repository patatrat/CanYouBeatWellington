import { NextRequest, NextResponse } from 'next/server';

const DOMAIN = 'canyoubeatwellington.radomski.co.nz';
const SUBJECT = `acct:CanYouBeat@${DOMAIN}`;
const ACTOR_URL = `https://${DOMAIN}/actor`;

export function GET(req: NextRequest) {
  const resource = req.nextUrl.searchParams.get('resource');

  if (resource !== SUBJECT) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }

  return NextResponse.json(
    {
      subject: SUBJECT,
      links: [
        {
          rel: 'self',
          type: 'application/activity+json',
          href: ACTOR_URL,
        },
      ],
    },
    { headers: { 'Content-Type': 'application/jrd+json' } },
  );
}
