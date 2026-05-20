const DOMAIN = 'canyoubeatwellington.radomski.co.nz';
const SUBJECT = `acct:CanYouBeat@${DOMAIN}`;
const ACTOR_URL = `https://${DOMAIN}/actor`;

export default function handler(req, res) {
  const resource = req.query?.resource;

  if (resource !== SUBJECT) {
    res.status(404).json({ error: 'Resource not found' });
    return;
  }

  res.setHeader('Content-Type', 'application/jrd+json');
  res.status(200).json({
    subject: SUBJECT,
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: ACTOR_URL,
      },
    ],
  });
}
