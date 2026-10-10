import { describe, expect, it, vi } from "vitest";
import type {
  WalletChallengeRecord,
  WalletRepositoryPort
} from "../ports/wallet-repository-port.js";
import type { WalletSignaturePort } from "../ports/wallet-signature-port.js";
import {
  buildWalletChallengeMessage,
  connectWallet,
  getWallet,
  issueWalletChallenge
} from "./wallet.js";

const OWNER = "00000000-0000-4000-8000-000000000004";
const CHALLENGE_ID = "11111111-1111-4111-8111-111111111111";
const NONCE = "22222222-2222-4222-8222-222222222222";
/** A well-formed ed25519 public key (`G` + 55 base32 chars). */
const PUBLIC_KEY = "GDCY3KGCN7CVU56HX4DJIMFXJT47LQTAPBFHDLJBNTO5GBMVMBZ7Y6O3";
const NOW = new Date("2026-10-04T12:00:00.000Z");

const challenge: WalletChallengeRecord = {
  challengeId: CHALLENGE_ID,
  ownerUserId: OWNER,
  nonce: NONCE,
  expiresAt: "2026-10-04T12:05:00.000Z",
  consumedAt: null
};

function repository(overrides: Partial<WalletRepositoryPort> = {}): WalletRepositoryPort {
  return {
    createChallenge: vi.fn().mockResolvedValue({ ok: true, value: challenge }),
    findChallenge: vi.fn().mockResolvedValue({ ok: true, value: challenge }),
    consumeChallenge: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    readPublicKey: vi.fn().mockResolvedValue({ ok: true, value: PUBLIC_KEY }),
    writePublicKey: vi.fn().mockResolvedValue({ ok: true, value: undefined }),
    isFrozen: vi.fn().mockResolvedValue({ ok: true, value: false }),
    ...overrides
  };
}

function signatures(valid = true): WalletSignaturePort {
  return { verifyMessage: vi.fn().mockReturnValue(valid) };
}

describe("buildWalletChallengeMessage", () => {
  it("includes the nonce and stays a stable, documented string", () => {
    const message = buildWalletChallengeMessage(NONCE);

    expect(message).toContain(NONCE);
    expect(message).toBe(buildWalletChallengeMessage(NONCE));
    expect(message).not.toContain("Stellar Signed Message");
  });
});

