import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Serves a FEP-044f QuoteAuthorization minted in src/app/actor/inbox/route.ts
// — other instances dereference this at any point after a quote is approved
// to independently re-verify it's still authentic. Stored with no TTL
// (unlike notes/[id], which expires after a year), so this always reflects
// what's in KV rather than 404ing once an authorization "ages out."
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let authorization: unknown;
  try {
    authorization = await kv.get(`cybw:quote-auth:${id}`);
  } catch {
    return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 });
  }

  if (!authorization) {
    return NextResponse.json({ error: 'Quote authorization not found' }, { status: 404 });
  }

  return NextResponse.json(authorization, { headers: { 'Content-Type': 'application/activity+json' } });
}
