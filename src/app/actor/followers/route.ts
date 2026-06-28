import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const BASE = 'https://canyoubeatwellington.radomski.co.nz';

export async function GET() {
  let followers: string[] = [];
  try {
    followers = (await kv.smembers('cybw:ap:followers')) ?? [];
  } catch {
    // KV unavailable — return empty list rather than an error
  }

  return NextResponse.json(
    {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: `${BASE}/actor/followers`,
      type: 'OrderedCollection',
      totalItems: followers.length,
      orderedItems: followers,
    },
    { headers: { 'Content-Type': 'application/activity+json' } },
  );
}
