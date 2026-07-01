import crypto from "node:crypto";

// Constant-time check of an Authorization header against `Bearer <secret>`.
// Fails closed: an unset secret means nothing is authorized, so a dropped
// env var can never silently open an endpoint to the internet.
export function isBearerAuthorized(
  authHeader: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !authHeader) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authHeader);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}
