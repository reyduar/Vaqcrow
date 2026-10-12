import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OperatorInviterPort,
  OperatorInviterResult,
  OperatorInviteRequest
} from "../../application/ports/operator-inviter-port.js";

/**
 * The Supabase operator-invitation adapter (Feature #390, WU3b).
 *
 * It mirrors the proven superadmin seed (`seed-superadmin.ts`): `ADMIN` is only
 * reachable through two database triggers, so the invitation is a two-step
 * provider call.
 *
 * 1. `inviteUserByEmail(email, { data: { role: "INVERSOR", display_name } })`
 *    — GoTrue INSERTs the auth user carrying only `user_metadata`, which the
 *    strict insert trigger accepts (it requires `user_metadata.role` = INVERSOR;
 *    `ADMIN` there would be rejected because `user_metadata` is user-editable),
 *    then sends the invite email through Supabase Auth's own SMTP.
 * 2. `updateUserById(id, { app_metadata: { role: "ADMIN", display_name } })`
 *    — only the service role may write `app_metadata`, and the
 *    `promote_admin_on_app_metadata` trigger promotes the profile to ADMIN.
 *
 * `display_name` is a fixed, honest placeholder (`PROVISIONAL_OPERATOR_DISPLAY_NAME`):
 * a display name is required at creation and the repository forbids deriving it
 * from the email (owner decision D3), so the acceptance screen (WU5) replaces
 * it with the operator's real name. An already-registered email is
 * `email_exists`; every other provider failure — including a promotion that
 * could not apply — is a sanitized `unavailable`. A failed promotion rolls the
 * just-created account back, so a retry starts clean and no half-provisioned
 * INVERSOR is ever left behind. `message`/`details`/`hint` never cross this
 * boundary.
 */

/**
 * The honest placeholder the invited account carries until it accepts. Owner
 * decision D3 forbids deriving a display name from the email, so this fixed
 * value is what both gates require at creation; the acceptance screen (WU5)
 * overwrites it with the operator's real name.
 */
export const PROVISIONAL_OPERATOR_DISPLAY_NAME = "Operador invitado";

/**
 * The future acceptance route (WU5), appended to the configured app base URL to
 * build `redirectTo`. The path is English, per the repository's route rule; WU5
 * must serve it.
 */
export const OPERATOR_INVITATION_ACCEPT_PATH = "/accept-invitation";

const EMAIL_EXISTS_CODE = "email_exists";

interface ProviderError {
  readonly code?: string | undefined;
  readonly status?: number | undefined;
}

export interface SupabaseOperatorInviterOptions {
  /**
   * The absolute acceptance URL the invite email links to, built by the
   * composition root from the configured app base URL. Omitted when no base URL
   * is configured, in which case Supabase Auth falls back to its own site URL.
   */
  readonly redirectTo?: string;
}

const UNAVAILABLE: OperatorInviterResult<never> = { ok: false, error: { code: "unavailable" } };
const EMAIL_EXISTS: OperatorInviterResult<never> = { ok: false, error: { code: "email_exists" } };

export class SupabaseOperatorInviter implements OperatorInviterPort {
  private readonly redirectTo: string | undefined;

  constructor(
    private readonly client: SupabaseClient,
    options: SupabaseOperatorInviterOptions = {}
  ) {
    this.redirectTo = options.redirectTo;
  }

  async invite(request: OperatorInviteRequest): Promise<OperatorInviterResult<{ userId: string }>> {
    try {
      const invited = await this.client.auth.admin.inviteUserByEmail(request.email, {
        // INVERSOR only satisfies the strict insert trigger; app_metadata (below)
        // is what promotes the profile to ADMIN.
        data: { role: "INVERSOR", display_name: PROVISIONAL_OPERATOR_DISPLAY_NAME },
        ...(this.redirectTo === undefined ? {} : { redirectTo: this.redirectTo })
      });

      if (invited.error) {
        this.logProvider("inviteUserByEmail", invited.error);
        return invited.error.code === EMAIL_EXISTS_CODE ? EMAIL_EXISTS : UNAVAILABLE;
      }

      const userId = invited.data.user?.id;
      if (typeof userId !== "string" || userId.length === 0) {
        this.logUnexpected("inviteUserByEmail", new Error("invite without a user"));
        return UNAVAILABLE;
      }

      const promoted = await this.client.auth.admin.updateUserById(userId, {
        app_metadata: { role: "ADMIN", display_name: PROVISIONAL_OPERATOR_DISPLAY_NAME }
      });
      if (promoted.error) {
        return this.rollBack(userId, promoted.error);
      }

      return { ok: true, value: { userId } };
    } catch (cause) {
      this.logUnexpected("invite", cause);
      return UNAVAILABLE;
    }
  }

  /**
   * The account was created but could not be promoted to ADMIN, so it is
   * deleted before reporting `unavailable`: a half-provisioned INVERSOR would
   * otherwise be unreachable by this route (the next attempt would be
   * `email_exists`) and would show as an invited non-operator in the console.
   * A failed delete is logged and still reported `unavailable`; the operator
   * would have to remove the user manually, which the API never hides.
   */
  private async rollBack(userId: string, error: ProviderError): Promise<OperatorInviterResult<never>> {
    this.logProvider("updateUserById", error);
    try {
      const { error: deleteError } = await this.client.auth.admin.deleteUser(userId);
      if (deleteError) {
        // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
        console.error("[SupabaseOperatorInviter] deleteUser failed", { code: deleteError.code });
      }
    } catch (cause) {
      this.logUnexpected("deleteUser", cause);
    }
    return UNAVAILABLE;
  }

  private logProvider(operation: string, error: ProviderError): void {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error(`[SupabaseOperatorInviter] ${operation} error`, { code: error.code });
  }

  private logUnexpected(operation: string, cause: unknown): void {
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error(`[SupabaseOperatorInviter] ${operation} failed`, {
      cause: cause instanceof Error ? cause.name : "unknown"
    });
  }
}
