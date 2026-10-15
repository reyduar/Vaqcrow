import type { ApplicationId, ApplicationReviewState } from "@vaqcrow/contracts";
import type { SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";

/**
 * Resolves the caller's own latest application and its real review state
 * (Feature #530, T1).
 *
 * The caller is always the verified principal: the use case reads the owner's
 * requests through `findByOwner(input.ownerUserId)` — never a client-supplied
 * id — and reports its newest one. An owner with no request is an honest
 * `null`, never an invented row; a read that cannot complete is `unavailable`
 * rather than a state the caller fabricates.
 */

export interface GetMyApplicationDependencies {
  readonly repository: Pick<SmeRequestRepositoryPort, "findByOwner" | "findReviewStateByApplicationId">;
}

export type GetMyApplicationResult =
  | {
      readonly ok: true;
      readonly value: { readonly applicationId: ApplicationId; readonly state: ApplicationReviewState } | null;
    }
  | { readonly ok: false; readonly error: { readonly code: "unavailable" } };

export async function getMyApplication(
  dependencies: GetMyApplicationDependencies,
  input: { readonly ownerUserId: string }
): Promise<GetMyApplicationResult> {
  const found = await dependencies.repository.findByOwner(input.ownerUserId);
  if (!found.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }

  // `findByOwner` returns the owner's requests newest first, so the first one is
  // the current application. No request is an absence, not an error.
  const latest = found.value[0];
  if (latest === undefined) {
    return { ok: true, value: null };
  }

  // The request exists and is the caller's own, so its review row must resolve;
  // anything else is a read that cannot be completed honestly.
  const state = await dependencies.repository.findReviewStateByApplicationId(latest.applicationId);
  if (!state.ok) {
    return { ok: false, error: { code: "unavailable" } };
  }

  return { ok: true, value: { applicationId: latest.applicationId, state: state.value } };
}
