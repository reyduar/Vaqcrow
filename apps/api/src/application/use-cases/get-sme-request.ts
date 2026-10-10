import type { ApplicationId, ApplicationReviewState, SalesPeriodContract, SmeRequest } from "@vaqcrow/contracts";
import type { SalesDataProviderPort } from "../ports/sales-data-provider-port.js";
import type { SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";

/**
 * Reads the SME request of an application together with its monthly sales
 * series and its own review state (Feature #434, WU5). The series comes from
 * the sales-data provider keyed by the request's `smeReference`; a provider with
 * no feed for that reference yields a declared empty series, never a fabricated
 * one. The state is read from `application_review` by the repository, because
 * `sme_request` carries none — a read that cannot resolve it is `unavailable`
 * rather than a state the caller invents.
 */

export type GetSmeRequestResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly request: SmeRequest;
        readonly salesPeriods: readonly SalesPeriodContract[];
        readonly state: ApplicationReviewState;
      };
    }
  | { readonly ok: false; readonly error: { readonly code: "not_found" | "unavailable" } };

export interface GetSmeRequestDependencies {
  readonly repository: Pick<SmeRequestRepositoryPort, "findByApplicationId" | "findReviewStateByApplicationId">;
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

  // The request exists and is the caller's own, so the review row it was
  // created with must resolve; anything else is a read that cannot be
  // completed honestly.
  const reviewState = await dependencies.repository.findReviewStateByApplicationId(input.applicationId);
  if (!reviewState.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }

  const sales = await dependencies.salesData.getPeriods(found.value.request.smeReference);

  if (sales.ok) {
    return {
      ok: true,
      value: { request: found.value.request, salesPeriods: sales.value, state: reviewState.value }
    };
  }

  if (sales.error.code === "not_found") {
    return {
      ok: true,
      value: { request: found.value.request, salesPeriods: [], state: reviewState.value }
    };
  }

  return { ok: false, error: { code: "unavailable" } };
}
