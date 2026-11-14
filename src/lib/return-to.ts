/** Request header the proxy sets with the path being requested. */
export const RETURN_TO_HEADER = "x-return-to";

/**
 * Accepts a post-sign-in destination only if it is a path on this site.
 *
 * The value arrives in a query string, so anyone can put anything in it.
 * Redirecting to whatever it says would let a link to our own sign-in
 * page deliver people to someone else's site afterwards, with our domain
 * lending it credibility. "//host" and "/\host" both look like paths and
 * are read by browsers as other origins, hence the explicit checks.
 */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  if (value.length > 512) return null;

  // Coming back to the sign-in page after signing in is a loop, and the
  // landing page is not somewhere anyone was "trying to get to".
  const path = value.split(/[?#]/)[0];
  if (path === "/" || path === "/signin" || path.startsWith("/api/")) return null;

  return value;
}

/** The sign-in URL, carrying where to come back to if there is somewhere. */
export function signInUrl(returnTo: string | null | undefined) {
  const safe = safeReturnTo(returnTo);
  return safe ? `/signin?callbackUrl=${encodeURIComponent(safe)}` : "/signin";
}
