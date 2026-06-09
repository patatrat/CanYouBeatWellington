import { NextResponse } from 'next/server';

const DOMAIN = 'canyoubeatwellington.radomski.co.nz';
const BASE = `https://${DOMAIN}`;

export function GET() {
  const publicKeyPem = process.env.AP_PUBLIC_KEY?.replace(/\\n/g, '\n');
  if (!publicKeyPem) {
    return NextResponse.json({ error: 'Actor not yet configured' }, { status: 503 });
  }

  return NextResponse.json(
    {
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
      attachment: [
        {
          type: 'PropertyValue',
          name: 'Website',
          value: `<a href="${BASE}" rel="me nofollow noopener noreferrer" target="_blank">canyoubeatwellington.radomski.co.nz</a>`,
        },
      ],
      icon: {
        type: 'Image',
        mediaType: 'image/png',
        url: `${BASE}/canyoubeatwellington_avatar.png`,
      },
      image: {
        type: 'Image',
        mediaType: 'image/png',
        url: `${BASE}/canyoubeatwellington_og_image.png`,
      },
      publicKey: {
        id: `${BASE}/actor#main-key`,
        owner: `${BASE}/actor`,
        publicKeyPem,
      },
    },
    { headers: { 'Content-Type': 'application/activity+json' } },
  );
}
