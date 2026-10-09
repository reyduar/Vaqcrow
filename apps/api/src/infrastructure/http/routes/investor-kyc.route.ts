import type { FastifyInstance } from "fastify";
import type { InvestorKycRepositoryPort } from "../../../application/ports/investor-kyc-repository-port.js";
import { approveInvestorKyc } from "../../../application/use-cases/approve-investor-kyc.js";
import { getInvestorKyc } from "../../../application/use-cases/get-investor-kyc.js";

/**
 * The investor's simulated KYC surface (Feature #422, WU4).
 *
 * `GET /investor-kyc` reads the signed-in caller's verification state;
 * `POST /investor-kyc` records the simulated, auto-approved verification at the
 * first contribution. Both are `AUTHENTICATED` for any role (see
 * `route-policy.ts`), and the owner is always `request.principal.userId` — a
 * body- or query-supplied user is ignored, so a caller can only ever touch its
 * own record.
 *
 * `GET` never errors on a missing record: it answers `approved: false` with a
 * `null` date. `POST` is idempotent — a replay answers 200 with the existing
 * record, a first call answers 201; `created` is a status detail, never a body
 * field (the contract is strict). Every failure is a sanitized body: a
 * repository that reports `unavailable` is a `503 { code: "unavailable" }`,
 * never a 200 that would falsely confirm the state.
 */

export interface InvestorKycRouteDependencies {
  readonly kyc: InvestorKycRepositoryPort;
}

export function registerInvestorKycRoute(app: FastifyInstance, dependencies: InvestorKycRouteDependencies): void {
  app.get("/investor-kyc", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await getInvestorKyc({ kyc: dependencies.kyc }, principal.userId);
    if (!result.ok) {
      return reply.code(503).send({ code: "unavailable" });
    }

    return reply.code(200).send(result.value);
  });

  app.post("/investor-kyc", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const result = await approveInvestorKyc({ kyc: dependencies.kyc }, principal.userId);
    if (!result.ok) {
      return reply.code(503).send({ code: "unavailable" });
    }

    const { created, ...status } = result.value;
    return reply.code(created ? 201 : 200).send(status);
  });
}
