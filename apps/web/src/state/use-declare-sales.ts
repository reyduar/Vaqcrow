"use client";

import { useCallback, useRef, useState } from "react";
import type { BusinessPort } from "@/application/ports/business-port";
import type {
  SalesDeclarationErrorCode,
  SalesDeclarationPeriod,
  SalesDeclarationPort
} from "@/application/ports/sales-declaration-port";

/**
 * Owns one monthly sales declaration (Feature #434, WU3): resolve the signed-in
 * PyME's business, POST the declared periods, and — on success — signal the
 * dashboard to reload. Nothing is thrown to the component; every failure is a
 * sanitized code in `errorCode`.
 *
 * The business id is never assumed: it is read from `GET /businesses/mine`
 * through the injected `BusinessPort`, so the declaration targets a company the
 * API verifies against the session's principal. A double submit is refused by
 * an in-flight guard.
 */

export type DeclareSalesStatus = "idle" | "submitting" | "submitted" | "failed";

/** `no_business` is the web's own code for "the owner has no registered company". */
export type DeclareSalesErrorCode = SalesDeclarationErrorCode | "no_business";

export interface DeclareSalesState {
  readonly status: DeclareSalesStatus;
  readonly errorCode: DeclareSalesErrorCode | null;
  readonly submit: (periods: readonly SalesDeclarationPeriod[]) => Promise<void>;
  readonly reset: () => void;
}

export function useDeclareSales(
  port: SalesDeclarationPort | null,
  business: BusinessPort | null,
  onSubmitted?: () => void
): DeclareSalesState {
  const inFlight = useRef(false);
  const [status, setStatus] = useState<DeclareSalesStatus>("idle");
  const [errorCode, setErrorCode] = useState<DeclareSalesErrorCode | null>(null);

  const submit = useCallback(
    async (periods: readonly SalesDeclarationPeriod[]) => {
      if (inFlight.current) return;
      if (!port || !business) {
        setStatus("failed");
        setErrorCode("unavailable");
        return;
      }

      inFlight.current = true;
      setStatus("submitting");
      setErrorCode(null);
      try {
        const owned = await business.getMyBusiness();
        if (!owned.ok) {
          setStatus("failed");
          setErrorCode(owned.code === "not_found" ? "no_business" : owned.code === "unauthorized" ? "unauthenticated" : owned.code === "network" ? "network" : "unavailable");
          return;
        }

        const result = await port.declare(owned.business.businessId, periods);
        if (result.ok) {
          setStatus("submitted");
          onSubmitted?.();
          return;
        }

        setStatus("failed");
        setErrorCode(result.code);
      } finally {
        inFlight.current = false;
      }
    },
    [port, business, onSubmitted]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setErrorCode(null);
  }, []);

  return { status, errorCode, submit, reset };
}
