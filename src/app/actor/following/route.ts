import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { actorForHost } from '@/lib/ap-identity';

// Accounts this actor follows (not to be confused with actor/followers,
// which is the reverse). Same paginated shape as followers/outbox — see
// the comment there for why a flat top-level collection doesn't work with
// Mastodon's own rendering.
export async function GET(req: NextRequest) {
  const actor = actorForHost(req.headers.get('host'));
  const collectionId = `${actor.base}/actor/following`;

  let following: string[] = [];
  try {
    following = (await kv.smembers(actor.followingKey)) ?? [];
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
        totalItems: following.length,
        partOf: collectionId,
        orderedItems: following,
      },
      { headers: { 'Content-Type': 'application/activity+json' } },
    );
  }

  return NextResponse.json(
    {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: collectionId,
      type: 'OrderedCollection',
      totalItems: following.length,
      first: `${collectionId}?page=1`,
    },
    { headers: { 'Content-Type': 'application/activity+json' } },
  );
}
