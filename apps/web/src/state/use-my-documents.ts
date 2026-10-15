"use client";

import useSWR from "swr";
import type { MyDocument } from "@vaqcrow/contracts";
import type { ReadOutcome } from "@/application/company/submitted-data";
import type { MyDocumentsPort } from "@/application/ports/my-documents-port";

/**
 * Server state of the PyME's own uploaded documents (Feature #530, T5/S4), read
 * owner-scoped through `GET /pyme-documents/mine`.
 *
 * The three statuses are distinct on purpose: `loading` only while a real read
 * is in flight, `ok` for a resolved list — including an honest empty one — and
 * `failed` for a failure, a missing backend, or a disabled caller. A failed read
 * never becomes an invented empty list, and a missing backend is a failure, not
 * a perpetual "loading" (mirrors `use-my-application` / #480).
 */
export function useMyDocuments(
  port: MyDocumentsPort | null,
  enabled: boolean
): ReadOutcome<readonly MyDocument[]> {
  const active = port !== null && enabled;
  const { data, error, isLoading } = useSWR<readonly MyDocument[]>(
    active ? (["pyme-documents-mine"] as const) : null,
    async () => {
      const result = await (port as MyDocumentsPort).listMine();
      // A sanitized failure is a failed read; the error carries no provider text.
      if (!result.ok) throw new Error(result.code);
      return result.documents;
    },
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );

  if (!active || error !== undefined) return { status: "failed" };
  if (isLoading || data === undefined) return { status: "loading" };
  return { status: "ok", value: data };
}
