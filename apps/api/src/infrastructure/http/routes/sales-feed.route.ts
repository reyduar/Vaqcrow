import type { FastifyInstance } from "fastify";
import type { BusinessRepositoryPort } from "../../../application/ports/business-repository-port.js";
import type { SalesDataProviderPort } from "../../../application/ports/sales-data-provider-port.js";
import type { SalesPeriodRepositoryPort } from "../../../application/ports/sales-period-repository-port.js";
import { toSalesPeriodRecords } from "../../adapters/supabase-sales-period-repository.js";

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
 * R1-002: a `PYME` may only read or record the sales of a business it owns. The
 * business is checked against the authenticated principal before the provider
 * is called, and a business the caller does not own is reported as `404` (never
 * another owner's data). `ADMIN` keeps its existing unrestricted read.
 *
 * Paths follow the sub-resource convention of
 * `/application-reviews/:applicationId/decisions`.
 */

// The empty set: the record-next body must be exactly `{}`.
const RECORD_BODY_KEYS: ReadonlySet<string> = new Set();

export interface SalesFeedRouteDependencies {
  readonly provider: SalesDataProviderPort;
  /** The ownership check the `PYME` path runs before serving any series. */
  readonly businesses: Pick<BusinessRepositoryPort, "findOwnedById">;
  /**
   * The persisted series the campaign detail reads (#422/WU2b). Optional so the
   * route still works where no detail read model is wired; when present, a
   * successful record re-persists the provider's series so the PyME's feed and
   * the detail never diverge.
   */
  readonly salesPeriods?: Pick<SalesPeriodRepositoryPort, "saveForBusiness">;
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

interface OwnershipDenial {
  readonly status: 401 | 404 | 503;
  readonly body: { readonly code: "unauthenticated" | "not_found" | "unavailable" };
}

/**
 * Returns `undefined` when the caller may serve the business, or the sanitized
 * denial when it may not. An absent owner or a `not_found` ownership read is a
 * `404`; an unavailable check is a `503`; a missing principal is a `401`.
 */
async function ownershipDenial(
  dependencies: SalesFeedRouteDependencies,
  principal: { readonly userId: string; readonly role: string } | undefined,
  businessId: string
): Promise<OwnershipDenial | undefined> {
  if (principal === undefined) {
    return { status: 401, body: { code: "unauthenticated" } };
  }
  if (principal.role !== "PYME") {
    return undefined;
  }

  const owned = await dependencies.businesses.findOwnedById({
    ownerUserId: principal.userId,
    businessId
  });

  if (owned.ok) {
    return undefined;
  }

  return owned.error.code === "not_found"
    ? { status: 404, body: { code: "not_found" } }
    : { status: 503, body: { code: "unavailable" } };
}

export function registerSalesFeedRoute(
  app: FastifyInstance,
  dependencies: SalesFeedRouteDependencies
): void {
  app.get<{ Params: { businessId: string } }>(
    "/businesses/:businessId/sales-periods",
    async (request, reply) => {
      const denial = await ownershipDenial(
        dependencies,
        request.principal,
        request.params.businessId
      );
      if (denial !== undefined) {
        return reply.code(denial.status).send(denial.body);
      }

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

      const denial = await ownershipDenial(
        dependencies,
        request.principal,
        request.params.businessId
      );
      if (denial !== undefined) {
        return reply.code(denial.status).send(denial.body);
      }

      const result = await dependencies.provider.recordNextPeriod(request.params.businessId);

      if (result.ok) {
        // A recorded month advances the in-memory provider, so the persisted
        // series the campaign detail reads (#422/WU2b) must advance with it or
        // the two surfaces diverge. Best-effort: the record already succeeded,
        // so a persistence failure never fails the response.
        if (result.value.applied && dependencies.salesPeriods) {
          const series = await dependencies.provider.getPeriods(request.params.businessId);
          if (series.ok) {
            await dependencies.salesPeriods.saveForBusiness({
              businessId: request.params.businessId,
              periods: toSalesPeriodRecords(series.value)
            });
          }
        }

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
