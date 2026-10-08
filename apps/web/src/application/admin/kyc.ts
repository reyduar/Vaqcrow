import type { ApplicationReviewState, DocumentVerdictRecord, DocumentVerdictValue } from "@vaqcrow/contracts";
import type { AdminReviewDocument, SetDocumentVerdictFailure } from "@/application/ports/admin-review-port";

/**
 * Pure model of section «1 · KYC/KYB» of the admin review (`Vaqcrow
 * Admin.dc.html`, view `review`; Feature #410 / U3), React-free.
 *
 * One row per document the PyME really uploaded, in the template's order. The
 * template's titles are used where a real kind matches one of its rows; the
 * subtitle is the uploaded file name, never the template's synthetic sample
 * text. The template's «Documento de identidad» row has no uploaded document
 * behind it (KYC is simulated), so no row is invented for it, and a missing
 * mandatory document is not padded with a placeholder row either.
 */

export type KycRowIcon = "business" | "document" | "chart" | "image";

interface KindPresentation {
  readonly title: string;
  readonly icon: KycRowIcon;
  readonly order: number;
}

/** Template rows (`checks`): CUIT, Contrato social, Declaraciones de ventas. */
const KIND_PRESENTATION: Readonly<Record<string, KindPresentation>> = Object.freeze({
  cuit: { title: "Constancia de CUIT", icon: "business", order: 0 },
  "articles-of-incorporation": { title: "Contrato social", icon: "document", order: 1 },
  "sales-declarations": { title: "Declaraciones de ventas", icon: "chart", order: 2 }
});

const PHOTO_KIND = "photo";
const PHOTO_ORDER = 3;
const UNKNOWN_ORDER = 4;
const UNKNOWN_TITLE = "Documento";

export interface KycRow {
  readonly documentId: string;
  readonly title: string;
  /** The uploaded file name. */
  readonly subtitle: string;
  readonly icon: KycRowIcon;
  /** «Estado de {título}», the toggle group's accessible name. */
  readonly groupLabel: string;
  readonly objectPath: string;
  readonly contentType: string;
  /** The persisted verdict, or `null` when none was recorded (no button pressed). */
  readonly verdict: DocumentVerdictValue | null;
}

export function kycRowsFor(
  documents: readonly AdminReviewDocument[],
  verdicts: readonly DocumentVerdictRecord[]
): KycRow[] {
  const verdictById = new Map(verdicts.map((record) => [record.documentId, record.verdict]));
  const ordered = documents
    .map((document, index) => ({ document, index, order: orderOf(document.kind) }))
    .sort((a, b) => a.order - b.order || a.index - b.index);

  let photoNumber = 0;
  return ordered.map(({ document }) => {
    const known = KIND_PRESENTATION[document.kind];
    let title: string;
    let icon: KycRowIcon;
    if (known) {
      ({ title, icon } = known);
    } else if (document.kind === PHOTO_KIND) {
      photoNumber += 1;
      title = `Foto ${photoNumber}`;
      icon = "image";
    } else {
      title = UNKNOWN_TITLE;
      icon = "document";
    }
    return {
      documentId: document.documentId,
      title,
      subtitle: document.name,
      icon,
      groupLabel: `Estado de ${title}`,
      objectPath: document.objectPath,
      contentType: document.contentType,
      verdict: verdictById.get(document.documentId) ?? null
    };
  });
}

function orderOf(kind: string): number {
  return KIND_PRESENTATION[kind]?.order ?? (kind === PHOTO_KIND ? PHOTO_ORDER : UNKNOWN_ORDER);
}

export type KycOptionIcon = "check" | "mail" | "close";
export type KycOptionTone = "success" | "caution" | "critical";

export interface KycVerdictOption {
  readonly value: DocumentVerdictValue;
  readonly label: string;
  readonly icon: KycOptionIcon;
  readonly tone: KycOptionTone;
}

/** The template's `opts`: Válido (ok), Pedir (warn), Inválido (err). */
export const KYC_VERDICT_OPTIONS: readonly KycVerdictOption[] = Object.freeze([
  { value: "valid", label: "Válido", icon: "check", tone: "success" },
  { value: "request", label: "Pedir", icon: "mail", tone: "caution" },
  { value: "invalid", label: "Inválido", icon: "close", tone: "critical" }
]);

const EDITABLE_STATES: ReadonlySet<ApplicationReviewState> = new Set(["awaiting_assessment", "human_review"]);
const DECIDED_STATES: ReadonlySet<ApplicationReviewState> = new Set(["approved", "rejected", "changes_requested"]);

/** The API takes verdicts only before a decision; anything else is read-only. */
export function kycEditable(state: ApplicationReviewState): boolean {
  return EDITABLE_STATES.has(state);
}

/**
 * Copy for states the template does not design (open question in the task
 * log): minimal, neutral and honest about nothing having changed.
 */
export const KYC_COPY = Object.freeze({
  title: "1 · KYC/KYB",
  simulated: "SIMULADO",
  open: "Abrir",
  noDocuments: "No hay documentos cargados.",
  alreadyDecided: "Esta solicitud ya tiene una decisión registrada. No se modificó ningún dato.",
  notEditable: "Esta solicitud no admite cambios en su estado actual. No se modificó ningún dato.",
  documentNotFound: "No encontramos este documento en la solicitud. No se modificó ningún dato.",
  saveFailed: "No pudimos guardar el estado del documento. No se modificó ningún dato.",
  openFailed: "No pudimos abrir el documento."
});

export function kycVerdictFailureMessage(failure: SetDocumentVerdictFailure): string {
  switch (failure.code) {
    case "state_conflict":
      return DECIDED_STATES.has(failure.actualState) ? KYC_COPY.alreadyDecided : KYC_COPY.notEditable;
    case "not_found":
      return KYC_COPY.documentNotFound;
    default:
      return KYC_COPY.saveFailed;
  }
}
