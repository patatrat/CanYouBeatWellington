import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';

const TITLE = "You Can't Beat Wellington on a Good Day — Can You Beat Wellington?";
// Deliberately apostrophe-free, unlike TITLE above — some link-unfurlers
// display the HTML-escaped &#x27; literally instead of decoding it back to
// an apostrophe, and this string is what most platforms fall back to for
// share-preview text when no explicit og:description is read correctly.
const DESCRIPTION = "Daily verdict on the weather in Wellington, New Zealand.";
// Human-facing canonical URL for Open Graph/Twitter cards — distinct from
// AP_SITE_URL below, which stays pinned to the old domain for the
// ActivityPub actor's own identity.
const CANONICAL_URL = 'https://canyoubeatwellington.nz';
const OG_IMAGE = `${CANONICAL_URL}/canyoubeatwellington_og_image.png`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: CANONICAL_URL,
    siteName: 'Can You Beat Wellington?',
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
    locale: 'en_NZ',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

// Verifies the ActivityPub actor's own "Website" profile field (src/app/actor/route.ts,
// which links here with rel="me"). Mastodon's rel=me check fetches that field's href and
// looks for a reciprocal rel="me" link whose href equals the actor's own `url` — which is
// this same homepage, so the reciprocal link is self-referential. Not a typo: the actor
// IS the site, so the site vouching for itself (rather than a separate external page) is
// the correct shape here. React/Next hoist <link> tags rendered anywhere in the tree to
// <head> automatically.
const AP_SITE_URL = 'https://canyoubeatwellington.radomski.co.nz';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NZ">
      <link rel="me" href={AP_SITE_URL} />
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
