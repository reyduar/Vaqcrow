import type { ApplicationId, SalesPeriodContract, SmeRequest } from "@vaqcrow/contracts";
import type { SalesDataProviderPort } from "../ports/sales-data-provider-port.js";
import type { SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";

/**
 * Reads the SME request of an application together with its monthly sales
 * series. The series comes from the sales-data provider keyed by the request's
 * `smeReference`; a provider with no feed for that reference yields a declared
 * empty series, never a fabricated one.
 */

export type GetSmeRequestResult =
  | {
      readonly ok: true;
      readonly value: { readonly request: SmeRequest; readonly salesPeriods: readonly SalesPeriodContract[] };
    }
  | { readonly ok: false; readonly error: { readonly code: "not_found" | "unavailable" } };

export interface GetSmeRequestDependencies {
  readonly repository: Pick<SmeRequestRepositoryPort, "findByApplicationId">;
  readonly salesData: Pick<SalesDataProviderPort, "getPeriods">;
}

export async function getSmeRequest(
  dependencies: GetSmeRequestDependencies,
  input: { readonly applicationId: ApplicationId; readonly ownerUserId: string }
): Promise<GetSmeRequestResult> {
  const found = await dependencies.repository.findByApplicationId(input.applicationId);

  if (!found.ok) {
    return { ok: false, error: { code: found.error.code === "not_found" ? "not_found" : "unavailable" } };
  }

  // R1-002: a request that is not the caller's own is reported as absent. An
  // absent owner (a row that predates ownership) can never match.
  if (found.value.ownerUserId !== input.ownerUserId) {
    return { ok: false, error: { code: "not_found" } };
  }

  const sales = await dependencies.salesData.getPeriods(found.value.request.smeReference);

  if (sales.ok) {
    return { ok: true, value: { request: found.value.request, salesPeriods: sales.value } };
  }

  if (sales.error.code === "not_found") {
    return { ok: true, value: { request: found.value.request, salesPeriods: [] } };
  }

  return { ok: false, error: { code: "unavailable" } };
}
