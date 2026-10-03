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
 * - The claims and profile reads are bounded together (`timeoutMs`, 3 s by
 *   default), so a slow Supabase never holds a navigation indefinitely.
 * - Any failure (missing configuration, invalid token, unreadable or
 *   malformed profile, network, timeout) reads as signed out: protected pages
 *   fail closed and the auth pages stay reachable. A failed or timed-out read
 *   logs `[Proxy] session read failed` with a sanitized `cause` only — the
 *   error name or `timeout`, never a message, token or email. Missing
 *   configuration and an ordinary signed-out visit are not logged.
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

export const PROXY_SESSION_TIMEOUT_MS = 3000;

class SessionReadTimeout extends Error {
  override readonly name = "SessionReadTimeout";
}

/** Sanitized log cause: the error name or a fixed label, never the message. */
function causeOf(error: unknown, fallback: string): string {
  if (error instanceof SessionReadTimeout) return "timeout";
  return error instanceof Error && error.name ? error.name : fallback;
}

function logReadFailure(cause: string): void {
  // eslint-disable-next-line no-console -- server-side diagnostics only; the cause is sanitized
  console.error("[Proxy] session read failed", { cause });
}

export async function readProxySession(
  request: NextRequest,
  // Literal `process.env.NEXT_PUBLIC_*` reads: Next.js inlines only these forms.
  env: { readonly url: string | undefined; readonly publishableKey: string | undefined } = {
    url: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    publishableKey: process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
  },
  { timeoutMs = PROXY_SESSION_TIMEOUT_MS }: { readonly timeoutMs?: number } = {}
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

    const read = async (): Promise<SessionPrincipal | null> => {
      const { data, error } = await client.auth.getClaims();
      if (error) {
        logReadFailure(causeOf(error, "claims_error"));
        return null;
      }
      const subject = data?.claims["sub"];
      if (typeof subject !== "string" || subject === "") return null;

      const profile = await client.from("profile").select("role, display_name").eq("user_id", subject).maybeSingle();
      if (profile.error) {
        // PostgREST errors are plain objects: log a fixed label, never their fields.
        logReadFailure(causeOf(profile.error, "profile_error"));
        return null;
      }
      return toPrincipal(profile.data);
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new SessionReadTimeout()), timeoutMs);
    });
    try {
      return session(await Promise.race([read(), timeout]));
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    logReadFailure(causeOf(error, "unknown"));
    return session(null);
  }
}
