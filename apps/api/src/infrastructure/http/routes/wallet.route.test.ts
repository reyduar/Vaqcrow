import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WalletChallengeRecord, WalletRepositoryPort } from "../../../application/ports/wallet-repository-port.js";
import type { WalletSignaturePort } from "../../../application/ports/wallet-signature-port.js";
import { buildWalletChallengeMessage } from "../../../application/use-cases/wallet.js";
import { buildAppAs, principalFor } from "../test-support/auth.js";

const OWNER = principalFor("PYME").userId;
const CHALLENGE_ID = "11111111-1111-4111-8111-111111111111";
const NONCE = "22222222-2222-4222-8222-222222222222";
const PUBLIC_KEY = "GDCY3KGCN7CVU56HX4DJIMFXJT47LQTAPBFHDLJBNTO5GBMVMBZ7Y6O3";

const challenge: WalletChallengeRecord = {
  challengeId: CHALLENGE_ID,
  ownerUserId: OWNER,
  nonce: NONCE,
  // Far enough in the future that the real clock used by the route never expires it.
  expiresAt: "2999-01-01T00:00:00.000Z",
  consumedAt: null
};

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

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

function build(
  repo: Partial<WalletRepositoryPort> = {},
  verifier: WalletSignaturePort = signatures()
): FastifyInstance {
  app = buildAppAs("PYME", {
    wallet: {
      repository: { ...repository(), ...repo },
      signatures: verifier,
      generateChallengeId: () => CHALLENGE_ID,
      generateNonce: () => NONCE,
      ttlSeconds: 300
    }
  });
  return app;
}

const connectBody = { challengeId: CHALLENGE_ID, publicKey: PUBLIC_KEY, signature: "c2ln" };

describe("POST /profile/wallet/challenge", () => {
  it("issues a single-use challenge for the principal and returns the message to sign", async () => {
    const createChallenge = vi.fn().mockResolvedValue({ ok: true, value: challenge });

    const response = await build({ createChallenge }).inject({
      method: "POST",
      url: "/profile/wallet/challenge"
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ challengeId: CHALLENGE_ID, message: buildWalletChallengeMessage(NONCE) });
    expect(createChallenge).toHaveBeenCalledWith({
      challengeId: CHALLENGE_ID,
      ownerUserId: OWNER,
      nonce: NONCE,
      expiresAt: expect.any(String)
    });
  });

  it("answers 503 when the challenge cannot be stored", async () => {
    const createChallenge = vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } });

    const response = await build({ createChallenge }).inject({ method: "POST", url: "/profile/wallet/challenge" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });
});

describe("POST /profile/wallet", () => {
  it("verifies the signature and stores the key, answering with the stored key", async () => {
    const writePublicKey = vi.fn().mockResolvedValue({ ok: true, value: undefined });

    const response = await build({ writePublicKey }).inject({
      method: "POST",
      url: "/profile/wallet",
      payload: connectBody
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ publicKey: PUBLIC_KEY, frozen: false });
    expect(writePublicKey).toHaveBeenCalledWith({ ownerUserId: OWNER, publicKey: PUBLIC_KEY });
  });

  it("answers 400 for a malformed body and never verifies", async () => {
    const verifier = signatures();
    const response = await build({}, verifier).inject({
      method: "POST",
      url: "/profile/wallet",
      payload: { challengeId: CHALLENGE_ID, publicKey: "not-a-key", signature: "c2ln" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
    expect(verifier.verifyMessage).not.toHaveBeenCalled();
  });

  it("answers 400 when the signature does not verify", async () => {
    const response = await build({}, signatures(false)).inject({
      method: "POST",
      url: "/profile/wallet",
      payload: connectBody
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "invalid_request" });
  });

  it("answers 404 for a challenge that is not the principal's", async () => {
    const findChallenge = vi.fn().mockResolvedValue({ ok: false, error: { code: "not_found" } });

    const response = await build({ findChallenge }).inject({
      method: "POST",
      url: "/profile/wallet",
      payload: connectBody
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "not_found" });
  });

  it("answers 409 when the owner's key is frozen by a deployed vault", async () => {
    const isFrozen = vi.fn().mockResolvedValue({ ok: true, value: true });
    const writePublicKey = vi.fn();

    const response = await build({ isFrozen, writePublicKey }).inject({
      method: "POST",
      url: "/profile/wallet",
      payload: connectBody
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ code: "wallet_frozen" });
    expect(writePublicKey).not.toHaveBeenCalled();
  });

  it("answers 503 and never leaks provider text when persistence fails", async () => {
    const writePublicKey = vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable", message: "SECRET" } });

    const response = await build({ writePublicKey }).inject({
      method: "POST",
      url: "/profile/wallet",
      payload: connectBody
    });

    expect(response.statusCode).toBe(503);
    expect(response.body).toBe(JSON.stringify({ code: "unavailable" }));
    expect(response.body).not.toContain("SECRET");
  });
});

describe("GET /profile/wallet", () => {
  it("returns the stored key and frozen flag for the principal", async () => {
    const readPublicKey = vi.fn().mockResolvedValue({ ok: true, value: PUBLIC_KEY });
    const isFrozen = vi.fn().mockResolvedValue({ ok: true, value: true });

    const response = await build({ readPublicKey, isFrozen }).inject({ method: "GET", url: "/profile/wallet" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ publicKey: PUBLIC_KEY, frozen: true });
  });

  it("returns a null key when none is connected", async () => {
    const readPublicKey = vi.fn().mockResolvedValue({ ok: true, value: null });

    const response = await build({ readPublicKey }).inject({ method: "GET", url: "/profile/wallet" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ publicKey: null, frozen: false });
  });

  it("answers 503 when the wallet state cannot be read", async () => {
    const readPublicKey = vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } });

    const response = await build({ readPublicKey }).inject({ method: "GET", url: "/profile/wallet" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });
});

describe("wallet authorization", () => {
  it("denies a non-PYME role with 403 for every wallet route", async () => {
    for (const url of ["/profile/wallet/challenge", "/profile/wallet"] as const) {
      const other = buildAppAs("INVERSOR", {
        wallet: {
          repository: repository(),
          signatures: signatures(),
          generateChallengeId: () => CHALLENGE_ID,
          generateNonce: () => NONCE,
          ttlSeconds: 300
        }
      });
      try {
        const response = await other.inject({ method: "POST", url });
        expect(response.statusCode).toBe(403);
        expect(response.json()).toEqual({ code: "forbidden" });
      } finally {
        await other.close();
      }
    }
  });
});
