import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseWalletRepository } from "./supabase-wallet-repository.js";

const OWNER = "00000000-0000-4000-8000-000000000004";
const CHALLENGE_ID = "11111111-1111-4111-8111-111111111111";
const PUBLIC_KEY = "GDCY3KGCN7CVU56HX4DJIMFXJT47LQTAPBFHDLJBNTO5GBMVMBZ7Y6O3";

const CHALLENGE_ROW = {
  challenge_id: CHALLENGE_ID,
  owner_user_id: OWNER,
  nonce: "nonce-1",
  expires_at: "2026-10-04T12:05:00.000Z",
  consumed_at: null
};

const EXPECTED_CHALLENGE = {
  challengeId: CHALLENGE_ID,
  ownerUserId: OWNER,
  nonce: "nonce-1",
  expiresAt: "2026-10-04T12:05:00.000Z",
  consumedAt: null
};

interface PgError {
  readonly code: string;
  readonly message: string;
  readonly details: string;
  readonly hint: string;
}

interface TableStep {
  readonly data?: unknown;
  readonly error?: PgError | null;
  readonly reject?: Error;
}

function pgError(code: string): PgError {
  return { code, message: "SECRET message", details: "SECRET details", hint: "SECRET hint" };
}

/**
 * A per-table Supabase double. Each `from(table)` returns a thenable builder so
 * both `await ...select().eq()` (isFrozen's list reads) and `.single()` /
 * `.maybeSingle()` resolve to that table's configured step.
 */
function fakeClient(byTable: Record<string, TableStep>) {
  const calls = {
    from: [] as string[],
    insert: [] as unknown[],
    update: [] as unknown[],
    eq: [] as Array<readonly [string, unknown]>,
    is: [] as Array<readonly [string, unknown]>,
    in: [] as Array<readonly [string, unknown[]]>,
    limit: [] as number[],
    single: 0,
    maybeSingle: 0
  };

  const makeBuilder = (table: string) => {
    const step = byTable[table] ?? {};
    const result = () =>
      step.reject
        ? Promise.reject(step.reject)
        : Promise.resolve({ data: step.data ?? null, error: step.error ?? null });

    const builder = {
      insert: (payload: unknown) => {
        calls.insert.push(payload);
        return builder;
      },
      update: (payload: unknown) => {
        calls.update.push(payload);
        return builder;
      },
      select: () => builder,
      eq: (column: string, value: unknown) => {
        calls.eq.push([column, value]);
        return builder;
      },
      is: (column: string, value: unknown) => {
        calls.is.push([column, value]);
        return builder;
      },
      in: (column: string, values: unknown[]) => {
        calls.in.push([column, values]);
        return builder;
      },
      limit: (count: number) => {
        calls.limit.push(count);
        return builder;
      },
      single: () => {
        calls.single += 1;
        return result();
      },
      maybeSingle: () => {
        calls.maybeSingle += 1;
        return result();
      },
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        result().then(onFulfilled, onRejected)
    };

    return builder;
  };

  const client = {
    from: (table: string) => {
      calls.from.push(table);
      return makeBuilder(table);
    }
  } as unknown as SupabaseClient;

  return { client, calls };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SupabaseWalletRepository.createChallenge", () => {
  it("inserts the challenge and maps the stored row", async () => {
    const { client, calls } = fakeClient({ wallet_challenge: { data: CHALLENGE_ROW } });

    const result = await new SupabaseWalletRepository(client).createChallenge({
      challengeId: CHALLENGE_ID,
      ownerUserId: OWNER,
      nonce: "nonce-1",
      expiresAt: "2026-10-04T12:05:00.000Z"
    });

    expect(calls.from).toEqual(["wallet_challenge"]);
    expect(calls.insert).toEqual([
      {
        challenge_id: CHALLENGE_ID,
        owner_user_id: OWNER,
        nonce: "nonce-1",
        expires_at: "2026-10-04T12:05:00.000Z"
      }
    ]);
    expect(result).toEqual({ ok: true, value: EXPECTED_CHALLENGE });
  });

  it("maps a check violation to invalid_request and everything else to unavailable, never leaking Postgres text", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const violation = fakeClient({ wallet_challenge: { error: pgError("23514") } });
    const rejected = await new SupabaseWalletRepository(violation.client).createChallenge({
      challengeId: CHALLENGE_ID,
      ownerUserId: OWNER,
      nonce: "nonce-1",
      expiresAt: "2026-10-04T12:05:00.000Z"
    });
    expect(rejected).toEqual({ ok: false, error: { code: "invalid_request" } });
    expect(JSON.stringify(rejected)).not.toContain("SECRET");

    for (const step of [
      { error: pgError("XX000") },
      { data: null },
      { data: { ...CHALLENGE_ROW, challenge_id: 42 } },
      { reject: new Error("network SECRET") }
    ] as const) {
      const { client } = fakeClient({ wallet_challenge: step });
      const result = await new SupabaseWalletRepository(client).createChallenge({
        challengeId: CHALLENGE_ID,
        ownerUserId: OWNER,
        nonce: "nonce-1",
        expiresAt: "2026-10-04T12:05:00.000Z"
      });
      expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
      expect(JSON.stringify(result)).not.toContain("SECRET");
    }
    expect(logged).toHaveBeenCalled();
  });
});

