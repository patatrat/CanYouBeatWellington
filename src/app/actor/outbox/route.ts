import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { actorForHost } from '@/lib/ap-identity';

// Same shape fix as actor/followers/route.ts — Mastodon's own collections
// only put items on a separate OrderedCollectionPage fetch (via `first`),
// never inline on the top-level OrderedCollection.
export async function GET(req: NextRequest) {
  const actor = actorForHost(req.headers.get('host'));
  const collectionId = `${actor.base}/actor/outbox`;

  let activities: unknown[] = [];
  try {
    const ids = await kv.lrange(actor.postsListKey, 0, -1);
    if (ids && ids.length > 0) {
      const fetched = await Promise.all(ids.map((id: string) => kv.get(`cybw:post:${id}`)));
      activities = fetched.filter(Boolean);
    }
  } catch {
    // KV unavailable — return empty rather than an error
  }

  const isPageRequest = req.nextUrl.searchParams.has('page');

  if (isPageRequest) {
    return NextResponse.json(
      {
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: `${collectionId}?page=1`,
        type: 'OrderedCollectionPage',
        totalItems: activities.length,
        partOf: collectionId,
        orderedItems: activities,
      },
      { headers: { 'Content-Type': 'application/activity+json' } },
    );
  }

  return NextResponse.json(
    {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: collectionId,
      type: 'OrderedCollection',
      totalItems: activities.length,
      first: `${collectionId}?page=1`,
    },
    { headers: { 'Content-Type': 'application/activity+json' } },
  );
}
