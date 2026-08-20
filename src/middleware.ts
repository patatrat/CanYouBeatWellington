import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// The human-facing site is moving to canyoubeatwellington.nz, but the
// ActivityPub actor identity (id, webfinger, inbox/outbox/followers,
// HTTP-signature keyId) is pinned to canyoubeatwellington.radomski.co.nz —
// existing followers' servers have that exact actor URL cached, so those
// paths must keep resolving on the old domain instead of redirecting.
const OLD_DOMAIN = "canyoubeatwellington.radomski.co.nz";
// The bare apex, not www — Vercel's own domain config now redirects www to
// the apex (flipped from the reverse), so pointing straight at the apex
// skips that extra hop.
const NEW_DOMAIN = "canyoubeatwellington.nz";
const AP_PATH_PREFIXES = ["/actor", "/.well-known/webfinger", "/notes", "/quote-authorizations"];

// Pure so it's testable without constructing a NextRequest — returns the
// redirect target, or null if this request should pass through untouched.
export function getRedirectUrl(hostname: string, pathname: string, search: string): string | null {
  if (hostname !== OLD_DOMAIN) return null;
  if (AP_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }
  return `https://${NEW_DOMAIN}${pathname}${search}`;
}

export function middleware(request: NextRequest) {
  const { hostname, pathname, search } = request.nextUrl;
  const target = getRedirectUrl(hostname, pathname, search);
  return target ? NextResponse.redirect(target, 308) : NextResponse.next();
}

// Also excludes the AP-identity path prefixes themselves — getRedirectUrl()
// already never redirects these (see AP_PATH_PREFIXES above), so invoking
// the function for them was a guaranteed no-op on every single request.
// Confirmed via Vercel's own runtime logs this was the dominant source of
// edge/middleware invocations: /actor/inbox alone (mostly rejected signed
// spam, unrelated to this app) accounted for ~65% of middleware runs in a
// 24h sample, none of which could ever produce a redirect. Same
// simple-prefix style as the existing _next/static/favicon.ico exclusions
// above — safe because no real route in this app collides as a lookalike
// prefix (confirmed against src/app's actual route list; see
// middleware.test.ts for direct coverage of the compiled pattern).
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|actor|\\.well-known/webfinger|notes|quote-authorizations).*)",
  ],
};
