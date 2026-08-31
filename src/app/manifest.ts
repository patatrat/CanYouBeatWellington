import type { MetadataRoute } from "next";

// Next.js auto-generates /manifest.webmanifest from this file and injects
// the <link rel="manifest"> tag on every page — no manual wiring needed.
// No service worker/offline caching: this site's whole point is showing
// live weather data, so there's nothing useful to cache for offline use,
// and a service worker would only add cache-invalidation/stale-data risk
// for no real benefit here.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Can You Beat Wellington?",
    short_name: "Can You Beat Wellington",
    description: "Daily verdict on the weather in Wellington, New Zealand.",
    start_url: "/",
    display: "standalone",
    background_color: "#fffbeb",
    theme_color: "#2563eb",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
