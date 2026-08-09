import { NextRequest, NextResponse } from 'next/server';
import {
  actorForHost,
  NEW_ACTOR,
  NEW_ACTOR_ALSO_KNOWN_AS,
  OLD_ACTOR,
  OLD_ACTOR_MOVED_TO,
} from '@/lib/ap-identity';

export function GET(req: NextRequest) {
  const actor = actorForHost(req.headers.get('host'));
  const publicKeyPem = process.env[actor.publicKeyEnvVar]?.replace(/\\n/g, '\n');
  if (!publicKeyPem) {
    return NextResponse.json({ error: 'Actor not yet configured' }, { status: 503 });
  }

  return NextResponse.json(
    {
      '@context': [
        'https://www.w3.org/ns/activitystreams',
        'https://w3id.org/security/v1',
      ],
      id: actor.actorId,
      type: 'Service',
      preferredUsername: 'CanYouBeat',
      name: 'Can You Beat Wellington?',
      summary: "Daily verdict on Wellington, NZ's weather. Follow to find out when it's too good to beat. ☀️",
      url: actor.base,
      inbox: `${actor.base}/actor/inbox`,
      outbox: `${actor.base}/actor/outbox`,
      followers: `${actor.base}/actor/followers`,
      ...(actor === NEW_ACTOR ? { alsoKnownAs: NEW_ACTOR_ALSO_KNOWN_AS } : {}),
      ...(actor === OLD_ACTOR ? { movedTo: OLD_ACTOR_MOVED_TO } : {}),
      attachment: [
        {
          type: 'PropertyValue',
          name: 'Website',
          value: `<a href="${actor.base}" rel="me nofollow noopener noreferrer" target="_blank">${actor.domain}</a>`,
        },
      ],
      icon: {
        type: 'Image',
        mediaType: 'image/png',
        url: `${actor.base}/canyoubeatwellington_avatar.png`,
      },
      image: {
        type: 'Image',
        mediaType: 'image/png',
        url: `${actor.base}/canyoubeatwellington_og_image.png`,
      },
      publicKey: {
        id: actor.keyId,
        owner: actor.actorId,
        publicKeyPem,
      },
    },
    { headers: { 'Content-Type': 'application/activity+json' } },
  );
}
