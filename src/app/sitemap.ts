import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/page-metadata';

// Just the URLs. No lastmod: Google ignores it unless it's reliably accurate,
// and the hand-written file this replaces had dates months out of date.
// changefreq/priority are ignored by Google altogether. /wrapped/[year] is
// left out on purpose until a year is released.
export default function sitemap(): MetadataRoute.Sitemap {
  return ['/', '/about', '/history', '/seasons'].map((path) => ({
    url: path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`,
  }));
}
