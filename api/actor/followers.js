import { kv } from '@vercel/kv';

const BASE = 'https://canyoubeatwellington.radomski.co.nz';

export default async function handler(req, res) {
  let count = 0;
  try {
    count = (await kv.scard('cybw:ap:followers')) ?? 0;
  } catch {
    // KV unavailable — return 0 rather than an error
  }

  res.setHeader('Content-Type', 'application/activity+json');
  res.status(200).json({
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${BASE}/actor/followers`,
    type: 'OrderedCollection',
    totalItems: count,
    orderedItems: [],
  });
}
