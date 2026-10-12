import { createBrowserClient } from "@supabase/ssr";
import type {
  InvitationCredentialPort,
  InvitationCredentialResult
} from "@/application/ports/invitation-credential-port";
import { toAuthSessionError } from "./supabase-auth-errors";
import { readSupabaseBrowserConfig } from "./supabase-auth-session";

/**
 * Supabase Auth implementation of `InvitationCredentialPort` (#390/WU5): the
 * invited operator sets their own password with `updateUser({ password })`.
 *
 * The password is never held beyond this call and never logged — the sanitized
 * `AuthErrorCode` is the only failure signal. `createBrowserClient` is a
 * per-browser singleton, so this shares the same client the session port built.
 */

/** The slice of the Supabase browser client this adapter uses; structural, so tests inject a double. */
export interface SupabaseCredentialClient {
  readonly auth: {
    updateUser(attributes: { password: string }): PromiseLike<{ data: unknown; error: unknown }>;
  };
}

export class SupabaseInvitationCredential implements InvitationCredentialPort {
  constructor(private readonly client: SupabaseCredentialClient) {}

  async setPassword(password: string): Promise<InvitationCredentialResult> {
    try {
      const { error } = await this.client.auth.updateUser({ password });
      if (error) return { ok: false, code: toAuthSessionError(error).code };
      return { ok: true };
    } catch (error) {
      return { ok: false, code: toAuthSessionError(error).code };
    }
  }
}

/**
 * Browser default. Throws `SupabaseConfigError` (naming variables, never
 * values) when either public variable is missing; callers build it lazily so a
 * missing configuration degrades to an honest failure, never a crash.
 */
export function createBrowserInvitationCredential(): InvitationCredentialPort {
  // Literal `process.env.NEXT_PUBLIC_*` reads: Next.js inlines only these forms.
  const config = readSupabaseBrowserConfig({
    url: process.env["NEXT_PUBLIC_SUPABASE_URL"],
    publishableKey: process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]
  });
  const supabase = createBrowserClient(config.url, config.publishableKey);
  const client: SupabaseCredentialClient = {
    auth: { updateUser: (attributes) => supabase.auth.updateUser(attributes) }
  };
  return new SupabaseInvitationCredential(client);
}
