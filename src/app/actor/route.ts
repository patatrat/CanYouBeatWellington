import { NextRequest, NextResponse } from 'next/server';
import { actorForHost, buildActorDocument } from '@/lib/ap-identity';

export function GET(req: NextRequest) {
  const actor = actorForHost(req.headers.get('host'));
  const document = buildActorDocument(actor);
  if (!document) {
    return NextResponse.json({ error: 'Actor not yet configured' }, { status: 503 });
  }

  return NextResponse.json(document, { headers: { 'Content-Type': 'application/activity+json' } });
}
