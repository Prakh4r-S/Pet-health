import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { RETURN_TO_HEADER } from "@/lib/return-to";

/**
 * Tells the page which path was asked for.
 *
 * A server component has no way to read its own URL, so when a guard
 * sends a signed-out visitor to sign in it would not know where to bring
 * them back to. This copies the path onto a request header for it.
 *
 * It makes no access decision and reads no session — every page and
 * action still checks its own permissions. The header is always
 * overwritten here, so a value supplied by the client never survives.
 */
export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // `_rsc` is the router's cache-busting parameter on client-side
  // navigations, not part of the address the person was heading for.
  const params = new URLSearchParams(searchParams);
  params.delete("_rsc");
  const query = params.toString();

  const headers = new Headers(request.headers);
  headers.set(RETURN_TO_HEADER, query ? `${pathname}?${query}` : pathname);

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Pages only: not API routes, build output, or files with an extension.
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
};