describe("issueWalletChallenge", () => {
  it("creates a challenge for the principal's owner with a bounded expiry and returns the message to sign", async () => {
    const repo = repository();

    const result = await issueWalletChallenge(
      {
        repository: repo,
        generateChallengeId: () => CHALLENGE_ID,
        generateNonce: () => NONCE,
        ttlSeconds: 300,
        now: () => NOW
      },
      { ownerUserId: OWNER }
    );

    expect(result).toEqual({
      ok: true,
      value: { challengeId: CHALLENGE_ID, message: buildWalletChallengeMessage(NONCE) }
    });
    expect(repo.createChallenge).toHaveBeenCalledWith({
      challengeId: CHALLENGE_ID,
      ownerUserId: OWNER,
      nonce: NONCE,
      expiresAt: "2026-10-04T12:05:00.000Z"
    });
  });

  it("maps a repository invalid_request to invalid_request and anything else to unavailable", async () => {
    const invalid = await issueWalletChallenge(
      {
        repository: repository({ createChallenge: vi.fn().mockResolvedValue({ ok: false, error: { code: "invalid_request" } }) }),
        generateChallengeId: () => CHALLENGE_ID,
        generateNonce: () => NONCE,
        ttlSeconds: 300,
        now: () => NOW
      },
      { ownerUserId: OWNER }
    );
    expect(invalid).toEqual({ ok: false, error: { code: "invalid_request" } });

    const unavailable = await issueWalletChallenge(
      {
        repository: repository({ createChallenge: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) }),
        generateChallengeId: () => CHALLENGE_ID,
        generateNonce: () => NONCE,
        ttlSeconds: 300,
        now: () => NOW
      },
      { ownerUserId: OWNER }
    );
    expect(unavailable).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("never leaks a repository error message", async () => {
    const repo = repository({
      createChallenge: vi.fn().mockResolvedValue({ ok: false, error: { code: "invalid_request", message: "SECRET" } })
    });

    const result = await issueWalletChallenge(
      { repository: repo, generateChallengeId: () => CHALLENGE_ID, generateNonce: () => NONCE, ttlSeconds: 300, now: () => NOW },
      { ownerUserId: OWNER }
    );

    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
});

describe("connectWallet", () => {
  const body = { challengeId: CHALLENGE_ID, publicKey: PUBLIC_KEY, signature: "c2ln" };

  it("verifies the signature, consumes the challenge before storing the key and reports the key not frozen", async () => {
    const order: string[] = [];
    const repo = repository({
      consumeChallenge: vi.fn().mockImplementation(async () => {
        order.push("consume");
        return { ok: true, value: undefined };
      }),
      writePublicKey: vi.fn().mockImplementation(async () => {
        order.push("write");
        return { ok: true, value: undefined };
      })
    });

    const result = await connectWallet(
      { repository: repo, signatures: signatures(), now: () => NOW },
      { ownerUserId: OWNER, body }
    );

    expect(result).toEqual({ ok: true, value: { publicKey: PUBLIC_KEY, frozen: false } });
    expect(repo.findChallenge).toHaveBeenCalledWith({ challengeId: CHALLENGE_ID, ownerUserId: OWNER });
    expect(repo.writePublicKey).toHaveBeenCalledWith({ ownerUserId: OWNER, publicKey: PUBLIC_KEY });
    expect(repo.consumeChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(order).toEqual(["consume", "write"]);
  });

  it("verifies the exact challenge message for the stored nonce", async () => {
    const verifier = signatures();

    await connectWallet(
      { repository: repository(), signatures: verifier, now: () => NOW },
      { ownerUserId: OWNER, body }
    );

    expect(verifier.verifyMessage).toHaveBeenCalledWith({
      publicKey: PUBLIC_KEY,
      message: buildWalletChallengeMessage(NONCE),
      signature: "c2ln"
    });
  });

  it.each([
    ["a non-object body", "text"],
    ["a missing body", undefined],
    ["an array body", []],
    ["an unknown key", { ...body, ownerUserId: "attacker" }],
    ["a missing challengeId", { publicKey: PUBLIC_KEY, signature: "c2ln" }],
    ["a malformed challengeId", { ...body, challengeId: "not-a-uuid" }],
    ["a missing publicKey", { challengeId: CHALLENGE_ID, signature: "c2ln" }],
    ["a malformed publicKey", { ...body, publicKey: "not-a-key" }],
    ["a missing signature", { challengeId: CHALLENGE_ID, publicKey: PUBLIC_KEY }],
    ["an empty signature", { ...body, signature: "" }]
  ])("rejects %s as invalid_request without touching the repository", async (_label, payload) => {
    const repo = repository();
    const verifier = signatures();

    const result = await connectWallet(
      { repository: repo, signatures: verifier, now: () => NOW },
      { ownerUserId: OWNER, body: payload }
    );

    expect(result).toEqual({ ok: false, error: { code: "invalid_request" } });
    expect(repo.findChallenge).not.toHaveBeenCalled();
    expect(verifier.verifyMessage).not.toHaveBeenCalled();
  });

  it("is not_found for a challenge that does not belong to the principal", async () => {
    const repo = repository({
      findChallenge: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } })
    });

    expect(await connectWallet({ repository: repo, signatures: signatures(), now: () => NOW }, { ownerUserId: OWNER, body }))
      .toEqual({ ok: false, error: { code: "not_found" } });
  });

  it("rejects a challenge that was already consumed", async () => {
    const repo = repository({
      findChallenge: vi.fn().mockResolvedValue({ ok: true, value: { ...challenge, consumedAt: "2026-10-04T12:01:00.000Z" } })
    });
    const verifier = signatures();

    const result = await connectWallet({ repository: repo, signatures: verifier, now: () => NOW }, { ownerUserId: OWNER, body });

    expect(result).toEqual({ ok: false, error: { code: "invalid_request" } });
    expect(repo.writePublicKey).not.toHaveBeenCalled();
    expect(repo.consumeChallenge).not.toHaveBeenCalled();
  });

  it("rejects an expired challenge", async () => {
    const repo = repository({
      findChallenge: vi.fn().mockResolvedValue({ ok: true, value: { ...challenge, expiresAt: "2026-10-04T11:59:00.000Z" } })
    });
    const verifier = signatures();

    expect(await connectWallet({ repository: repo, signatures: verifier, now: () => NOW }, { ownerUserId: OWNER, body }))
      .toEqual({ ok: false, error: { code: "invalid_request" } });
    expect(repo.writePublicKey).not.toHaveBeenCalled();
  });

  it("rejects a bad signature and never stores it", async () => {
    const repo = repository();

    const result = await connectWallet(
      { repository: repo, signatures: signatures(false), now: () => NOW },
      { ownerUserId: OWNER, body }
    );

    expect(result).toEqual({ ok: false, error: { code: "invalid_request" } });
    expect(repo.writePublicKey).not.toHaveBeenCalled();
    expect(repo.consumeChallenge).not.toHaveBeenCalled();
  });

  it("consumes the challenge before storing the key, so a failed consume stores nothing", async () => {
    const notFound = repository({
      consumeChallenge: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } })
    });

    expect(await connectWallet({ repository: notFound, signatures: signatures(), now: () => NOW }, { ownerUserId: OWNER, body }))
      .toEqual({ ok: false, error: { code: "invalid_request" } });
    expect(notFound.consumeChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(notFound.writePublicKey).not.toHaveBeenCalled();

    const unavailable = repository({
      consumeChallenge: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } })
    });

    expect(await connectWallet({ repository: unavailable, signatures: signatures(), now: () => NOW }, { ownerUserId: OWNER, body }))
      .toEqual({ ok: false, error: { code: "unavailable" } });
    expect(unavailable.writePublicKey).not.toHaveBeenCalled();
  });

  it("is unavailable when the frozen check fails, and neither consumes nor stores", async () => {
    const repo = repository({
      isFrozen: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } })
    });

    expect(await connectWallet({ repository: repo, signatures: signatures(), now: () => NOW }, { ownerUserId: OWNER, body }))
      .toEqual({ ok: false, error: { code: "unavailable" } });
    expect(repo.consumeChallenge).not.toHaveBeenCalled();
    expect(repo.writePublicKey).not.toHaveBeenCalled();
  });

  it("refuses to replace a frozen key with 409 semantics and never stores it", async () => {
    const repo = repository({ isFrozen: vi.fn().mockResolvedValue({ ok: true, value: true }) });

    const result = await connectWallet({ repository: repo, signatures: signatures(), now: () => NOW }, { ownerUserId: OWNER, body });

    expect(result).toEqual({ ok: false, error: { code: "frozen" } });
    expect(repo.writePublicKey).not.toHaveBeenCalled();
    expect(repo.consumeChallenge).not.toHaveBeenCalled();
  });

  it("is unavailable when a read fails, and never stores a key it could not check", async () => {
    const repo = repository({
      findChallenge: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } })
    });

    expect(await connectWallet({ repository: repo, signatures: signatures(), now: () => NOW }, { ownerUserId: OWNER, body }))
      .toEqual({ ok: false, error: { code: "unavailable" } });
    expect(repo.writePublicKey).not.toHaveBeenCalled();
  });

  it("maps a store invalid_request to invalid_request and an unavailable write to unavailable, leaving the challenge burned", async () => {
    const invalid = await connectWallet(
      {
        repository: repository({ writePublicKey: vi.fn().mockResolvedValue({ ok: false, error: { code: "invalid_request" } }) }),
        signatures: signatures(),
        now: () => NOW
      },
      { ownerUserId: OWNER, body }
    );
    expect(invalid).toEqual({ ok: false, error: { code: "invalid_request" } });

    const unavailableRepo = repository({
      writePublicKey: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } })
    });
    const unavailable = await connectWallet(
      { repository: unavailableRepo, signatures: signatures(), now: () => NOW },
      { ownerUserId: OWNER, body }
    );
    expect(unavailable).toEqual({ ok: false, error: { code: "unavailable" } });

    // The challenge was consumed before the failing write: it is burned on
    // purpose, so the caller must request a fresh one and cannot replay.
    expect(unavailableRepo.consumeChallenge).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(unavailableRepo.writePublicKey).toHaveBeenCalledTimes(1);
  });
});

