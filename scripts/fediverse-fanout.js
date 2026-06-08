/**
 * Fan out a Create{Note} to all ActivityPub followers if today is a good Wellington day.
 * Reads today's weather from Supabase, evaluates the seasonal rules, and delivers
 * a signed activity to every follower inbox.
 *
 * Run with:
 *   node --env-file=.env.local scripts/fediverse-fanout.js
 */

import { createClient } from '@supabase/supabase-js';
import { kv } from '@vercel/kv';
import { getThresholds } from '../src/utils/rulesStorage.js';
import { signAndDeliver } from '../api/lib/http-signatures.js';

const BASE = 'https://canyoubeatwellington.radomski.co.nz';
const ACTOR_ID = `${BASE}/actor`;
const KEY_ID = `${ACTOR_ID}#main-key`;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const AP_PRIVATE_KEY = process.env.AP_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase env vars');
  process.exit(1);
}
if (!AP_PRIVATE_KEY) {
  console.error('❌ Missing AP_PRIVATE_KEY');
  process.exit(1);
}
if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  console.error('❌ Missing KV_REST_API_URL / KV_REST_API_TOKEN');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getInboxUrl(actorUrl) {
  const res = await fetch(actorUrl, {
    headers: { Accept: 'application/activity+json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${actorUrl}`);
  const actor = await res.json();
  if (!actor.inbox) throw new Error(`No inbox field at ${actorUrl}`);
  return actor.inbox;
}

const main = async () => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Auckland' });
  console.log(`Fediverse fan-out check for ${today}`);

  const { data: record, error } = await supabase
    .from('daily_weather_records')
    .select('*')
    .eq('date', today)
    .maybeSingle();

  if (error) throw new Error(`Supabase error: ${JSON.stringify(error)}`);
  if (!record) {
    console.log('No weather record for today yet — skipping.');
    return;
  }

  const { minTemp, maxWind, maxRain } = getThresholds(today);
  const isGood =
    record.temperature >= minTemp &&
    record.wind_speed < maxWind &&
    record.rain <= maxRain;

  if (!isGood) {
    console.log(
      `Not a good day (${record.temperature}°C, ${record.wind_speed} km/h, ${record.rain} mm rain) — no post.`
    );
    return;
  }

  console.log(
    `Good day! ${record.temperature}°C, ${record.wind_speed} km/h, ${record.rain} mm`
  );

  const followers = await kv.smembers('cybw:ap:followers');
  if (!followers || followers.length === 0) {
    console.log('No followers yet — nothing to deliver.');
    return;
  }
  console.log(`Delivering to ${followers.length} follower(s)…`);

  const now = new Date().toISOString();
  const noteId = `${BASE}/notes/${today}`;

  const htmlContent =
    `<p>You can&#39;t beat Wellington today ☀️</p>` +
    `<p>🌡️ ${record.temperature.toFixed(1)}°C  ` +
    `💨 ${record.wind_speed.toFixed(1)} km/h  ` +
    `🌧️ 0 mm rain</p>` +
    `<p><a href="${BASE}">${BASE}</a></p>`;

  const note = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: noteId,
    type: 'Note',
    attributedTo: ACTOR_ID,
    content: htmlContent,
    published: now,
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: [`${ACTOR_ID}/followers`],
    url: BASE,
  };

  const activity = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${noteId}/activity`,
    type: 'Create',
    actor: ACTOR_ID,
    published: now,
    to: note.to,
    cc: note.cc,
    object: note,
  };

  // Store before delivery so the note ID URL is resolvable when Mastodon fetches it
  const kvId = today;
  await kv.set(`cybw:post:${kvId}`, activity);
  await kv.lpush('cybw:posts', kvId);
  await kv.ltrim('cybw:posts', 0, 49); // keep last 50 posts

  let delivered = 0;
  let failed = 0;

  for (const followerUrl of followers) {
    try {
      const inboxUrl = await getInboxUrl(followerUrl);
      const status = await signAndDeliver(inboxUrl, activity, KEY_ID, AP_PRIVATE_KEY);
      if (status >= 200 && status < 300) {
        console.log(`  ✓ ${followerUrl} [${status}]`);
        delivered++;
      } else {
        console.warn(`  ✗ ${followerUrl} [${status}]`);
        failed++;
      }
    } catch (err) {
      console.warn(`  ✗ ${followerUrl}: ${err.message}`);
      failed++;
    }
  }

  console.log(
    `\n✅ ${delivered}/${followers.length} delivered${failed ? `, ${failed} failed` : ''}.`
  );
};

main().catch(err => {
  console.error('\n❌ Fatal:', err.message);
  process.exit(1);
});
