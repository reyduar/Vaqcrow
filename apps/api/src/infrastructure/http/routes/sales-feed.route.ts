import type { FastifyInstance } from "fastify";
import type { SalesDataProviderPort } from "../../../application/ports/sales-data-provider-port.js";

/**
 * The HTTP surface of the monthly sales feed (issue #83, Feature #26).
 *
 * The route owns exactly what the assessment route owns and nothing more:
 * the accepted key set, the status-code mapping, and the wire shape. Which
 * period comes next is the provider's decision, never the caller's — so the
 * POST body's exact key set is the EMPTY object: a body carrying any key at
 * all is refused with 400 before the provider is called, the same
 * "drifted body refused first" convention as `assessment.route.ts`.
 *
 * Status mapping follows the established replay convention
 * (`human-decision.route.ts`, `campaign.route.ts`): `201 applied:true` the
 * first time the next period is recorded, `200 applied:false` on idempotent
 * replay; `404` unknown business; `503` a sanitized `unavailable` for every
 * other provider failure — internal detail stays server-side and only the
 * typed code reaches the wire.
 *
 * Paths follow the sub-resource convention of
 * `/application-reviews/:applicationId/decisions`.
 */

// The empty set: the record-next body must be exactly `{}`.
const RECORD_BODY_KEYS: ReadonlySet<string> = new Set();

export interface SalesFeedRouteDependencies {
  readonly provider: SalesDataProviderPort;
}

function hasExactBodyKeys(
  input: unknown,
  allowed: ReadonlySet<string>
): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }

  const keys = Object.keys(input);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

export function registerSalesFeedRoute(
  app: FastifyInstance,
  dependencies: SalesFeedRouteDependencies
): void {
  app.get<{ Params: { businessId: string } }>(
    "/businesses/:businessId/sales-periods",
    async (request, reply) => {
      const result = await dependencies.provider.getPeriods(request.params.businessId);

      if (result.ok) {
        // Periods cross the wire exactly as the provider typed them —
        // `SalesPeriodContract`, including the optional per-datum provenance
        // the simulated feed always populates.
        return reply.code(200).send({
          businessId: request.params.businessId,
          periods: result.value
        });
      }

      switch (result.error.code) {
        case "not_found":
          return reply.code(404).send({ code: "not_found" });
        case "unavailable":
          return reply.code(503).send({ code: "unavailable" });
      }
    }
  );

  app.post<{ Params: { businessId: string }; Body: unknown }>(
    "/businesses/:businessId/sales-periods",
    async (request, reply) => {
      if (!hasExactBodyKeys(request.body, RECORD_BODY_KEYS)) {
        return reply.code(400).send({ code: "invalid_request" });
      }

      const result = await dependencies.provider.recordNextPeriod(request.params.businessId);

      if (result.ok) {
        return reply
          .code(result.value.applied ? 201 : 200)
          .send({ applied: result.value.applied, period: result.value.period });
      }

      switch (result.error.code) {
        case "not_found":
          return reply.code(404).send({ code: "not_found" });
        case "unavailable":
          return reply.code(503).send({ code: "unavailable" });
      }
    }
  );
}
