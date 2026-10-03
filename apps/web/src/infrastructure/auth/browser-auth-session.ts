import { createBrowserClient } from "@supabase/ssr";
import type { AuthSessionPort } from "@/application/ports/auth-session-port";
import { readSupabaseBrowserConfig, SupabaseAuthSession, type SupabaseSessionClient } from "./supabase-auth-session";

/**
 * Builds the browser session port from `NEXT_PUBLIC_SUPABASE_URL` and
 * `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `@supabase/ssr` keeps the session in
 * cookies, so server-side route gating can read the same session later.
 * Throws `SupabaseConfigError` (naming variables, never values) when either
 * is missing. Call it once per provider mount, not at module scope.
 */
export function createBrowserAuthSession(): AuthSessionPort {
  // Literal `process.env.NEXT_PUBLIC_*` reads: Next.js inlines only these forms.
  const config = readSupabaseBrowserConfig({
    url: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    publishableKey: process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
  });
  const supabase = createBrowserClient(config.url, config.publishableKey);
  // Narrow, explicit bridge: assigning the generic client to the structural
  // interface directly makes TypeScript instantiate its whole schema typing.
  const client: SupabaseSessionClient = {
    auth: supabase.auth,
    from: (table) => ({
      select: (columns) => ({
        eq: (column, value) => ({
          maybeSingle: () => supabase.from(table).select(columns).eq(column, value).maybeSingle()
        })
      })
    })
  };
  return new SupabaseAuthSession(client);
}
