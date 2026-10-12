import type {
  InvitationCredentialPort,
  InvitationCredentialResult
} from "@/application/ports/invitation-credential-port";

/**
 * Defers building the real credential port until its first call, mirroring
 * `createLazyAuthSession`.
 *
 * Why: the acceptance screen is server-rendered, and
 * `createBrowserInvitationCredential()` throws `SupabaseConfigError` when the
 * `NEXT_PUBLIC_SUPABASE_*` variables are missing. Deferring keeps rendering
 * safe; a factory that throws becomes a sanitized `unavailable` failure rather
 * than a crash.
 */
export function createLazyInvitationCredential(factory: () => InvitationCredentialPort): InvitationCredentialPort {
  let resolved: { port: InvitationCredentialPort } | { port: null } | undefined;

  function port(): InvitationCredentialPort | null {
    if (!resolved) {
      try {
        resolved = { port: factory() };
      } catch {
        resolved = { port: null };
      }
    }
    return resolved.port;
  }

  return {
    async setPassword(password: string): Promise<InvitationCredentialResult> {
      const current = port();
      if (!current) return { ok: false, code: "unavailable" };
      return current.setPassword(password);
    }
  };
}
