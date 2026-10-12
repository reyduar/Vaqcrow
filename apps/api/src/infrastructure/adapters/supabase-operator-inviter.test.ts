import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OPERATOR_INVITATION_ACCEPT_PATH,
  PROVISIONAL_OPERATOR_DISPLAY_NAME,
  SupabaseOperatorInviter
} from "./supabase-operator-inviter.js";

/**
 * The Supabase operator-invitation adapter (#390/WU3b).
 *
 * It mirrors the proven superadmin seed: `inviteUserByEmail` inserts with
 * `user_metadata.role = "INVERSOR"` (the strict insert trigger accepts it) and
 * sends the invite email through Supabase Auth's SMTP; `updateUserById` then
 * writes `app_metadata.role = "ADMIN"`, which the promotion trigger applies. A
 * failed promotion rolls the just-created account back, so no half-provisioned
 * INVERSOR is left behind. Every provider failure is sanitized — its
 * `message`/`details`/`hint` never crosses the boundary.
 */

const EMAIL = "operador@vaqcrow.com";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const REDIRECT = "https://app.example.test/accept-invitation";

interface Step {
  readonly inviteUser?: { id: string } | null;
  readonly inviteError?: { code?: string; status?: number; message?: string } | null;
  readonly inviteRejects?: Error;
  readonly updateUser?: { id: string } | null;
  readonly updateError?: { code?: string; status?: number; message?: string } | null;
  readonly updateRejects?: Error;
  readonly deleteError?: { code?: string; message?: string } | null;
}

function fakeClient(step: Step) {
  const invites: Array<{ email: string; options: unknown }> = [];
  const updates: Array<{ id: string; attributes: unknown }> = [];
  const deletes: string[] = [];
  const client = {
    auth: {
      admin: {
        inviteUserByEmail: async (email: string, options: unknown) => {
          invites.push({ email, options });
          if (step.inviteRejects) throw step.inviteRejects;
          return { data: { user: step.inviteUser ?? null }, error: step.inviteError ?? null };
        },
        updateUserById: async (id: string, attributes: unknown) => {
          updates.push({ id, attributes });
          if (step.updateRejects) throw step.updateRejects;
          return { data: { user: step.updateUser ?? null }, error: step.updateError ?? null };
        },
        deleteUser: async (id: string) => {
          deletes.push(id);
          return { error: step.deleteError ?? null };
        }
      }
    }
  } as unknown as SupabaseClient;
  return { client, invites, updates, deletes };
}

afterEach(() => vi.restoreAllMocks());

describe("SupabaseOperatorInviter.invite", () => {
  it("invites with INVERSOR metadata, promotes to ADMIN and returns the user id", async () => {
    const { client, invites, updates } = fakeClient({ inviteUser: { id: USER_ID } });

    const result = await new SupabaseOperatorInviter(client, { redirectTo: REDIRECT }).invite({ email: EMAIL });

    expect(result).toEqual({ ok: true, value: { userId: USER_ID } });
    expect(invites).toEqual([
      {
        email: EMAIL,
        options: {
          data: { role: "INVERSOR", display_name: PROVISIONAL_OPERATOR_DISPLAY_NAME },
          redirectTo: REDIRECT
        }
      }
    ]);
    expect(updates).toEqual([
      {
        id: USER_ID,
        attributes: { app_metadata: { role: "ADMIN", display_name: PROVISIONAL_OPERATOR_DISPLAY_NAME } }
      }
    ]);
  });

  it("omits redirectTo when the app base URL is not configured", async () => {
    const { client, invites } = fakeClient({ inviteUser: { id: USER_ID } });

    await new SupabaseOperatorInviter(client).invite({ email: EMAIL });

    expect(invites[0]?.options).toEqual({
      data: { role: "INVERSOR", display_name: PROVISIONAL_OPERATOR_DISPLAY_NAME }
    });
  });

  it("exposes the acceptance path the composition root appends to the base URL", () => {
    expect(OPERATOR_INVITATION_ACCEPT_PATH).toBe("/accept-invitation");
  });

  it("maps an existing email to email_exists without promoting", async () => {
    const { client, updates, deletes } = fakeClient({
      inviteError: { code: "email_exists", status: 422, message: "secret detail" }
    });

    const result = await new SupabaseOperatorInviter(client).invite({ email: EMAIL });

    expect(result).toEqual({ ok: false, error: { code: "email_exists" } });
    expect(updates).toEqual([]);
    expect(deletes).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("sanitizes any other invitation provider error to unavailable", async () => {
    const { client } = fakeClient({
      inviteError: { code: "unexpected_failure", status: 500, message: "secret detail" }
    });

    const result = await new SupabaseOperatorInviter(client).invite({ email: EMAIL });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("is unavailable and rolls back when the promotion fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client, deletes } = fakeClient({
      inviteUser: { id: USER_ID },
      updateError: { code: "unexpected_failure", status: 500, message: "secret detail" }
    });

    const result = await new SupabaseOperatorInviter(client).invite({ email: EMAIL });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(deletes).toEqual([USER_ID]);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(log).toHaveBeenCalled();
  });

  it("is unavailable when the provider returns no user id", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client, updates } = fakeClient({ inviteUser: null });

    const result = await new SupabaseOperatorInviter(client).invite({ email: EMAIL });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(updates).toEqual([]);
    expect(log).toHaveBeenCalled();
  });

  it("maps a thrown invitation to unavailable, logging only the error name", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ inviteRejects: new TypeError("SECRET network detail") });

    const result = await new SupabaseOperatorInviter(client).invite({ email: EMAIL });

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(JSON.stringify(log.mock.calls)).not.toContain("SECRET");
  });
});