describe("SupabaseWalletRepository.findChallenge", () => {
  it("scopes the read by challenge id and owner", async () => {
    const { client, calls } = fakeClient({ wallet_challenge: { data: CHALLENGE_ROW } });

    const result = await new SupabaseWalletRepository(client).findChallenge({
      challengeId: CHALLENGE_ID,
      ownerUserId: OWNER
    });

    expect(calls.eq).toEqual([
      ["challenge_id", CHALLENGE_ID],
      ["owner_user_id", OWNER]
    ]);
    expect(result).toEqual({ ok: true, value: EXPECTED_CHALLENGE });
  });

  it("is not_found when no challenge matches, without querying for a non-uuid id", async () => {
    const { client } = fakeClient({ wallet_challenge: { data: null } });
    expect(
      await new SupabaseWalletRepository(client).findChallenge({ challengeId: CHALLENGE_ID, ownerUserId: OWNER })
    ).toEqual({ ok: false, error: { code: "not_found" } });

    const { client: second, calls } = fakeClient({ wallet_challenge: { data: null } });
    expect(
      await new SupabaseWalletRepository(second).findChallenge({ challengeId: "not-a-uuid", ownerUserId: OWNER })
    ).toEqual({ ok: false, error: { code: "not_found" } });
    expect(calls.from).toEqual([]);
  });

  it("is unavailable on a Postgres error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { client } = fakeClient({ wallet_challenge: { error: pgError("XX000") } });

    expect(
      await new SupabaseWalletRepository(client).findChallenge({ challengeId: CHALLENGE_ID, ownerUserId: OWNER })
    ).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

describe("SupabaseWalletRepository.consumeChallenge", () => {
  it("marks the challenge consumed only while it is still unconsumed", async () => {
    const { client, calls } = fakeClient({ wallet_challenge: { data: [CHALLENGE_ROW] } });

    const result = await new SupabaseWalletRepository(client).consumeChallenge(CHALLENGE_ID);

    expect(calls.from).toEqual(["wallet_challenge"]);
    expect(calls.update).toHaveLength(1);
    expect(calls.update[0]).toMatchObject({ consumed_at: expect.any(String) });
    expect(calls.eq).toEqual([["challenge_id", CHALLENGE_ID]]);
    expect(calls.is).toEqual([["consumed_at", null]]);
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("is not_found when nothing was consumed (already used or missing)", async () => {
    const { client } = fakeClient({ wallet_challenge: { data: [] } });

    expect(await new SupabaseWalletRepository(client).consumeChallenge(CHALLENGE_ID)).toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("is unavailable on a Postgres error and does not query for a non-uuid id", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const errored = fakeClient({ wallet_challenge: { error: pgError("XX000") } });
    expect(await new SupabaseWalletRepository(errored.client).consumeChallenge(CHALLENGE_ID)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });

    const skipped = fakeClient({ wallet_challenge: { data: [CHALLENGE_ROW] } });
    expect(await new SupabaseWalletRepository(skipped.client).consumeChallenge("not-a-uuid")).toEqual({
      ok: false,
      error: { code: "not_found" }
    });
    expect(skipped.calls.from).toEqual([]);
  });
});

describe("SupabaseWalletRepository.readPublicKey", () => {
  it("returns the stored key", async () => {
    const { client, calls } = fakeClient({ profile: { data: { stellar_public_key: PUBLIC_KEY } } });

    expect(await new SupabaseWalletRepository(client).readPublicKey(OWNER)).toEqual({ ok: true, value: PUBLIC_KEY });
    expect(calls.eq).toEqual([["user_id", OWNER]]);
  });

  it("returns null when the profile has no key or does not exist", async () => {
    for (const step of [{ data: { stellar_public_key: null } }, { data: null }] as const) {
      const { client } = fakeClient({ profile: step });
      expect(await new SupabaseWalletRepository(client).readPublicKey(OWNER)).toEqual({ ok: true, value: null });
    }
  });

  it("is unavailable on a Postgres error or a corrupt stored key", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const step of [
      { error: pgError("XX000") },
      { data: { stellar_public_key: "not-a-key" } },
      { reject: new Error("network SECRET") }
    ] as const) {
      const { client } = fakeClient({ profile: step });
      expect(await new SupabaseWalletRepository(client).readPublicKey(OWNER)).toEqual({
        ok: false,
        error: { code: "unavailable" }
      });
    }
  });
});

describe("SupabaseWalletRepository.writePublicKey", () => {
  it("updates the owner's profile with the key", async () => {
    const { client, calls } = fakeClient({ profile: { data: { stellar_public_key: PUBLIC_KEY } } });

    const result = await new SupabaseWalletRepository(client).writePublicKey({ ownerUserId: OWNER, publicKey: PUBLIC_KEY });

    expect(calls.update).toEqual([{ stellar_public_key: PUBLIC_KEY }]);
    expect(calls.eq).toEqual([["user_id", OWNER]]);
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("maps a check violation to invalid_request, a zero-row update to not_found, and anything else to unavailable", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const violation = fakeClient({ profile: { error: pgError("23514") } });
    expect(
      await new SupabaseWalletRepository(violation.client).writePublicKey({ ownerUserId: OWNER, publicKey: PUBLIC_KEY })
    ).toEqual({ ok: false, error: { code: "invalid_request" } });

    const other = fakeClient({ profile: { error: pgError("XX000") } });
    expect(
      await new SupabaseWalletRepository(other.client).writePublicKey({ ownerUserId: OWNER, publicKey: PUBLIC_KEY })
    ).toEqual({ ok: false, error: { code: "unavailable" } });

    // A zero-row update makes `.single()` fail with PGRST116, not a null row.
    const zeroRows = fakeClient({ profile: { error: pgError("PGRST116") } });
    expect(
      await new SupabaseWalletRepository(zeroRows.client).writePublicKey({ ownerUserId: OWNER, publicKey: PUBLIC_KEY })
    ).toEqual({ ok: false, error: { code: "not_found" } });

    // Defensive: a null row with no error (other PostgREST transports) still
    // maps to not_found rather than being treated as success.
    const missing = fakeClient({ profile: { data: null } });
    expect(
      await new SupabaseWalletRepository(missing.client).writePublicKey({ ownerUserId: OWNER, publicKey: PUBLIC_KEY })
    ).toEqual({ ok: false, error: { code: "not_found" } });

    expect(logged).toHaveBeenCalled();
  });
});

describe("SupabaseWalletRepository.isFrozen", () => {
  const APP_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  it("is frozen when one of the owner's applications has a campaign", async () => {
    const { client, calls } = fakeClient({
      sme_request: { data: [{ application_id: APP_A }] },
      campaign: { data: [{ campaign_id: "c1" }] }
    });

    expect(await new SupabaseWalletRepository(client).isFrozen(OWNER)).toEqual({ ok: true, value: true });
    expect(calls.from).toEqual(["sme_request", "campaign"]);
    expect(calls.in).toEqual([["application_id", [APP_A]]]);
  });

  it("is not frozen when the owner has no applications", async () => {
    const { client, calls } = fakeClient({ sme_request: { data: [] } });

    expect(await new SupabaseWalletRepository(client).isFrozen(OWNER)).toEqual({ ok: true, value: false });
    expect(calls.from).toEqual(["sme_request"]);
  });

  it("is not frozen when the owner's applications have no campaign", async () => {
    const { client } = fakeClient({
      sme_request: { data: [{ application_id: APP_A }] },
      campaign: { data: [] }
    });

    expect(await new SupabaseWalletRepository(client).isFrozen(OWNER)).toEqual({ ok: true, value: false });
  });

  it("is unavailable when either read fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const first = fakeClient({ sme_request: { error: pgError("XX000") } });
    expect(await new SupabaseWalletRepository(first.client).isFrozen(OWNER)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });

    const second = fakeClient({
      sme_request: { data: [{ application_id: APP_A }] },
      campaign: { error: pgError("XX000") }
    });
    expect(await new SupabaseWalletRepository(second.client).isFrozen(OWNER)).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});
