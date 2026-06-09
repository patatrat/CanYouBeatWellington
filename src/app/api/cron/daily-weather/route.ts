import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { fetchAndStoreBatch, getTodaysNZTDate } from '@/lib/weather';
import { getThresholds } from '@/utils/rulesStorage';
import { signAndDeliver } from '@/lib/http-signatures';

// Allow up to 60 s for the fan-out loop to complete.
export const maxDuration = 60;

const BASE = 'https://canyoubeatwellington.radomski.co.nz';
const ACTOR_ID = `${BASE}/actor`;
const KEY_ID = `${ACTOR_ID}#main-key`;

async function getInboxUrl(actorUrl: string): Promise<string> {
  const res = await fetch(actorUrl, { headers: { Accept: 'application/activity+json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${actorUrl}`);
  const actor = await res.json();
  if (!actor.inbox) throw new Error(`No inbox at ${actorUrl}`);
  return actor.inbox as string;
}

export async function GET(req: NextRequest) {
  // When CRON_SECRET is set in Vercel env vars, Vercel Cron automatically
  // includes it in the Authorization header. Manual test calls must too.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const today = getTodaysNZTDate();

  // Fetch 92 days from Open-Meteo and upsert to Neon.
  const { stored, todayRecord } = await fetchAndStoreBatch();

  if (!todayRecord) {
    return NextResponse.json({ ok: true, stored, fanout: 'skipped — no record for today' });
  }

  // Evaluate today's verdict against seasonal rules.
  const { minTemp, maxWind, maxRain } = getThresholds(today);
  const isGood =
    todayRecord.temperature >= minTemp &&
    todayRecord.wind_speed < maxWind &&
    todayRecord.rain <= maxRain;

  if (!isGood) {
    return NextResponse.json({
      ok: true,
      stored,
      today: { temperature: todayRecord.temperature, wind_speed: todayRecord.wind_speed, rain: todayRecord.rain },
      fanout: 'skipped — not a good day',
    });
  }

  // Good day — fan out a Create{Note} to ActivityPub followers.
  const privateKeyPem = process.env.AP_PRIVATE_KEY;
  if (!privateKeyPem) {
    return NextResponse.json({ ok: true, stored, fanout: 'skipped — AP_PRIVATE_KEY not set' });
  }

  const followers: string[] = (await kv.smembers('cybw:ap:followers')) ?? [];
  if (followers.length === 0) {
    return NextResponse.json({ ok: true, stored, fanout: 'skipped — no followers' });
  }

  const now = new Date().toISOString();
  const noteId = `${BASE}/notes/${today}`;

  const htmlContent =
    `<p>You can&#39;t beat Wellington today ☀️</p>` +
    `<p>🌡️ ${todayRecord.temperature.toFixed(1)}°C  ` +
    `💨 ${todayRecord.wind_speed.toFixed(1)} km/h  ` +
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

  // Store in KV before delivering so the note URL is resolvable when
  // remote servers fetch it to verify the activity.
  await kv.set(`cybw:post:${today}`, activity);
  await kv.lpush('cybw:posts', today);
  await kv.ltrim('cybw:posts', 0, 49);

  let delivered = 0;
  let failed = 0;

  for (const followerUrl of followers) {
    try {
      const inboxUrl = await getInboxUrl(followerUrl);
      const status = await signAndDeliver(inboxUrl, activity, KEY_ID, privateKeyPem);
      if (status >= 200 && status < 300) {
        delivered++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    stored,
    today: { temperature: todayRecord.temperature, wind_speed: todayRecord.wind_speed, rain: todayRecord.rain },
    fanout: { delivered, failed, total: followers.length },
  });
}
