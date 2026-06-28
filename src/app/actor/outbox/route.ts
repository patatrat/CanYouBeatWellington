import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const BASE = 'https://canyoubeatwellington.radomski.co.nz';

export async function GET() {
  let activities: unknown[] = [];
  try {
    const ids = await kv.lrange('cybw:posts', 0, -1);
    if (ids && ids.length > 0) {
      const fetched = await Promise.all(ids.map((id: string) => kv.get(`cybw:post:${id}`)));
      activities = fetched.filter(Boolean);
    }
  } catch {
    // KV unavailable — return empty outbox rather than an error
  }

  return NextResponse.json(
    {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${BASE}/actor/outbox`,
      type: 'OrderedCollection',
      totalItems: activities.length,
      orderedItems: activities,
    },
    { headers: { 'Content-Type': 'application/activity+json' } },
  );
}
