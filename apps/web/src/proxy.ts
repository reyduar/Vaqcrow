import { NextResponse, type NextRequest } from "next/server";
import { gateRoute } from "@/application/auth/route-gate";
import { readProxySession } from "@/infrastructure/auth/server-session";

/**
 * Server-side route gating (Next.js 16 `proxy.ts`, formerly `middleware.ts`).
 *
 * Runs only on the gated routes (`matcher`), reads the `@supabase/ssr` cookie
 * session and the role from the user's own profile row, and applies the same
 * `gateRoute` rules as the client `RouteGate`. Refreshed session cookies are
 * copied onto every response, redirect or not, so the browser and the server
 * never drift apart.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const session = await readProxySession(request);
  const target = gateRoute(request.nextUrl.pathname, session.principal);
  if (target) return session.applyTo(NextResponse.redirect(new URL(target, request.url)));
  return session.applyTo(NextResponse.next({ request }));
}

// Must stay a literal (Next.js reads it statically); `proxy.test.ts` keeps it
// equal to `GATED_PATHS`.
export const config = {
  matcher: ["/portfolio/:path*", "/company/:path*", "/login/:path*", "/signup/:path*"]
};
