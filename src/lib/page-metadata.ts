import type { Metadata } from 'next';

export const SITE_URL = 'https://canyoubeatwellington.nz';
export const SITE_NAME = 'Can You Beat Wellington?';
export const OG_IMAGE = `${SITE_URL}/canyoubeatwellington_og_image.jpg`;

interface PageMetadataInput {
  title: string;
  description: string;
  // Path from the site root, e.g. "/about". "/" for the home page.
  path: string;
}

// One page's full metadata: title, description, canonical, and matching
// Open Graph/Twitter tags. Next replaces a parent's `openGraph`/`twitter`
// object wholesale rather than merging it, so a page that set only its own
// title would otherwise keep the layout's share tags, and every page shared
// as if it were the home page (same og:title, og:url pointing at "/").
export function pageMetadata({ title, description, path }: PageMetadataInput): Metadata {
  const url = path === '/' ? SITE_URL : `${SITE_URL}${path}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
      locale: 'en_NZ',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [OG_IMAGE],
    },
  };
}
