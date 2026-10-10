import type { AdminApplicationEvidence, ApplicationId } from "@vaqcrow/contracts";

/**
 * The ADMIN per-application Testnet evidence chain (#438/WU2), as the route
 * serves it: the wire shape of `@vaqcrow/contracts`, already JSON-safe (stroops
 * as decimal strings, explorer links built by the API).
 */
export type AdminApplicationEvidenceResult =
  | { readonly ok: true; readonly value: AdminApplicationEvidence }
  | { readonly ok: false; readonly error: { readonly code: "not_found" | "unavailable" } };

export interface AdminApplicationEvidencePort {
  get(applicationId: ApplicationId): Promise<AdminApplicationEvidenceResult>;
}
