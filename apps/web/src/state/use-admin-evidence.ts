"use client";

import type { AdminApplicationEvidence } from "@vaqcrow/contracts";
import { useCallback } from "react";
import useSWR from "swr";
import type { AdminEvidenceErrorCode, AdminEvidencePort } from "@/application/ports/admin-review-port";

/**
 * Server state of one application's Testnet evidence chain (#438 WU4), in SWR
 * keyed by the application id — the same shape as `useAdminReview`: the
 * sanitized failure code is surfaced (`not_found` has its own state, the rest
 * share the retryable error) and a failed read never leaves evidence behind.
 * A `null` port fetches nothing.
 */

class AdminEvidenceError extends Error {
  readonly code: AdminEvidenceErrorCode;

  constructor(code: AdminEvidenceErrorCode) {
    super(`admin evidence request failed: ${code}`);
    this.name = "AdminEvidenceError";
    this.code = code;
  }
}

async function load(port: AdminEvidencePort, applicationId: string): Promise<AdminApplicationEvidence> {
  const result = await port.getEvidence(applicationId);
  if (!result.ok) throw new AdminEvidenceError(result.code);
  return result.evidence;
}

export interface AdminEvidenceState {
  readonly evidence: AdminApplicationEvidence | null;
  readonly isLoading: boolean;
  readonly errorCode: AdminEvidenceErrorCode | null;
  readonly reload: () => void;
}

export function useAdminEvidence(port: AdminEvidencePort | null, applicationId: string): AdminEvidenceState {
  const { data, error, isLoading, mutate } = useSWR<AdminApplicationEvidence>(
    port ? ["admin-evidence", applicationId] : null,
    () => load(port as AdminEvidencePort, applicationId),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  const reload = useCallback(() => {
    void mutate();
  }, [mutate]);

  const errorCode: AdminEvidenceErrorCode | null =
    error === undefined ? null : error instanceof AdminEvidenceError ? error.code : "unavailable";

  return {
    evidence: error === undefined ? (data ?? null) : null,
    isLoading,
    errorCode,
    reload
  };
}
