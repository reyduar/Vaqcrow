import type { MyDocument, PymeDocumentKind, SmeRequestRead } from "@vaqcrow/contracts";
import { DOCUMENT_SLOTS, formatFileSize } from "@/application/pyme-onboarding/document-upload";
import type { BusinessRecord } from "@/application/ports/business-port";
import { formatArsAmount, formatMonthYear } from "./format";

/**
 * Pure, React-free view-model of the PyME's own submitted data (Feature #530,
 * T5/S4). It shapes the persisted facts — the company, the request with its
 * declared sales months, and the uploaded documents' metadata — into the blocks
 * the read-only «Ver lo enviado» panel renders, so the shaping and its honesty
 * are unit-tested without rendering.
 *
 * It is deliberately blind to anything simulated: the input carries only
 * persisted records, so the onboarding wizard's simulated AI risk band has no
 * field to travel through and can never be presented as part of what was
 * submitted (S4). Each read is independent, so one failing read only degrades
 * its own block(s) with an honest message and never invents the others' rows.
 */

/**
 * One read's outcome as a panel can observe it: still loading, resolved to a
 * value, or failed. A failure is never collapsed into a fabricated value.
 */
export type ReadOutcome<T> =
  | { readonly status: "loading" }
  | { readonly status: "ok"; readonly value: T }
  | { readonly status: "failed" };

export interface SubmittedField {
  readonly label: string;
  readonly value: string;
}

export type SubmittedBlockKey = "company" | "request" | "sales" | "documents";

export type SubmittedBlockState = "loading" | "ready" | "failed";

export interface SubmittedBlock {
  readonly key: SubmittedBlockKey;
  readonly title: string;
  readonly state: SubmittedBlockState;
  readonly fields: readonly SubmittedField[];
  /** An honest per-block message — a failure, or the empty-state note; null when fields render. */
  readonly message: string | null;
}

export interface SubmittedDataReads {
  readonly business: ReadOutcome<BusinessRecord>;
  readonly request: ReadOutcome<SmeRequestRead>;
  readonly documents: ReadOutcome<readonly MyDocument[]>;
}

/**
 * Owner-visible copy of the read-only panel. The template does not design this
 * view, so the copy is neutral Spanish (voseo) and owner-pending. It never
 * promises a return, never claims a decision, and never presents a simulated
 * value as submitted.
 */
export const SUBMITTED_DATA_COPY = Object.freeze({
  /** The `/company` action label (owner request 2026-10-15, verbatim). */
  openLabel: "Ver lo enviado",
  heading: "Lo que enviaste",
  intro: "Estos son los datos guardados con tu solicitud. Es una vista de solo lectura.",
  close: "Volver a Mi campaña",
  regionLabel: "Datos enviados de tu solicitud",
  loading: "Cargando…",
  companyTitle: "Empresa",
  requestTitle: "Solicitud",
  salesTitle: "Ventas declaradas",
  documentsTitle: "Documentos",
  companyFailure: "No pudimos leer los datos de tu empresa.",
  requestFailure: "No pudimos leer tu solicitud.",
  salesFailure: "No pudimos leer las ventas declaradas.",
  documentsFailure: "No pudimos leer los documentos cargados.",
  salesEmpty: "La solicitud no tiene ventas declaradas.",
  documentsEmpty: "No hay documentos cargados.",
  sinDato: "Sin dato",
  fields: Object.freeze({
    name: "Nombre",
    sector: "Sector",
    city: "Ciudad",
    goal: "Objetivo",
    reference: "Referencia",
    total: "Total solicitado",
    period: "Plazo"
  })
});

/** The three mandatory slots reuse the wizard's own titles, so the panel never drifts from it. */
const SLOT_TITLE: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(DOCUMENT_SLOTS.map((slot) => [slot.kind, slot.title]))
);

/** A named title per persisted upload kind; `photo` is optional and has no wizard slot. */
const DOCUMENT_KIND_TITLE: Readonly<Record<PymeDocumentKind, string>> = Object.freeze({
  "sales-declarations": SLOT_TITLE["sales-declarations"] ?? "Declaraciones de ventas",
  cuit: SLOT_TITLE["cuit"] ?? "Constancia de CUIT",
  "articles-of-incorporation": SLOT_TITLE["articles-of-incorporation"] ?? "Estatuto",
  photo: "Foto"
});

