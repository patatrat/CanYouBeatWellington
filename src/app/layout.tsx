import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { OLD_ACTOR, NEW_ACTOR } from '@/lib/ap-identity';
import './globals.css';

const TITLE = "You Can't Beat Wellington on a Good Day — Can You Beat Wellington?";
// Deliberately apostrophe-free, unlike TITLE above — some link-unfurlers
// display the HTML-escaped &#x27; literally instead of decoding it back to
// an apostrophe, and this string is what most platforms fall back to for
// share-preview text when no explicit og:description is read correctly.
const DESCRIPTION = "Daily verdict on the weather in Wellington, New Zealand.";
// Human-facing canonical URL for Open Graph/Twitter cards — distinct from
// the rel="me" links below, which are about ActivityPub actor identity
// verification, not social-preview metadata.
const CANONICAL_URL = 'https://canyoubeatwellington.nz';
const OG_IMAGE = `${CANONICAL_URL}/canyoubeatwellington_og_image.jpg`;

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
  // iOS Safari's "Add to Home Screen" historically needs these Apple-specific
  // tags rather than reading display/name from the web manifest — apple-icon.png
  // (auto-detected by Next.js, no manual <link> needed) supplies the actual icon.
  appleWebApp: {
    capable: true,
    title: 'Beat Wellington',
    statusBarStyle: 'default',
  },
};

// themeColor moved out of `metadata` into its own export as of Next.js 14 —
// tints the browser/status-bar chrome and the PWA splash background.
export const viewport: Viewport = {
  themeColor: '#2563eb',
};

// Verifies each ActivityPub actor's own "Website" profile field (src/app/actor/route.ts,
// which links here with rel="me"), plus Pat's personal Mastodon profile field pointing at
// this site. Confirmed against Mastodon's actual source (VerifyLinkService +
// ActivityPub::TagManager#uri_for) rather than guessed: it fetches the field's href, looks
// for a reciprocal rel="me" link, and compares that link's href against
// ActivityPub::TagManager#uri_for(account) — which for a *remote* account (ours, from any
// verifying instance's point of view) returns account.uri, populated from the actor's `id`
// field, NOT its `url` field. So the two bot links below must be the actors' `actorId`
// (".../actor", matching their AP `id`) rather than their bare `base` domain — a link to the
// bare domain was the original bug, since it never matched what Mastodon actually compares
// against. Pat's own account is local to mastodon.nz, where uri_for resolves to the
// standard profile URL, so 'https://mastodon.nz/@Pat' is already correct as-is. It only
// needs to find *a* matching link, not exactly one, so listing all three unconditionally on
// every page (rather than trying to serve only the "right" one per domain, which would
// require reading the request's Host header and force the whole app off static rendering)
// covers both actors' self-referential checks and Pat's field regardless of which exact
// page or domain someone's account happens to point at. React/Next hoist <link> tags
// rendered anywhere in the tree to <head> automatically.
const REL_ME_LINKS = [OLD_ACTOR.actorId, NEW_ACTOR.actorId, 'https://mastodon.nz/@Pat'];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NZ">
      {REL_ME_LINKS.map((href) => (
        <link key={href} rel="me" href={href} />
      ))}
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
