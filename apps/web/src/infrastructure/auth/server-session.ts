import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { SessionPrincipal } from "@/application/ports/auth-session-port";
import { readSupabaseBrowserConfig, toPrincipal, type ProfileRow } from "./supabase-auth-session";

/**
 * The proxy's read of the request's Supabase session (`@supabase/ssr` cookie
 * session written by the browser client).
 *
 * - `getClaims()` verifies the access token and refreshes it when needed;
 *   refreshed cookies (and the cache headers Supabase asks for) are copied to
 *   whatever response the proxy returns through `applyTo`.
 * - The role and name come from the user's own `public.profile` row, read
 *   with that user's JWT under RLS (`profile_select_own`) by the verified
 *   subject — never from JWT claims or the URL.
 * - Any failure (missing configuration, invalid token, unreadable or
 *   malformed profile, network) reads as signed out: protected pages fail
 *   closed and the auth pages stay reachable. Nothing is logged or surfaced.
 */
export interface ProxySession {
  readonly principal: SessionPrincipal | null;
  /** Copies refreshed session cookies and cache headers onto the response. */
  applyTo<T extends NextResponse>(response: T): T;
}

type CookieSetOptions = NonNullable<Parameters<NextResponse["cookies"]["set"]>[2]>;

interface CookieToSet {
  readonly name: string;
  readonly value: string;
  readonly options?: CookieSetOptions;
}

/** The slice of the server client the proxy uses; structural to avoid the SDK's deep generics. */
interface ProxySessionClient {
  readonly auth: {
    getClaims(): PromiseLike<{ data: { claims: Record<string, unknown> } | null; error: unknown }>;
  };
  from(table: "profile"): {
    select(columns: "role, display_name"): {
      eq(column: "user_id", value: string): {
        maybeSingle(): PromiseLike<{ data: ProfileRow | null; error: unknown }>;
      };
    };
  };
}

export async function readProxySession(
  request: NextRequest,
  // Literal `process.env.NEXT_PUBLIC_*` reads: Next.js inlines only these forms.
  env: { readonly url: string | undefined; readonly publishableKey: string | undefined } = {
    url: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    publishableKey: process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
  }
): Promise<ProxySession> {
  const pendingCookies: CookieToSet[] = [];
  const pendingHeaders: Record<string, string> = {};
  const session = (principal: SessionPrincipal | null): ProxySession => ({
    principal,
    applyTo(response) {
      for (const { name, value, options } of pendingCookies) {
        if (options) response.cookies.set(name, value, options);
        else response.cookies.set(name, value);
      }
      for (const [key, value] of Object.entries(pendingHeaders)) response.headers.set(key, value);
      return response;
    }
  });

  let config: { url: string; publishableKey: string };
  try {
    config = readSupabaseBrowserConfig(env);
  } catch {
    return session(null);
  }

  try {
    const supabase = createServerClient(config.url, config.publishableKey, {
      cookies: {
        getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
        setAll: (cookies: CookieToSet[], headers?: Record<string, string>) => {
          for (const cookie of cookies) {
            request.cookies.set(cookie.name, cookie.value);
            pendingCookies.push(cookie);
          }
          Object.assign(pendingHeaders, headers ?? {});
        }
      }
    });
    const client: ProxySessionClient = {
      auth: { getClaims: () => supabase.auth.getClaims() },
      from: (table) => ({
        select: (columns) => ({
          eq: (column, value) => ({
            maybeSingle: () => supabase.from(table).select(columns).eq(column, value).maybeSingle()
          })
        })
      })
    };

    const { data, error } = await client.auth.getClaims();
    const subject = data?.claims["sub"];
    if (error || typeof subject !== "string" || subject === "") return session(null);

    const profile = await client.from("profile").select("role, display_name").eq("user_id", subject).maybeSingle();
    if (profile.error) return session(null);
    return session(toPrincipal(profile.data));
  } catch {
    return session(null);
  }
}
