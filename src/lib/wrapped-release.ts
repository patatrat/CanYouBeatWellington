// Release gate for /wrapped/[year]. A year's Wrapped page is a draft until
// its year is listed in WRAPPED_RELEASED_YEARS (comma-separated, e.g.
// "2026"), set in Vercel's Production env vars.
//
// Drafts render everywhere EXCEPT Vercel production: locally (`next dev`/
// `next start`) and on Vercel preview deployments (the `staging` branch),
// so they can be reviewed before release. On production an unreleased
// year 404s exactly like a URL that doesn't exist, so guessing
// /wrapped/2026 reveals nothing.
//
// Releasing = add the year to WRAPPED_RELEASED_YEARS in Production and
// redeploy (env var changes only apply to new deployments), then link it
// from the nav.
export function isWrappedReleased(year: number, env: Record<string, string | undefined> = process.env): boolean {
  return (env.WRAPPED_RELEASED_YEARS ?? "")
    .split(",")
    .map((s) => s.trim())
    .includes(String(year));
}

export function canViewWrapped(year: number, env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV !== "production" || isWrappedReleased(year, env);
}
