import type { FastifyInstance } from "fastify";
import { declaredSalesRequestSchema } from "@vaqcrow/contracts";
import type { BusinessRepositoryPort } from "../../../application/ports/business-repository-port.js";
import type { SalesDataProviderPort } from "../../../application/ports/sales-data-provider-port.js";
import type { SalesPeriodRepositoryPort } from "../../../application/ports/sales-period-repository-port.js";
import { RecordDeclaredSales } from "../../../application/use-cases/record-declared-sales.js";
import { toSalesPeriodRecords } from "../../adapters/supabase-sales-period-repository.js";

/**
 * The HTTP surface of the monthly sales feed (issue #83, Feature #26; extended
 * by the PyME sales declaration, Feature #434/WU1b).
 *
 * The route owns exactly what the assessment route owns and nothing more:
 * the accepted key set, the status-code mapping, and the wire shape. Two POST
 * paths share the route, per owner decision D1:
 *
 *   * The demo refresh — the body's exact key set is the EMPTY object: a
 *     body carrying any key at all is refused with 400 before the provider is
 *     called, the same "drifted body refused first" convention as
 *     `assessment.route.ts`. Which period comes next is the provider's
 *     decision, never the caller's.
 *   * The declared path (#434/WU1b) — the body is a `declaredSalesRequestSchema`
 *     payload (`{ periods: [{ period, salesArs }] }`): the PyME declares its own
 *     whole-ARS amounts (or `null` for a missing month, never 0), which are
 *     classified by the documented anomaly rule in `record-declared-sales.ts`
 *     and persisted through the shared sales-period port with `source:
 *     "declared"`. An invalid payload is 400; a valid one whose persistence is
 *     unavailable (or whose writer is not wired) is a sanitized 503.
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
   * successful demo record re-persists the provider's series so the PyME's feed
   * and the detail never diverge, AND the declared path (#434/WU1b) has the
   * writer it needs. When absent, a declared payload is a sanitized 503.
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
  // The declared path persists through the shared sales-period port; it is only
  // available where that writer is wired, and its absence is an honest 503
  // rather than a silent demo fallback.
  const declaredSales =
    dependencies.salesPeriods === undefined
      ? undefined
      : new RecordDeclaredSales(dependencies.salesPeriods);

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
      // Anything that is not exactly `{}` is a declared-sales attempt: parse it
      // strictly first (so a drifted body is refused before any side effect),
      // then run the same ownership check the demo path runs.
      if (!hasExactBodyKeys(request.body, RECORD_BODY_KEYS)) {
        const parsed = declaredSalesRequestSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.code(400).send({ code: "invalid_request" });
        }

        const declaredDenial = await ownershipDenial(
          dependencies,
          request.principal,
          request.params.businessId
        );
        if (declaredDenial !== undefined) {
          return reply.code(declaredDenial.status).send(declaredDenial.body);
        }

        if (declaredSales === undefined) {
          return reply.code(503).send({ code: "unavailable" });
        }

        const declared = await declaredSales.execute({
          businessId: request.params.businessId,
          periods: parsed.data.periods
        });

        if (!declared.ok) {
          return reply.code(503).send({ code: "unavailable" });
        }

        return reply.code(200).send({
          businessId: request.params.businessId,
          periods: declared.value.map((record) => ({
            period: record.period,
            amountArs: record.salesArs === null ? null : Number(record.salesArs),
            status: record.status,
            source: record.source
          }))
        });
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
