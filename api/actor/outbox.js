const BASE = 'https://canyoubeatwellington.radomski.co.nz';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/activity+json');
  res.status(200).json({
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${BASE}/actor/outbox`,
    type: 'OrderedCollection',
    totalItems: 0,
    orderedItems: [],
  });
}
