/**
 * Pure model of the document/photo upload section inside step 2 of the PyME
 * onboarding wizard (Feature #398, Task #399 / T4c). React-free so the
 * validation, the ordering helpers and the copy are unit-tested without
 * rendering.
 *
 * Owner decisions (2026-10-03, U1–U5): three fixed mandatory document slots
 * (Declaraciones de ventas, Constancia de CUIT, Estatuto), one file each,
 * PDF/JPG/PNG ≤ 10 MB, all three required to submit; up to four optional
 * photos ordered with «mover ←/→» buttons; upload on select with progress;
 * removing deletes the object. The copy is new and owner-approved in review
 * (U5): neutral Spanish, voseo, no marketing claims.
 *
 * Client-side validation only mirrors the API for a fast, local answer; the
 * API re-validates the bytes and is authoritative.
 */

import type { UploadedDocument, UploadErrorCode, UploadKind } from "@/application/ports/upload-port";

/** The three mandatory slots; a photo is the fourth `UploadKind` and is optional. */
export type DocumentSlotKind = Exclude<UploadKind, "photo">;

export type UploadPhase = "empty" | "uploading" | "uploaded" | "error";

export type MoveDirection = "left" | "right";

export const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

/** The `accept` attribute for a file input, derived from the allow-list. */
export const ACCEPT_ATTRIBUTE = ALLOWED_MIME_TYPES.join(",");

/** 10 MB, matching the bucket's limit and the API's `MAX_UPLOAD_BYTES`. */
export const MAX_UPLOAD_BYTES = 10485760;

/** Owner U2: up to four optional photos. */
export const MAX_PHOTOS = 4;

export interface DocumentSlotDefinition {
  readonly kind: DocumentSlotKind;
  readonly title: string;
  readonly helper: string;
}

/** Owner U1: the three mandatory slots, in order and named as the owner chose. */
export const DOCUMENT_SLOTS: readonly DocumentSlotDefinition[] = Object.freeze([
  Object.freeze({
    kind: "sales-declarations" as const,
    title: "Declaraciones de ventas",
    helper: "Comprobantes que respaldan la grilla de ventas mensuales."
  }),
  Object.freeze({
    kind: "cuit" as const,
    title: "Constancia de CUIT",
    helper: "Constancia de inscripción en ARCA."
  }),
  Object.freeze({
    kind: "articles-of-incorporation" as const,
    title: "Estatuto",
    helper: "Estatuto social de la empresa."
  })
]);

const TITLE_BY_KIND: Readonly<Record<DocumentSlotKind, string>> = Object.freeze(
  Object.fromEntries(DOCUMENT_SLOTS.map((slot) => [slot.kind, slot.title])) as Record<DocumentSlotKind, string>
);

export const DOCUMENT_UPLOAD_COPY = Object.freeze({
  documentsLegend: "Documentos obligatorios",
  documentsHint: "Subí un archivo por cada documento. Formatos PDF, JPG o PNG, hasta 10 MB.",
  photosTitle: "Fotos (opcional)",
  photosHint: "Podés subir hasta 4 fotos del local, los productos o el equipo.",
  chooseFile: "Elegir archivo",
  replace: "Reemplazar",
  remove: "Quitar",
  retry: "Reintentar",
  uploading: "Subiendo…",
  emptyNote: "Sin archivo.",
  removeFailed: "No se pudo quitar el archivo. Probá de nuevo.",
  addPhoto: "Agregar foto",
  photoLimit: "Llegaste al máximo de 4 fotos.",
  photoAlt: (position: number) => `Vista previa de la foto ${position}`,
  progressLabel: (name: string) => `Subiendo ${name}`,
  movePhotoLeft: (position: number) => `Mover foto ${position} a la izquierda`,
  movePhotoRight: (position: number) => `Mover foto ${position} a la derecha`,
  removePhoto: (position: number) => `Quitar foto ${position}`,
  errors: Object.freeze({
    unsupported_type: "Formato no admitido. Usá PDF, JPG o PNG.",
    too_large: "El archivo supera los 10 MB.",
    invalid_name: "El nombre del archivo no es válido.",
    invalid_kind: "Este tipo de documento no es válido.",
    unavailable: "No se pudo subir el archivo. Probá de nuevo.",
    network: "No hay conexión con el servidor. Revisá tu conexión y volvé a intentar."
  }) as Readonly<Record<UploadErrorCode, string>>
});

