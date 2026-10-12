"use client";

import { useCallback } from "react";
import useSWR from "swr";
import type { AdminQueuePage, AdminQueuePort, AdminQueueQuery, AdminQueueErrorCode } from "@/application/ports/admin-queue-port";

/**
 * Server state of the admin PyMEs queue (Feature #386 / T3).
 *
 * One page lives in SWR, keyed by the resolved query, so paging, sorting and
 * searching each re-read through the port and the cache follows the exact
 * request. A `null` port (no backend) fetches nothing.
 *
 * The sanitized failure code is not surfaced from here: the queue has a single
 * error surface, and `loadFailed` plus `reload()` is all it needs. Nothing is
 * re-derived from a failed read — the page is `null`, never an empty page.
 */

/** Sanitized load failure; the code is already provider-free. */
class AdminQueueError extends Error {
  readonly code: AdminQueueErrorCode;

  constructor(code: AdminQueueErrorCode) {
    super(`admin queue request failed: ${code}`);
    this.name = "AdminQueueError";
    this.code = code;
  }
}

async function load(port: AdminQueuePort, query: AdminQueueQuery): Promise<AdminQueuePage> {
  const result = await port.list(query);
  if (!result.ok) throw new AdminQueueError(result.code);
  return result.page;
}

export interface AdminQueueState {
  readonly page: AdminQueuePage | null;
  readonly isLoading: boolean;
  readonly loadFailed: boolean;
  /** The sanitized failure code (`not_configured` is not a service failure; #480). */
  readonly loadErrorCode: AdminQueueErrorCode | null;
  readonly reload: () => void;
}

export function useAdminQueue(port: AdminQueuePort | null, query: AdminQueueQuery): AdminQueueState {
  const { data, error, isLoading, mutate } = useSWR<AdminQueuePage>(
    port ? ["admin-queue", query] : null,
    () => load(port as AdminQueuePort, query),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  const reload = useCallback(() => {
    void mutate();
  }, [mutate]);

  const loadErrorCode: AdminQueueErrorCode | null =
    error === undefined ? null : error instanceof AdminQueueError ? error.code : "unavailable";

  return {
    page: data ?? null,
    isLoading,
    loadFailed: error !== undefined,
    loadErrorCode,
    reload
  };
}
