import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let activity: unknown;
  try {
    activity = await kv.get(`cybw:post:${id}`);
  } catch {
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 });
  }

  if (!activity) {
    return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  }

  return NextResponse.json(
    (activity as { object: unknown }).object,
    { headers: { 'Content-Type': 'application/activity+json' } },
  );
}
