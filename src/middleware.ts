import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// The human-facing site is moving to canyoubeatwellington.nz, but the
// ActivityPub actor identity (id, webfinger, inbox/outbox/followers,
// HTTP-signature keyId) is pinned to canyoubeatwellington.radomski.co.nz —
// existing followers' servers have that exact actor URL cached, so those
// paths must keep resolving on the old domain instead of redirecting.
const OLD_DOMAIN = "canyoubeatwellington.radomski.co.nz";
const NEW_DOMAIN = "canyoubeatwellington.nz";
const AP_PATH_PREFIXES = ["/actor", "/.well-known/webfinger", "/notes"];

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

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
