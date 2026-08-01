import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';

export const metadata: Metadata = {
  title: "You Can't Beat Wellington on a Good Day — Can You Beat Wellington?",
  description: "Daily verdict on Wellington, NZ's weather.",
};

// Verifies the ActivityPub actor's own "Website" profile field (src/app/actor/route.ts,
// which links here with rel="me"). Mastodon's rel=me check fetches that field's href and
// looks for a reciprocal rel="me" link whose href equals the actor's own `url` — which is
// this same homepage, so the reciprocal link is self-referential. Not a typo: the actor
// IS the site, so the site vouching for itself (rather than a separate external page) is
// the correct shape here. React/Next hoist <link> tags rendered anywhere in the tree to
// <head> automatically.
const SITE_URL = 'https://canyoubeatwellington.radomski.co.nz';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NZ">
      <link rel="me" href={SITE_URL} />
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
