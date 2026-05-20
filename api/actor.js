const DOMAIN = 'canyoubeatwellington.radomski.co.nz';
const BASE = `https://${DOMAIN}`;

export default function handler(req, res) {
  const publicKeyPem = process.env.AP_PUBLIC_KEY?.replace(/\\n/g, '\n');
  if (!publicKeyPem) {
    res.status(503).json({ error: 'Actor not yet configured' });
    return;
  }

  res.setHeader('Content-Type', 'application/activity+json');
  res.status(200).json({
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
    ],
    id: `${BASE}/actor`,
    type: 'Service',
    preferredUsername: 'CanYouBeat',
    name: 'Can You Beat Wellington?',
    summary: "Daily verdict on Wellington, NZ's weather. Follow to find out when it's too good to beat. ☀️",
    url: BASE,
    inbox: `${BASE}/actor/inbox`,
    outbox: `${BASE}/actor/outbox`,
    followers: `${BASE}/actor/followers`,
    publicKey: {
      id: `${BASE}/actor#main-key`,
      owner: `${BASE}/actor`,
      publicKeyPem,
    },
  });
}
