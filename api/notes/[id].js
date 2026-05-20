import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { id } = req.query;

  let activity;
  try {
    activity = await kv.get(`cybw:post:${id}`);
  } catch {
    res.status(503).json({ error: 'Storage unavailable' });
    return;
  }

  if (!activity) {
    res.status(404).json({ error: 'Note not found' });
    return;
  }

  res.setHeader('Content-Type', 'application/activity+json');
  res.status(200).json(activity.object);
}
