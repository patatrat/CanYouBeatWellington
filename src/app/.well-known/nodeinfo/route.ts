import { NextResponse } from 'next/server';
import { NEW_ACTOR } from '@/lib/ap-identity';

// Never changes between deploys, so it's built once.
export const dynamic = 'force-static';

// NodeInfo discovery: points fediverse software, crawlers and directories
// at the document describing this server (see nodeinfo/2.0/route.ts).
export function GET() {
  return NextResponse.json(
    {
      links: [
        {
          rel: 'http://nodeinfo.diaspora.software/ns/schema/2.0',
          href: `${NEW_ACTOR.base}/nodeinfo/2.0`,
        },
      ],
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } },
  );
}
