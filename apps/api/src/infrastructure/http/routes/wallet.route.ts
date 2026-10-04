import type { FastifyInstance } from "fastify";
import type { WalletRepositoryPort } from "../../../application/ports/wallet-repository-port.js";
import type { WalletSignaturePort } from "../../../application/ports/wallet-signature-port.js";
import { connectWallet, getWallet, issueWalletChallenge } from "../../../application/use-cases/wallet.js";

/**
 * The HTTP surface of the PyME Freighter wallet (Feature #406, Task #407 / T1b).
 *
 * `POST /profile/wallet/challenge` issues the single-use message the client
 * signs with Freighter (`201 { challengeId, message }`). `POST /profile/wallet`
 * verifies the signature and stores the public key (`200
 * { publicKey, frozen: false }`). `GET /profile/wallet` reads the stored key and
 * whether it is frozen (`200 { publicKey, frozen }`).
 *
 * All three require `PYME` (see `route-policy.ts`) and take the owner from
 * `request.principal.userId` — never from the body. Every failure is a
 * sanitized `{ code }`: `400` invalid request, `404` unknown/foreign challenge,
 * `409` frozen, `503` persistence.
 */

export interface WalletRouteDependencies {
  readonly repository: WalletRepositoryPort;
  readonly signatures: WalletSignaturePort;
  /** Injected so tests are deterministic; `index.ts` passes `crypto.randomUUID`. */
  readonly generateChallengeId: () => string;
  readonly generateNonce: () => string;
  readonly ttlSeconds: number;
}

export function registerWalletRoute(app: FastifyInstance, dependencies: WalletRouteDependencies): void {
  app.post("/profile/wallet/challenge", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await issueWalletChallenge(
      {
        repository: dependencies.repository,
        generateChallengeId: dependencies.generateChallengeId,
        generateNonce: dependencies.generateNonce,
        ttlSeconds: dependencies.ttlSeconds
      },
      { ownerUserId: principal.userId }
    );

    if (result.ok) {
      return reply.code(201).send(result.value);
    }

    return result.error.code === "invalid_request"
      ? reply.code(400).send({ code: "invalid_request" })
      : reply.code(503).send({ code: "unavailable" });
  });

  app.post<{ Body: unknown }>("/profile/wallet", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await connectWallet(
      {
        repository: dependencies.repository,
        signatures: dependencies.signatures
      },
      { ownerUserId: principal.userId, body: request.body }
    );

    if (result.ok) {
      return reply.code(200).send(result.value);
    }

    switch (result.error.code) {
      case "invalid_request":
        return reply.code(400).send({ code: "invalid_request" });
      case "not_found":
        return reply.code(404).send({ code: "not_found" });
      case "frozen":
        return reply.code(409).send({ code: "wallet_frozen" });
      default:
        return reply.code(503).send({ code: "unavailable" });
    }
  });

  app.get("/profile/wallet", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await getWallet({ repository: dependencies.repository }, { ownerUserId: principal.userId });

    if (result.ok) {
      return reply.code(200).send(result.value);
    }

    return reply.code(503).send({ code: "unavailable" });
  });
}
