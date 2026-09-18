import type { SalesPeriodContract, SmeRequest } from "@vaqcrow/contracts";

/** Server-held state for the current SME request. */
export interface SmeRequestCurrent {
  readonly request: SmeRequest | null;
  readonly salesPeriods: readonly SalesPeriodContract[];
}

/**
 * Port for the SME request backend. NOTE: `apps/api` exposes no SME endpoint
 * yet; the HTTP adapter uses documented placeholder paths (see
 * `infrastructure/sme/http-sme-request-gateway.ts`). Implementations must
 * return contract-validated data and throw on anything else.
 */
export interface SmeRequestGateway {
  submit(request: SmeRequest): Promise<SmeRequest>;
  loadCurrent(): Promise<SmeRequestCurrent>;
}
