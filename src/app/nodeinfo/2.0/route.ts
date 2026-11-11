import { NextResponse } from 'next/server';
import packageJson from '../../../../package.json';

// Never changes between deploys, so it's built once.
export const dynamic = 'force-static';

// NodeInfo 2.0: what software this is and what it speaks. One account (the
// bot), no sign-ups. Post counts are left out: they're optional, and the
// outbox only keeps the latest 50, so any figure here would be wrong.
export function GET() {
  return NextResponse.json(
    {
      version: '2.0',
      software: { name: 'canyoubeatwellington', version: packageJson.version },
      protocols: ['activitypub'],
      services: { inbound: [], outbound: [] },
      openRegistrations: false,
      usage: { users: { total: 1, activeMonth: 1, activeHalfyear: 1 } },
      metadata: {
        nodeName: 'Can You Beat Wellington?',
        nodeDescription: "A bot that posts when Wellington's weather is good enough that you can't beat it.",
      },
    },
    {
      headers: {
        'Content-Type': 'application/json; profile="http://nodeinfo.diaspora.software/ns/schema/2.0#"',
        'Access-Control-Allow-Origin': '*',
      },
    },
  );
}
