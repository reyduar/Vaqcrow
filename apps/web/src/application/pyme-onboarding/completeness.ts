import type {
  CompletenessCheckInput,
  CompletenessFinding,
  CompletenessResult
} from "@/application/ports/completeness-check-port";
import { DOCUMENT_SLOTS, type DocumentsState, type PhotoState } from "./document-upload";
import { SALES_MONTHS, parseAmount } from "./registration-step";

/**
 * Pure model of the completeness check the PyME sees in wizard step 3
 * (Feature #402, Task #403 / T1c). React-free so the input mapping, the
 * finding labels and the notices are unit-tested without rendering.
 *
 * The rules themselves live ONCE, in the API (`POST /completeness-check`):
 * this module only maps the evidence the wizard already collected and turns
 * the API's structured findings into visible labels. It never re-derives a
 * finding, so the client cannot drift from the server (owner decision 4,
 * 2026-10-05: declared data and document presence).
 *
 * Copy here is new and flagged for owner approval; the per-finding `detail`
 * strings come from the API and are rendered verbatim.
 */

export const COMPLETENESS_COPY = Object.freeze({
  title: "Información completa",
  loading: "Revisando faltantes y anomalías…",
  incompleteNotice: "Faltan datos o hay anomalías. Podés enviar la solicitud igual: la persona revisora decide.",
  emptyNotice: "No encontramos faltantes ni anomalías.",
  errorMessage: "No pudimos revisar la información. Podés continuar igual."
});

/**
 * A month's ARS value as the check expects it: `null` when nothing was
 * declared (never `0`, which is a real value), otherwise the parsed amount.
 */
export function salesValueArs(raw: string): number | null {
  if (raw === "") return null;
  const value = parseAmount(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Maps the wizard's collected evidence onto the API's `POST /completeness-check`
 * body. The three mandatory slots are always sent with their presence; photos
 * that are not yet stored do not count.
 */
export function buildCompletenessInput(
  sales: readonly string[],
  documents: DocumentsState,
  photos: readonly PhotoState[]
): CompletenessCheckInput {
  return {
    documents: DOCUMENT_SLOTS.map((slot) => ({
      kind: slot.kind,
      present: documents[slot.kind].document !== null
    })),
    photoCount: photos.filter((photo) => photo.document !== null).length,
    salesMonths: sales.map((raw, index) => ({
      month: SALES_MONTHS[index] ?? `Mes ${index + 1}`,
      valueArs: salesValueArs(raw)
    }))
  };
}

/**
 * Visible label for a finding, so meaning is never carried by colour alone.
 * The label is keyed on the code, not inferred: a content-relevance finding
 * keeps its meaning (an irrelevant document is still a «Faltante») while a
 * sales anomaly is always «Anomalía» and an oversized photo set is an
 * «Aviso». Only `insufficient_photos` depends on its severity — a gap when no
 * photo was added, a warning when there are too many.
 */
export function findingLabel(finding: Pick<CompletenessFinding, "code" | "severity">): string {
  switch (finding.code) {
    case "sales_anomaly":
      return "Anomalía";
    case "content_unverified":
      return "Aviso";
    case "insufficient_photos":
      return finding.severity === "gap" ? "Faltante" : "Aviso";
    case "missing_document":
    case "missing_sales_month":
    case "content_irrelevant":
      return "Faltante";
  }
}

/**
 * The single notice under the findings: incomplete always warns (and never
 * blocks); a complete application with no findings confirms; a complete
 * application with only warnings stays quiet — the warnings speak for
 * themselves.
 */
export function completenessNotice(result: CompletenessResult): string | null {
  if (!result.complete) return COMPLETENESS_COPY.incompleteNotice;
  if (result.findings.length === 0) return COMPLETENESS_COPY.emptyNotice;
  return null;
}
