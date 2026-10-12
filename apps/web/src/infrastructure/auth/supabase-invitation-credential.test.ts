import { describe, expect, it, vi } from "vitest";
import {
  SupabaseInvitationCredential,
  type SupabaseCredentialClient
} from "./supabase-invitation-credential";

/**
 * The client-side password setter (#390/WU5). It calls
 * `updateUser({ password })` on the signed-in Supabase session and maps every
 * provider failure to a sanitized `AuthErrorCode`; the provider `message` never
 * crosses this boundary and the call never rejects.
 */

function client(result: { data?: unknown; error?: unknown } | Error): {
  client: SupabaseCredentialClient;
  updateUser: ReturnType<typeof vi.fn>;
} {
  const updateUser = vi.fn().mockImplementation(() => {
    if (result instanceof Error) throw result;
    return Promise.resolve({ data: result.data ?? { user: {} }, error: result.error ?? null });
  });
  return { client: { auth: { updateUser } } as SupabaseCredentialClient, updateUser };
}

describe("SupabaseInvitationCredential.setPassword", () => {
  it("sets the password and reports success", async () => {
    const { client: c, updateUser } = client({});

    const result = await new SupabaseInvitationCredential(c).setPassword("secret-123");

    expect(result).toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledExactlyOnceWith({ password: "secret-123" });
  });

  it("maps a provider error code to a sanitized code", async () => {
    const weak = client({ error: { code: "weak_password", message: "SECRET provider message" } });
    const result = await new SupabaseInvitationCredential(weak.client).setPassword("short");
    expect(result).toEqual({ ok: false, code: "weak_password" });
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });

  it("maps an unexpected provider error to unavailable", async () => {
    const { client: c } = client({ error: { code: "some_unknown_code", message: "SECRET" } });

    expect(await new SupabaseInvitationCredential(c).setPassword("secret-123")).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("never rejects: a thrown provider call becomes a sanitized code", async () => {
    const { client: c } = client(new TypeError("network SECRET"));

    expect(await new SupabaseInvitationCredential(c).setPassword("secret-123")).toEqual({
      ok: false,
      code: "network"
    });
  });
});