/** Visible message for a sanitized upload code. */
export function documentUploadErrorMessage(code: UploadErrorCode): string {
  return DOCUMENT_UPLOAD_COPY.errors[code];
}

export interface DocumentSlotState {
  readonly phase: UploadPhase;
  /** Transport progress 0–100 while `phase === "uploading"`. */
  readonly progress: number;
  readonly document: UploadedDocument | null;
  readonly error: UploadErrorCode | null;
  /** Whether the current error came from an upload or a removal attempt. */
  readonly errorKind: "upload" | "remove" | null;
  /** Name of the file being uploaded, for the progress label. */
  readonly pendingFileName: string | null;
}

export type DocumentsState = Readonly<Record<DocumentSlotKind, DocumentSlotState>>;

export interface PhotoState {
  /** Stable id so a photo keeps its identity through reordering. */
  readonly id: string;
  readonly phase: UploadPhase;
  readonly progress: number;
  readonly document: UploadedDocument | null;
  readonly error: UploadErrorCode | null;
  /** Object URL for the local preview; `null` when the runtime has none. */
  readonly previewUrl: string | null;
  /** Name of the file being uploaded, for the progress label. */
  readonly pendingFileName: string | null;
}

export function emptyDocumentSlotState(): DocumentSlotState {
  return { phase: "empty", progress: 0, document: null, error: null, errorKind: null, pendingFileName: null };
}

export function emptyDocumentsState(): DocumentsState {
  return {
    "sales-declarations": emptyDocumentSlotState(),
    cuit: emptyDocumentSlotState(),
    "articles-of-incorporation": emptyDocumentSlotState()
  };
}

export interface UploadableFile {
  readonly name: string;
  readonly type: string;
  readonly size: number;
}

export type FileValidationResult = { readonly ok: true } | { readonly ok: false; readonly code: UploadErrorCode };

/**
 * Client-side mirror of the API's allow-list and 10 MB cap. Deliberately
 * checks the declared type first and the size second, like the API; the API
 * still checks the actual bytes, so this is a convenience, not a trust
 * boundary.
 */
export function validateUploadFile(file: UploadableFile): FileValidationResult {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, code: "unsupported_type" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, code: "too_large" };
  }
  return { ok: true };
}

function oneDecimal(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

/** Human size for the uploaded-file row: `512 B`, `1,5 KB`, `10 MB`. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${oneDecimal(kilobytes)} KB`;
  return `${oneDecimal(kilobytes / 1024)} MB`;
}

function joinTitles(titles: readonly string[]): string {
  if (titles.length <= 1) return titles[0] ?? "";
  return `${titles.slice(0, -1).join(", ")} y ${titles[titles.length - 1]}`;
}

/** The mandatory slots still missing a stored document, in slot order. */
export function missingDocumentKinds(state: DocumentsState): readonly DocumentSlotKind[] {
  return DOCUMENT_SLOTS.filter((slot) => state[slot.kind].document === null).map((slot) => slot.kind);
}

export function allDocumentsUploaded(state: DocumentsState): boolean {
  return missingDocumentKinds(state).length === 0;
}

/** Sanitized submit-gate sentence naming the missing slots; empty when none are missing. */
export function submitGateMessage(missing: readonly DocumentSlotKind[]): string {
  if (missing.length === 0) return "";
  const titles = joinTitles(missing.map((kind) => TITLE_BY_KIND[kind]));
  return missing.length === 1
    ? `Antes de enviar, subí el documento obligatorio: ${titles}.`
    : `Antes de enviar, subí los documentos obligatorios: ${titles}.`;
}

export function canAddPhoto(count: number): boolean {
  return count < MAX_PHOTOS;
}

export function canMovePhoto(index: number, direction: MoveDirection, count: number): boolean {
  const target = direction === "left" ? index - 1 : index + 1;
  return index >= 0 && index < count && target >= 0 && target < count;
}

/** Returns a new array with the item at `index` swapped one place; out-of-range moves are no-ops. */
export function movePhoto<T>(items: readonly T[], index: number, direction: MoveDirection): T[] {
  const next = items.slice();
  if (!canMovePhoto(index, direction, next.length)) return next;
  const target = direction === "left" ? index - 1 : index + 1;
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
