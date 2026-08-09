import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { actorForHost } from '@/lib/ap-identity';

export async function GET(req: NextRequest) {
  const actor = actorForHost(req.headers.get('host'));

  let followers: string[] = [];
  try {
    followers = (await kv.smembers(actor.followersKey)) ?? [];
  } catch {
    // KV unavailable — return empty list rather than an error
  }

  return NextResponse.json(
    {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${actor.base}/actor/followers`,
      type: 'OrderedCollection',
      totalItems: followers.length,
      orderedItems: followers,
    },
    { headers: { 'Content-Type': 'application/activity+json' } },
  );
}
