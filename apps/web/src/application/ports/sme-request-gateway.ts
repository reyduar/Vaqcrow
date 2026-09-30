import type { SmeRequest, SmeRequestRead, SmeRequestSubmission } from "@vaqcrow/contracts";

/** `POST /sme-requests` outcome: the created application and the stored request. */
export type SmeRequestSubmitted = SmeRequestSubmission;

/** `GET /sme-requests/:applicationId` outcome: the request and its sales series. */
export type SmeRequestCurrent = SmeRequestRead;

/**
 * Port for the SME request backend (`apps/api`, `sme-request.route.ts`).
 * Implementations must return contract-validated data and throw on anything
 * else.
 */
export interface SmeRequestGateway {
  submit(request: SmeRequest): Promise<SmeRequestSubmitted>;
  load(applicationId: string): Promise<SmeRequestCurrent>;
}
