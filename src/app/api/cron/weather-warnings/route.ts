import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { isBearerAuthorized } from '@/lib/auth';
import { postToFollowers } from '@/lib/ap-posting';
import { getWellingtonWarnings } from '@/lib/weather-warnings';
import { recordWarnings } from '@/lib/warning-history';
import {
  planWarningPosts,
  buildWarningPostHtml,
  warningNoteSuffix,
  WARNING_HASHTAGS,
} from '@/lib/warning-posts';

export const maxDuration = 60;

// Long enough to outlast any warning and the reissues that chain back to it.
const POSTED_TTL_SECONDS = 60 * 60 * 24 * 14;
const postedKey = (id: string) => `cybw:warning-posted:${id}`;

// Posts orange and red MetService warnings for Wellington to fediverse
// followers, once each (plus once more if one is upgraded to red). Called
// every 30 minutes by .github/workflows/weather-warnings.yml rather than
// Vercel Cron, which only runs daily on the Hobby plan. Same CRON_SECRET
// bearer auth as the daily cron.
export async function GET(req: NextRequest) {
  if (!isBearerAuthorized(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const warnings = await getWellingtonWarnings(new Date(), { fresh: true });
  const ids = [...new Set(warnings.flatMap((w) => [w.id, ...w.references]))];
  const colours = ids.length ? await kv.mget<(string | null)[]>(...ids.map(postedKey)) : [];
  const posted = Object.fromEntries(ids.flatMap((id, i) => (colours[i] ? [[id, colours[i]]] : [])));

  // Keep the History calendar's record. A failure here mustn't stop the
  // posting below.
  let recorded: number | string;
  try {
    recorded = await recordWarnings(warnings);
  } catch (err) {
    console.error('Recording warnings failed:', err);
    recorded = `failed: ${(err as Error).message}`;
  }

  const plan = planWarningPosts(warnings, posted);

  for (const warning of plan.record) {
    await kv.set(postedKey(warning.id), warning.colourName, { ex: POSTED_TTL_SECONDS });
  }

  const results = [];
  for (const { warning, kind } of plan.post) {
    // Claim the warning first, so two overlapping runs can't both post it.
    const claimed = await kv.set(postedKey(warning.id), warning.colourName, { ex: POSTED_TTL_SECONDS, nx: true });
    if (!claimed) continue;

    const result = await postToFollowers(
      buildWarningPostHtml(warning, kind),
      warningNoteSuffix(warning),
      WARNING_HASHTAGS,
    );
    // Release the claim on failure so the next run retries it. "No
    // followers" isn't a failure worth retrying.
    if (!result.posted && result.reason !== 'no followers') {
      await kv.del(postedKey(warning.id));
    }
    results.push({ headline: warning.headline, kind, ...result });
  }

  return NextResponse.json({
    ok: true,
    warnings: warnings.map((w) => w.headline),
    posted: results,
    reissues: plan.record.map((w) => w.headline),
    recorded,
  });
}
