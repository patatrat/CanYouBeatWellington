import { kv } from '@vercel/kv';
import { verifySignature, signAndDeliver } from '../lib/http-signatures.js';

// Disable Vercel's body parser — ActivityPub uses application/activity+json
// which Vercel won't auto-parse, but disabling ensures we always get the raw stream.
export const config = { api: { bodyParser: false } };

const BASE = 'https://canyoubeatwellington.radomski.co.nz';
const ACTOR_ID = `${BASE}/actor`;
const KEY_ID = `${ACTOR_ID}#main-key`;
const FOLLOWERS_KEY = 'cybw:ap:followers';

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function sendAccept(followActivity, followerActorUrl) {
  const privateKeyPem = process.env.AP_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!privateKeyPem) throw new Error('AP_PRIVATE_KEY not configured');

  const res = await fetch(followerActorUrl, {
    headers: { Accept: 'application/activity+json' },
  });
  if (!res.ok) throw new Error(`Could not fetch follower actor (${res.status})`);
  const actor = await res.json();
  if (!actor.inbox) throw new Error(`Follower actor has no inbox: ${followerActorUrl}`);

  const accept = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${BASE}/actor/accepts/${Date.now()}`,
    type: 'Accept',
    actor: ACTOR_ID,
    object: followActivity,
  };

  await signAndDeliver(actor.inbox, accept, KEY_ID, privateKeyPem);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const rawBody = await readRawBody(req);

  try {
    await verifySignature('POST', '/actor/inbox', req.headers);
  } catch (err) {
    console.error('Inbox: signature rejected:', err.message);
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  let activity;
  try {
    activity = JSON.parse(rawBody);
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  try {
    if (activity.type === 'Follow') {
      const followerUrl = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id;
      if (followerUrl) {
        await kv.sadd(FOLLOWERS_KEY, followerUrl);
        await sendAccept(activity, followerUrl);
        console.log(`Inbox: new follower ${followerUrl}`);
      }
    } else if (activity.type === 'Undo' && activity.object?.type === 'Follow') {
      const followerUrl = typeof activity.actor === 'string' ? activity.actor : activity.actor?.id;
      if (followerUrl) {
        await kv.srem(FOLLOWERS_KEY, followerUrl);
        console.log(`Inbox: unfollowed ${followerUrl}`);
      }
    }
    // All other activity types (Delete, etc.) are silently accepted per AP spec
  } catch (err) {
    console.error('Inbox: error processing activity:', err.message);
    res.status(500).json({ error: 'Internal error' });
    return;
  }

  res.status(202).end();
}
