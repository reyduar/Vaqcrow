"use client";

import { useCallback } from "react";
import useSWR from "swr";
import type {
  AdminReviewContext,
  AdminReviewErrorCode,
  AdminReviewPort
} from "@/application/ports/admin-review-port";

/**
 * Server state of one admin review (Feature #410 / U2).
 *
 * The context lives in SWR keyed by the application id. Unlike the queue, the
 * sanitized failure code is surfaced: `not_found` has its own state with no
 * retry, while `unavailable`/`network` share the retryable error. A failed read
 * never leaves a context behind. A `null` port fetches nothing.
 */

class AdminReviewError extends Error {
  readonly code: AdminReviewErrorCode;

  constructor(code: AdminReviewErrorCode) {
    super(`admin review request failed: ${code}`);
    this.name = "AdminReviewError";
    this.code = code;
  }
}

async function load(port: AdminReviewPort, applicationId: string): Promise<AdminReviewContext> {
  const result = await port.getContext(applicationId);
  if (!result.ok) throw new AdminReviewError(result.code);
  return result.context;
}

export interface AdminReviewState {
  readonly context: AdminReviewContext | null;
  readonly isLoading: boolean;
  readonly errorCode: AdminReviewErrorCode | null;
  readonly reload: () => void;
}

export function useAdminReview(port: AdminReviewPort | null, applicationId: string): AdminReviewState {
  const { data, error, isLoading, mutate } = useSWR<AdminReviewContext>(
    port ? ["admin-review", applicationId] : null,
    () => load(port as AdminReviewPort, applicationId),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  const reload = useCallback(() => {
    void mutate();
  }, [mutate]);

  const errorCode: AdminReviewErrorCode | null =
    error === undefined ? null : error instanceof AdminReviewError ? error.code : "unavailable";

  return {
    context: error === undefined ? (data ?? null) : null,
    isLoading,
    errorCode,
    reload
  };
}