describe("getWallet", () => {
  it("returns the stored key and the frozen flag for the principal", async () => {
    const repo = repository({ isFrozen: vi.fn().mockResolvedValue({ ok: true, value: true }) });

    expect(await getWallet({ repository: repo }, { ownerUserId: OWNER })).toEqual({
      ok: true,
      value: { publicKey: PUBLIC_KEY, frozen: true }
    });
    expect(repo.readPublicKey).toHaveBeenCalledWith(OWNER);
  });

  it("returns a null key when the principal has not connected a wallet", async () => {
    const repo = repository({ readPublicKey: vi.fn().mockResolvedValue({ ok: true, value: null }) });

    expect(await getWallet({ repository: repo }, { ownerUserId: OWNER })).toEqual({
      ok: true,
      value: { publicKey: null, frozen: false }
    });
  });

  it("treats a missing profile row as no key and is unavailable on a read failure", async () => {
    const missing = repository({ readPublicKey: vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } }) });
    expect(await getWallet({ repository: missing }, { ownerUserId: OWNER })).toEqual({
      ok: true,
      value: { publicKey: null, frozen: false }
    });

    const failing = repository({ readPublicKey: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) });
    expect(await getWallet({ repository: failing }, { ownerUserId: OWNER })).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });

  it("is unavailable when the frozen read fails", async () => {
    const repo = repository({ isFrozen: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) });

    expect(await getWallet({ repository: repo }, { ownerUserId: OWNER })).toEqual({
      ok: false,
      error: { code: "unavailable" }
    });
  });
});
