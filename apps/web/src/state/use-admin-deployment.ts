"use client";

import { useCallback, useRef, useState } from "react";
import useSWR from "swr";
import type { ApplicationReviewState } from "@vaqcrow/contracts";
import { deployFailureMessage, deploymentShouldPoll, type DeploymentRead } from "@/application/admin/deployment";
import type { AdminReviewPort } from "@/application/ports/admin-review-port";

/**
 * Server state of the review's deployment panel (#410 / U6, D3).
 *
 * SWR holds the read keyed by application and review state, so an approval
 * recorded in this view (the review reloads into `approved`) reads again. A
 * 404 is the `missing` read, not an error. SWR polls every `pollIntervalMs`
 * only while the deployment is `pending`/`deploying`; a confirmed, failed or
 * missing read, an unmounted panel or a hidden tab stop it.
 *
 * `retry` is the D3 Reintentar: one `POST …/deployment` at a time (a ref
 * guards double presses before React re-renders), then it revalidates the
 * panel and the review context. A refusal keeps an honest message; it never
 * claims a confirmed vault.
 */

export const DEFAULT_DEPLOYMENT_POLL_MS = 4000;

type ReadErrorCode = "unavailable" | "network";

class DeploymentReadError extends Error {
  readonly code: ReadErrorCode;

  constructor(code: ReadErrorCode) {
    super(`deployment read failed: ${code}`);
    this.name = "DeploymentReadError";
    this.code = code;
  }
}

async function load(port: AdminReviewPort, applicationId: string): Promise<DeploymentRead> {
  const result = await port.getDeployment(applicationId);
  if (result.ok) return { kind: "record", deployment: result.deployment };
  if (result.code === "not_found") return { kind: "missing" };
  throw new DeploymentReadError(result.code);
}

export interface AdminDeploymentOptions {
  /** Re-reads the review context after a retry. */
  readonly reload: () => void;
  /** Injected in tests; defaults to a few seconds. */
  readonly pollIntervalMs?: number;
}

export interface AdminDeploymentState {
  readonly read: DeploymentRead | undefined;
  readonly errorCode: ReadErrorCode | null;
  readonly isLoading: boolean;
  readonly retrying: boolean;
  readonly message: string | null;
  readonly retry: () => Promise<void>;
  readonly refresh: () => void;
}

export function useAdminDeployment(
  port: AdminReviewPort | null,
  applicationId: string,
  reviewState: ApplicationReviewState,
  { reload, pollIntervalMs = DEFAULT_DEPLOYMENT_POLL_MS }: AdminDeploymentOptions
): AdminDeploymentState {
  const { data, error, isLoading, mutate } = useSWR<DeploymentRead>(
    port ? ["admin-deployment", applicationId, reviewState] : null,
    () => load(port as AdminReviewPort, applicationId),
    {
      shouldRetryOnError: false,
      revalidateOnFocus: false,
      refreshInterval: (latest) => (deploymentShouldPoll(latest) ? pollIntervalMs : 0)
    }
  );
  const inFlight = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void mutate();
  }, [mutate]);

  const retry = useCallback(async () => {
    if (!port || inFlight.current) return;
    inFlight.current = true;
    setRetrying(true);
    setMessage(null);
    try {
      const result = await port.deploy(applicationId);
      setMessage(result.ok ? null : deployFailureMessage(result.code));
      await mutate();
    } finally {
      inFlight.current = false;
      setRetrying(false);
      reload();
    }
  }, [port, applicationId, mutate, reload]);

  const errorCode: ReadErrorCode | null =
    error === undefined ? null : error instanceof DeploymentReadError ? error.code : "unavailable";

  return { read: data, errorCode, isLoading, retrying, message, retry, refresh };
}
