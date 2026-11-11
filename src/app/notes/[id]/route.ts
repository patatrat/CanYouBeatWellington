import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { renderNoteHtml, type NoteForPage } from '@/lib/note-html';

// One URL, two forms: the ActivityPub JSON other servers fetch, and a page
// for people. Only a request that asks for HTML (a browser) gets the page;
// anything else gets JSON as before, so no fediverse software that sends
// an unusual Accept header is ever handed HTML it can't parse.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const note = (activity as { object: unknown }).object;

  const accept = req.headers.get('accept') ?? '';
  const wantsHtml =
    accept.includes('text/html') &&
    !accept.includes('application/activity+json') &&
    !accept.includes('application/ld+json');
  const page = note as Partial<NoteForPage> | null;
  if (wantsHtml && typeof page?.id === 'string' && typeof page.content === 'string') {
    return new NextResponse(renderNoteHtml(page as NoteForPage), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', Vary: 'Accept' },
    });
  }

  return NextResponse.json(note, {
    headers: { 'Content-Type': 'application/activity+json', Vary: 'Accept' },
  });
}
