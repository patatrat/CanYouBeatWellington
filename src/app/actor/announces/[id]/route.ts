import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Serves an Announce (boost) sent by the admin boost route, so the activity
// id resolves if a receiving instance dereferences it. Lives under /actor so
// it's already AP-pinned and skipped by middleware.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let announce: unknown;
  try {
    announce = await kv.get(`cybw:announce:${id}`);
  } catch {
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 });
  }

  if (!announce) {
    return NextResponse.json({ error: 'Announce not found' }, { status: 404 });
  }

  return NextResponse.json(announce, { headers: { 'Content-Type': 'application/activity+json' } });
}
