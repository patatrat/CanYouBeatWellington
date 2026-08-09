import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { actorForHost, OLD_ACTOR } from '@/lib/ap-identity';

export async function GET(req: NextRequest) {
  const actor = actorForHost(req.headers.get('host'));

  // The new actor hasn't published anything yet — daily posting hasn't
  // moved over (deliberately not built as part of the migration groundwork,
  // see CLAUDE.md), so its outbox is always empty until that changes.
  let activities: unknown[] = [];
  if (actor === OLD_ACTOR) {
    try {
      const ids = await kv.lrange('cybw:posts', 0, -1);
      if (ids && ids.length > 0) {
        const fetched = await Promise.all(ids.map((id: string) => kv.get(`cybw:post:${id}`)));
        activities = fetched.filter(Boolean);
      }
    } catch {
      // KV unavailable — return empty outbox rather than an error
    }
  }

  return NextResponse.json(
    {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${actor.base}/actor/outbox`,
      type: 'OrderedCollection',
      totalItems: activities.length,
      orderedItems: activities,
    },
    { headers: { 'Content-Type': 'application/activity+json' } },
  );
}
