import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { actorForHost } from '@/lib/ap-identity';
import { wantsActivityJson, renderActorListHtml } from '@/lib/collection-html';

// Shaped to match what Mastodon's own followers collection actually looks
// like (confirmed against a live example) — the top-level OrderedCollection
// only has totalItems + a `first` page link, never the items themselves;
// those live on a separate OrderedCollectionPage fetch. Mastodon's web UI
// shows "This user has chosen to not make this information available" when
// it can't parse a followers collection into that shape, which is what
// inlining orderedItems directly on the top-level Collection (the previous
// version here) actually produced — nothing was ever private, the shape
// just wasn't one Mastodon's client-side rendering recognized.
//
// A remote instance's own web UI still can't show the *full* list for a
// remote account like ours regardless of shape (it only ever renders
// relationships that instance has locally observed) — real Mastodon works
// around this for humans by content-negotiating the same URL into an HTML
// page for browsers, linked to as "browse on the original profile"; this
// does the same, for the same reason: letting a human (not just another
// server) actually browse who follows this actor.
export async function GET(req: NextRequest) {
  const actor = actorForHost(req.headers.get('host'));
  const collectionId = `${actor.base}/actor/followers`;

  let followers: string[] = [];
  try {
    followers = (await kv.smembers(actor.followersKey)) ?? [];
  } catch {
    // KV unavailable — return empty rather than an error
  }

  if (!wantsActivityJson(req.headers.get('accept'))) {
    return new NextResponse(renderActorListHtml('Followers', followers), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const isPageRequest = req.nextUrl.searchParams.has('page');

  if (isPageRequest) {
    return NextResponse.json(
      {
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: `${collectionId}?page=1`,
        type: 'OrderedCollectionPage',
        totalItems: followers.length,
        partOf: collectionId,
        orderedItems: followers,
      },
      { headers: { 'Content-Type': 'application/activity+json' } },
    );
  }

  return NextResponse.json(
    {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: collectionId,
      type: 'OrderedCollection',
      totalItems: followers.length,
      first: `${collectionId}?page=1`,
    },
    { headers: { 'Content-Type': 'application/activity+json' } },
  );
}