function loadingBlock(key: SubmittedBlockKey, title: string): SubmittedBlock {
  return { key, title, state: "loading", fields: [], message: null };
}

function failedBlock(key: SubmittedBlockKey, title: string, message: string): SubmittedBlock {
  return { key, title, state: "failed", fields: [], message };
}

function companyBlock(read: ReadOutcome<BusinessRecord>): SubmittedBlock {
  const title = SUBMITTED_DATA_COPY.companyTitle;
  if (read.status === "loading") return loadingBlock("company", title);
  if (read.status === "failed") return failedBlock("company", title, SUBMITTED_DATA_COPY.companyFailure);
  const company = read.value;
  return {
    key: "company",
    title,
    state: "ready",
    message: null,
    fields: [
      { label: SUBMITTED_DATA_COPY.fields.name, value: company.name },
      { label: SUBMITTED_DATA_COPY.fields.sector, value: company.sector },
      { label: SUBMITTED_DATA_COPY.fields.city, value: company.city },
      { label: SUBMITTED_DATA_COPY.fields.goal, value: formatArsAmount(company.goalArs) }
    ]
  };
}

function requestBlock(read: ReadOutcome<SmeRequestRead>): SubmittedBlock {
  const title = SUBMITTED_DATA_COPY.requestTitle;
  if (read.status === "loading") return loadingBlock("request", title);
  if (read.status === "failed") return failedBlock("request", title, SUBMITTED_DATA_COPY.requestFailure);
  const request = read.value.request;
  return {
    key: "request",
    title,
    state: "ready",
    message: null,
    fields: [
      { label: SUBMITTED_DATA_COPY.fields.reference, value: request.smeReference },
      { label: SUBMITTED_DATA_COPY.fields.total, value: formatArsAmount(request.declaredTotalArs) },
      {
        label: SUBMITTED_DATA_COPY.fields.period,
        value: `${formatMonthYear(request.periodStart)} – ${formatMonthYear(request.periodEnd)}`
      }
    ]
  };
}

function salesBlock(read: ReadOutcome<SmeRequestRead>): SubmittedBlock {
  const title = SUBMITTED_DATA_COPY.salesTitle;
  if (read.status === "loading") return loadingBlock("sales", title);
  if (read.status === "failed") return failedBlock("sales", title, SUBMITTED_DATA_COPY.salesFailure);
  const periods = read.value.salesPeriods;
  if (periods.length === 0) {
    return { key: "sales", title, state: "ready", fields: [], message: SUBMITTED_DATA_COPY.salesEmpty };
  }
  return {
    key: "sales",
    title,
    state: "ready",
    message: null,
    fields: periods.map((period) => ({
      label: formatMonthYear(period.period),
      value: period.amountArs === null ? SUBMITTED_DATA_COPY.sinDato : formatArsAmount(period.amountArs)
    }))
  };
}

function documentsBlock(read: ReadOutcome<readonly MyDocument[]>): SubmittedBlock {
  const title = SUBMITTED_DATA_COPY.documentsTitle;
  if (read.status === "loading") return loadingBlock("documents", title);
  if (read.status === "failed") return failedBlock("documents", title, SUBMITTED_DATA_COPY.documentsFailure);
  const documents = read.value;
  if (documents.length === 0) {
    return { key: "documents", title, state: "ready", fields: [], message: SUBMITTED_DATA_COPY.documentsEmpty };
  }
  return {
    key: "documents",
    title,
    state: "ready",
    message: null,
    fields: documents.map((document) => ({
      label: DOCUMENT_KIND_TITLE[document.kind],
      value: `${document.name} · ${formatFileSize(document.sizeBytes)}`
    }))
  };
}

/**
 * Shapes the three independent reads into the panel's blocks, in reading order:
 * company, request, sales, documents. Only persisted facts are shaped — no
 * simulated value has an input, so none can be presented as submitted.
 */
export function submittedDataView(reads: SubmittedDataReads): readonly SubmittedBlock[] {
  return [
    companyBlock(reads.business),
    requestBlock(reads.request),
    salesBlock(reads.request),
    documentsBlock(reads.documents)
  ];
}
