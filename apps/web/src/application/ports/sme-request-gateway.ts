import type { MyApplication, SmeRequest, SmeRequestRead, SmeRequestSubmission } from "@vaqcrow/contracts";

/** `POST /sme-requests` outcome: the created application and the stored request. */
export type SmeRequestSubmitted = SmeRequestSubmission;

/** `GET /sme-requests/:applicationId` outcome: the request, its sales series and the application's review state. */
export type SmeRequestCurrent = SmeRequestRead;

/**
 * Sanitized failure codes of the owner-scoped `loadMine` read, mirroring
 * `MyCampaignsErrorCode`: 401/403 are the session's `unauthenticated`, every
 * other non-200 the sanitized `unavailable`, and a transport failure `network`.
 * A failure is never collapsed into a fabricated application.
 */
export type SmeRequestErrorCode = "unauthenticated" | "unavailable" | "network";

/**
 * `GET /sme-requests/mine` outcome (Feature #530, S6): the caller's own
 * application — its server-generated id and its real review state — or a
 * resolved absence (`application: null`), never a fabricated row. The API
 * resolves the principal server-side, so a foreign application is an absence,
 * never another owner's data.
 */
export type MyApplicationOutcome =
  | { readonly ok: true; readonly application: MyApplication | null }
  | { readonly ok: false; readonly code: SmeRequestErrorCode };

/**
 * Port for the SME request backend (`apps/api`, `sme-request.route.ts`).
 * Implementations must return contract-validated data and throw on anything
 * else.
 */
export interface SmeRequestGateway {
  submit(request: SmeRequest): Promise<SmeRequestSubmitted>;
  load(applicationId: string): Promise<SmeRequestCurrent>;
  /**
   * Owner-scoped read of the signed-in PyME's own application, so the
   * post-submission state is known in a fresh session and not only from an
   * in-session submit (S6). Never throws: a failure is a sanitized code.
   */
  loadMine(): Promise<MyApplicationOutcome>;
}
