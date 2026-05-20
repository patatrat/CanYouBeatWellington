import { kv } from '@vercel/kv';

const BASE = 'https://canyoubeatwellington.radomski.co.nz';

export default async function handler(req, res) {
  let activities = [];
  try {
    const ids = await kv.lrange('cybw:posts', 0, -1);
    if (ids && ids.length > 0) {
      const fetched = await Promise.all(ids.map(id => kv.get(`cybw:post:${id}`)));
      activities = fetched.filter(Boolean);
    }
  } catch {
    // KV unavailable — return empty outbox rather than an error
  }

  res.setHeader('Content-Type', 'application/activity+json');
  res.status(200).json({
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${BASE}/actor/outbox`,
    type: 'OrderedCollection',
    totalItems: activities.length,
    orderedItems: activities,
  });
}
