import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseAuth } from "./supabase-auth.js";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

interface Fake {
  readonly user?: { id: string } | null;
  readonly userError?: { message: string; status?: number; name?: string } | null;
  readonly getUserReject?: Error;
  readonly getUserHangs?: boolean;
  readonly profileHangs?: boolean;
  readonly profile?: unknown;
  readonly profileError?: { code: string; message: string; details: string; hint: string } | null;
  readonly profileReject?: Error;
}

function fakeClient(fake: Fake) {
  const calls = { getUser: [] as string[], eq: [] as Array<readonly [string, unknown]>, from: [] as string[] };
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      calls.eq.push([column, value]);
      return builder;
    },
    maybeSingle: () =>
      fake.profileHangs
        ? new Promise(() => undefined)
        : fake.profileReject
        ? Promise.reject(fake.profileReject)
        : Promise.resolve({ data: fake.profile ?? null, error: fake.profileError ?? null })
  };
  const client = {
    auth: {
      getUser: (token: string) => {
        calls.getUser.push(token);
        if (fake.getUserHangs) return new Promise(() => undefined);
        return fake.getUserReject
          ? Promise.reject(fake.getUserReject)
          : Promise.resolve({
              data: { user: fake.user === undefined ? { id: USER_ID } : fake.user },
              error: fake.userError ?? null
            });
      }
    },
    from: (table: string) => {
      calls.from.push(table);
      return builder;
    }
  } as unknown as SupabaseClient;
  return { client, calls };
}

const PROFILE = { user_id: USER_ID, role: "ADMIN", status: "active", display_name: "Admin Vaqcrow" };

afterEach(() => vi.restoreAllMocks());

describe("SupabaseAuth.verifyAccessToken", () => {
  it("validates the token with Supabase, then reads the profile of the verified user", async () => {
    const { client, calls } = fakeClient({ profile: PROFILE });

    const result = await new SupabaseAuth(client).verifyAccessToken("jwt");

    expect(result).toEqual({
      ok: true,
      value: { userId: USER_ID, role: "ADMIN", status: "active", displayName: "Admin Vaqcrow" }
    });
    expect(calls.getUser).toEqual(["jwt"]);
    expect(calls.from).toEqual(["profile"]);
    expect(calls.eq).toEqual([["user_id", USER_ID]]);
  });

  it("returns an inactive principal as such (the HTTP layer rejects it)", async () => {
    const { client } = fakeClient({ profile: { ...PROFILE, status: "inactive", role: "PYME" } });

    const result = await new SupabaseAuth(client).verifyAccessToken("jwt");

    expect(result).toMatchObject({ ok: true, value: { role: "PYME", status: "inactive" } });
  });

  it("answers unauthenticated for an invalid or expired token without reading the profile", async () => {
    const { client, calls } = fakeClient({
      user: null,
      userError: { message: "invalid JWT", status: 401, name: "AuthApiError" }
    });

    const result = await new SupabaseAuth(client).verifyAccessToken("bad");

    expect(result).toEqual({ ok: false, error: { code: "unauthenticated" } });
    expect(calls.from).toEqual([]);
  });

  it("answers unauthenticated when there is no user and no error", async () => {
    const { client } = fakeClient({ user: null });
    expect(await new SupabaseAuth(client).verifyAccessToken("x")).toEqual({
      ok: false,
      error: { code: "unauthenticated" }
    });
  });

  it("answers unauthenticated when the verified user has no profile", async () => {
    const { client } = fakeClient({ profile: null });
    expect(await new SupabaseAuth(client).verifyAccessToken("jwt")).toEqual({
      ok: false,
      error: { code: "unauthenticated" }
    });
  });

  it("answers unavailable on a provider server error and never leaks its message", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ user: null, userError: { message: "upstream exploded", status: 503 } });

    const result = await new SupabaseAuth(client).verifyAccessToken("jwt");

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("exploded");
    expect(error).toHaveBeenCalled();
  });

  it("answers unavailable when getUser rejects (network)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ getUserReject: new Error("ECONNRESET") });
    expect(await new SupabaseAuth(client).verifyAccessToken("jwt")).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it("answers unavailable on a database error, logging internally only", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({
      profileError: { code: "57014", message: "secret message", details: "d", hint: "h" }
    });

    const result = await new SupabaseAuth(client).verifyAccessToken("jwt");

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(error).toHaveBeenCalled();
  });

  it("answers unavailable when the profile read rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ profileReject: new Error("boom") });
    expect(await new SupabaseAuth(client).verifyAccessToken("jwt")).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it("answers unavailable (not a role) when the stored profile is malformed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ profile: { ...PROFILE, role: "SUPERUSER" } });
    expect(await new SupabaseAuth(client).verifyAccessToken("jwt")).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it("answers unavailable on a rate limit (429) from Auth instead of rejecting the token", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client, calls } = fakeClient({ user: null, userError: { message: "slow down", status: 429, name: "AuthApiError" } });

    const result = await new SupabaseAuth(client).verifyAccessToken("jwt");

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(calls.from).toEqual([]);
    expect(error).toHaveBeenCalledWith("[SupabaseAuth] token verification failed", { status: 429, name: "AuthApiError" });
  });

  it("answers unavailable when getUser does not answer in time, logging a sanitized cause", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ getUserHangs: true });

    const result = await new SupabaseAuth(client, { timeoutMs: 10 }).verifyAccessToken("secret-jwt");

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(error).toHaveBeenCalledWith("[SupabaseAuth] unexpected failure", { cause: "timeout" });
    expect(JSON.stringify(error.mock.calls)).not.toContain("secret-jwt");
  });

  it("answers unavailable when the profile read does not answer in time", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ profileHangs: true });

    const result = await new SupabaseAuth(client, { timeoutMs: 10 }).verifyAccessToken("jwt");

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(error).toHaveBeenCalledWith("[SupabaseAuth] unexpected failure", { cause: "timeout" });
  });

  it("logs only the error name of an unexpected rejection, never its message", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ getUserReject: new TypeError("ECONNRESET with token abc") });

    await new SupabaseAuth(client).verifyAccessToken("jwt");

    expect(error).toHaveBeenCalledWith("[SupabaseAuth] unexpected failure", { cause: "TypeError" });
  });
});
