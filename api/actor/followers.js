import { kv } from '@vercel/kv';

const BASE = 'https://canyoubeatwellington.radomski.co.nz';

export default async function handler(req, res) {
  let followers = [];
  try {
    followers = (await kv.smembers('cybw:ap:followers')) ?? [];
  } catch {
    // KV unavailable — return empty list rather than an error
  }

  res.setHeader('Content-Type', 'application/activity+json');
  res.status(200).json({
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${BASE}/actor/followers`,
    type: 'OrderedCollection',
    totalItems: followers.length,
    orderedItems: followers,
  });
}
