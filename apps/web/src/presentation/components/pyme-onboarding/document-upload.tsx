"use client";

import { useId, useRef, type ChangeEvent } from "react";
import {
  IoAddOutline,
  IoAlertCircleOutline,
  IoArrowBackOutline,
  IoArrowForwardOutline,
  IoCheckmarkCircleOutline,
  IoCloudUploadOutline,
  IoImageOutline,
  IoRefreshOutline,
  IoTrashOutline
} from "react-icons/io5";
import {
  ACCEPT_ATTRIBUTE,
  DOCUMENT_SLOTS,
  DOCUMENT_UPLOAD_COPY,
  canAddPhoto,
  canMovePhoto,
  documentUploadErrorMessage,
  emptyDocumentSlotState,
  formatFileSize,
  movePhoto,
  validateUploadFile,
  type DocumentSlotKind,
  type DocumentSlotState,
  type DocumentsState,
  type MoveDirection,
  type PhotoState
} from "@/application/pyme-onboarding/document-upload";
import type { UploadPort } from "@/application/ports/upload-port";
import { FOCUS_RING } from "../auth-field";

/**
 * The upload section of step 2 (Feature #398, Task #399 / T4c): the three
 * mandatory document slots and up to four optional photos, replacing the
 * template's mock «Declaraciones de ventas» attach control.
 *
 * Controlled and presentational: `RegistrationStep` owns the uploaded refs so
 * it can gate the submit, and this component orchestrates the port calls
 * (upload on select with progress, remove, retry, reorder). Client-side
 * validation mirrors the API only for a fast answer — the API re-checks the
 * bytes. Copy is new (owner U5), neutral Spanish with voseo, no claims.
 *
 * Accessibility: every file input has a label, controls are ≥44 px with
 * `FOCUS_RING`, progress is a labelled `progressbar` with a visible
 * percentage, errors use `role="alert"` and are linked through
 * `aria-describedby`, and no meaning is carried by colour alone.
 */

const ACTION_BUTTON =
  "inline-flex h-11 items-center gap-1.5 rounded-control border border-control bg-transparent px-3 text-[13px] font-semibold text-text-primary hover:bg-page-surface disabled:cursor-not-allowed disabled:opacity-60";

function createPreviewUrl(file: File): string | null {
  return typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null;
}

function revokePreviewUrl(url: string | null): void {
  if (url !== null && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
}

function Progress({
  name,
  progress,
  id
}: {
  readonly name: string;
  readonly progress: number;
  readonly id?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        id={id}
        role="progressbar"
        aria-label={DOCUMENT_UPLOAD_COPY.progressLabel(name)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        className="h-1.5 w-full overflow-hidden rounded-pill bg-page-surface"
      >
        <span
          aria-hidden="true"
          className="block h-full rounded-pill bg-brand-accent motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-text-secondary">
        {DOCUMENT_UPLOAD_COPY.uploading} {progress} %
      </span>
    </div>
  );
}

export interface DocumentUploadProps {
  readonly upload: UploadPort;
  readonly documents: DocumentsState;
  readonly photos: readonly PhotoState[];
  readonly onDocumentsChange: (update: (current: DocumentsState) => DocumentsState) => void;
  readonly onPhotosChange: (update: (current: readonly PhotoState[]) => readonly PhotoState[]) => void;
}

export function DocumentUpload({
  upload,
  documents,
  photos,
  onDocumentsChange,
  onPhotosChange
}: DocumentUploadProps) {
  const uid = useId();
  const requests = useRef<Record<DocumentSlotKind, number>>({
    "sales-declarations": 0,
    cuit: 0,
    "articles-of-incorporation": 0
  });
  const lastFiles = useRef<Partial<Record<DocumentSlotKind, File>>>({});
  const lastPhotoFiles = useRef(new Map<string, File>());
  const photoSeq = useRef(0);

  const inputId = (kind: DocumentSlotKind) => `${uid}-${kind}-input`;
  const helperId = (kind: DocumentSlotKind) => `${uid}-${kind}-helper`;
  const errorId = (kind: DocumentSlotKind) => `${uid}-${kind}-error`;
  const photoInputId = `${uid}-photo-input`;

  function updateSlot(
    kind: DocumentSlotKind,
    next: DocumentSlotState | ((current: DocumentSlotState) => DocumentSlotState)
  ): void {
    onDocumentsChange((current) => ({ ...current, [kind]: typeof next === "function" ? next(current[kind]) : next }));
  }

  function chooseDocument(kind: DocumentSlotKind, file: File): void {
    const token = (requests.current[kind] += 1);
    const validation = validateUploadFile(file);
    if (!validation.ok) {
      updateSlot(kind, { ...emptyDocumentSlotState(), phase: "error", error: validation.code, errorKind: "upload" });
      return;
    }
    lastFiles.current[kind] = file;
    updateSlot(kind, { ...emptyDocumentSlotState(), phase: "uploading", pendingFileName: file.name });

    void upload
      .uploadDocument({
        kind,
        file,
        onProgress: (percent) => {
          if (requests.current[kind] !== token) return;
          updateSlot(kind, (current) => ({ ...current, progress: percent }));
        }
      })
      .then((result) => {
        if (requests.current[kind] !== token) return;
        if (result.ok) {
          updateSlot(kind, {
            phase: "uploaded",
            progress: 100,
            document: { path: result.path, name: result.name, size: result.size, contentType: result.contentType },
            error: null,
            errorKind: null,
            pendingFileName: null
          });
        } else {
          updateSlot(kind, { ...emptyDocumentSlotState(), phase: "error", error: result.code, errorKind: "upload" });
        }
      });
  }

  async function removeDocument(kind: DocumentSlotKind): Promise<void> {
    const path = documents[kind].document?.path;
    if (path === undefined) return;
    const token = (requests.current[kind] += 1);
    const result = await upload.removeDocument(path);
    if (requests.current[kind] !== token) return;
    if (result.ok) {
      updateSlot(kind, emptyDocumentSlotState());
    } else {
      updateSlot(kind, (current) => ({
        ...current,
        phase: "error",
        error: result.code,
        errorKind: "remove",
        progress: 0,
        pendingFileName: null
      }));
    }
  }

  function retryDocument(kind: DocumentSlotKind): void {
    const slot = documents[kind];
    if (slot.errorKind === "remove" && slot.document) {
      void removeDocument(kind);
      return;
    }
    const file = lastFiles.current[kind];
    if (file) chooseDocument(kind, file);
  }

  function addPhoto(file: File): void {
    if (!canAddPhoto(photos.length)) return;
    const id = `photo-${(photoSeq.current += 1)}`;
    lastPhotoFiles.current.set(id, file);
    const previewUrl = createPreviewUrl(file);
    const validation = validateUploadFile(file);
    if (!validation.ok) {
      onPhotosChange((current) => [
        ...current,
        { id, phase: "error", progress: 0, document: null, error: validation.code, previewUrl, pendingFileName: null }
      ]);
      return;
    }
    onPhotosChange((current) => [
      ...current,
      { id, phase: "uploading", progress: 0, document: null, error: null, previewUrl, pendingFileName: file.name }
    ]);

    void upload
      .uploadDocument({
        kind: "photo",
        file,
        onProgress: (percent) => {
          onPhotosChange((current) => current.map((photo) => (photo.id === id ? { ...photo, progress: percent } : photo)));
        }
      })
      .then((result) => {
        onPhotosChange((current) =>
          current.some((photo) => photo.id === id)
            ? current.map((photo) => {
                if (photo.id !== id) return photo;
                if (result.ok) {
                  return {
                    ...photo,
                    phase: "uploaded" as const,
                    progress: 100,
                    document: { path: result.path, name: result.name, size: result.size, contentType: result.contentType },
                    error: null,
                    pendingFileName: null
                  };
                }
                return { ...photo, phase: "error" as const, progress: 0, error: result.code, pendingFileName: null };
              })
            : current
        );
      });
  }

  function retryPhoto(id: string): void {
    const file = lastPhotoFiles.current.get(id);
    if (!file || !validateUploadFile(file).ok) return;
    onPhotosChange((current) =>
      current.map((photo) =>
        photo.id === id ? { ...photo, phase: "uploading", progress: 0, error: null, pendingFileName: file.name } : photo
      )
    );
    void upload
      .uploadDocument({
        kind: "photo",
        file,
        onProgress: (percent) => {
          onPhotosChange((current) => current.map((photo) => (photo.id === id ? { ...photo, progress: percent } : photo)));
        }
      })
      .then((result) => {
        onPhotosChange((current) =>
          current.some((photo) => photo.id === id)
            ? current.map((photo) => {
                if (photo.id !== id) return photo;
                if (result.ok) {
                  return {
                    ...photo,
                    phase: "uploaded" as const,
                    progress: 100,
                    document: { path: result.path, name: result.name, size: result.size, contentType: result.contentType },
                    error: null,
                    pendingFileName: null
                  };
                }
                return { ...photo, phase: "error" as const, progress: 0, error: result.code, pendingFileName: null };
              })
            : current
        );
      });
  }

  function removePhoto(id: string): void {
    const photo = photos.find((candidate) => candidate.id === id);
    lastPhotoFiles.current.delete(id);
    onPhotosChange((current) => current.filter((candidate) => candidate.id !== id));
    revokePreviewUrl(photo?.previewUrl ?? null);
    if (photo?.document) void upload.removeDocument(photo.document.path);
  }

  function movePhotoById(id: string, direction: MoveDirection): void {
    const index = photos.findIndex((candidate) => candidate.id === id);
    if (index < 0) return;
    onPhotosChange((current) => movePhoto(current, index, direction));
  }

  function onFileChange(kind: DocumentSlotKind) {
    return (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) chooseDocument(kind, file);
    };
  }

  function onPhotoChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) addPhoto(file);
  }

  const canAdd = canAddPhoto(photos.length);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="m-0 flex flex-col gap-4 border-none p-0">
        <legend className="mb-1 p-0 text-sm font-semibold">{DOCUMENT_UPLOAD_COPY.documentsLegend}</legend>
        <p className="m-0 text-xs text-text-secondary">{DOCUMENT_UPLOAD_COPY.documentsHint}</p>

        {DOCUMENT_SLOTS.map((slot) => {
          const state = documents[slot.kind];
          const describedBy = [helperId(slot.kind), state.error ? errorId(slot.kind) : null]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={slot.kind}
              className="flex flex-col gap-2.5 rounded-card border border-page-border bg-page-surface p-4"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-text-primary">{slot.title}</span>
                <span id={helperId(slot.kind)} className="text-xs text-text-secondary">
                  {slot.helper}
                </span>
              </div>

              {state.phase === "uploading" ? (
                <Progress name={state.pendingFileName ?? ""} progress={state.progress} />
              ) : null}
              {state.phase === "uploaded" && state.document ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                  <IoCheckmarkCircleOutline aria-hidden="true" focusable="false" className="text-trust-success" />
                  <span className="font-medium text-text-primary">{state.document.name}</span>
                  <span className="text-text-secondary">{formatFileSize(state.document.size)}</span>
                </div>
              ) : null}
              {state.phase === "empty" ? (
                <span className="text-xs text-text-secondary">{DOCUMENT_UPLOAD_COPY.emptyNote}</span>
              ) : null}
              {state.phase === "error" && state.error ? (
                <span
                  id={errorId(slot.kind)}
                  role="alert"
                  className="flex items-center gap-1 text-[13px] font-medium text-trust-critical"
                >
                  <IoAlertCircleOutline aria-hidden="true" focusable="false" className="shrink-0 text-[15px]" />
                  {state.errorKind === "remove" ? DOCUMENT_UPLOAD_COPY.removeFailed : documentUploadErrorMessage(state.error)}
                </span>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  id={inputId(slot.kind)}
                  type="file"
                  accept={ACCEPT_ATTRIBUTE}
                  aria-label={slot.title}
                  aria-describedby={describedBy || undefined}
                  onChange={onFileChange(slot.kind)}
                  className="peer sr-only"
                />
                <label
                  htmlFor={inputId(slot.kind)}
                  className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-control border border-control bg-canvas px-3 text-[13px] font-semibold text-text-primary hover:bg-page-surface peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring"
                >
                  <IoCloudUploadOutline aria-hidden="true" focusable="false" className="text-[16px]" />
                  {state.document ? DOCUMENT_UPLOAD_COPY.replace : DOCUMENT_UPLOAD_COPY.chooseFile}
                </label>
                {state.phase === "error" ? (
                  <button type="button" onClick={() => retryDocument(slot.kind)} className={`${ACTION_BUTTON} ${FOCUS_RING}`}>
                    <IoRefreshOutline aria-hidden="true" focusable="false" className="text-[16px]" />
                    {DOCUMENT_UPLOAD_COPY.retry}
                  </button>
                ) : null}
                {state.document ? (
                  <button
                    type="button"
                    onClick={() => void removeDocument(slot.kind)}
                    className={`${ACTION_BUTTON} ${FOCUS_RING}`}
                  >
                    <IoTrashOutline aria-hidden="true" focusable="false" className="text-[16px]" />
                    {DOCUMENT_UPLOAD_COPY.remove}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-4 border-none p-0">
        <legend className="mb-1 p-0 text-sm font-semibold">{DOCUMENT_UPLOAD_COPY.photosTitle}</legend>
        <p className="m-0 text-xs text-text-secondary">{DOCUMENT_UPLOAD_COPY.photosHint}</p>

        {photos.length > 0 ? (
          <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
            {photos.map((photo, index) => (
              <li
                key={photo.id}
                className="flex w-[150px] flex-col gap-2 rounded-card border border-page-border bg-page-surface p-2.5"
              >
                <div className="grid h-24 w-full place-items-center overflow-hidden rounded-control bg-canvas">
                  {photo.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a remote asset
                    <img
                      src={photo.previewUrl}
                      alt={DOCUMENT_UPLOAD_COPY.photoAlt(index + 1)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <IoImageOutline aria-hidden="true" focusable="false" className="text-[28px] text-text-secondary" />
                  )}
                </div>

                {photo.phase === "uploading" ? <Progress name={photo.pendingFileName ?? ""} progress={photo.progress} /> : null}
                {photo.phase === "error" && photo.error ? (
                  <div className="flex flex-col gap-1.5">
                    <span role="alert" className="text-[12px] font-medium text-trust-critical">
                      {documentUploadErrorMessage(photo.error)}
                    </span>
                    <button
                      type="button"
                      onClick={() => retryPhoto(photo.id)}
                      className={`${ACTION_BUTTON} w-full justify-center ${FOCUS_RING}`}
                    >
                      <IoRefreshOutline aria-hidden="true" focusable="false" className="text-[16px]" />
                      {DOCUMENT_UPLOAD_COPY.retry}
                    </button>
                  </div>
                ) : null}

                <span className="truncate text-[12px] text-text-secondary" title={photo.document?.name ?? photo.pendingFileName ?? ""}>
                  {photo.document?.name ?? photo.pendingFileName ?? ""}
                </span>

                <div className="flex items-center justify-between gap-1">
                  <button
                    type="button"
                    aria-label={DOCUMENT_UPLOAD_COPY.movePhotoLeft(index + 1)}
                    disabled={!canMovePhoto(index, "left", photos.length)}
                    onClick={() => movePhotoById(photo.id, "left")}
                    className={`grid h-11 w-11 place-items-center rounded-control border border-control bg-transparent text-text-primary hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                  >
                    <IoArrowBackOutline aria-hidden="true" focusable="false" className="text-[16px]" />
                  </button>
                  <button
                    type="button"
                    aria-label={DOCUMENT_UPLOAD_COPY.movePhotoRight(index + 1)}
                    disabled={!canMovePhoto(index, "right", photos.length)}
                    onClick={() => movePhotoById(photo.id, "right")}
                    className={`grid h-11 w-11 place-items-center rounded-control border border-control bg-transparent text-text-primary hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                  >
                    <IoArrowForwardOutline aria-hidden="true" focusable="false" className="text-[16px]" />
                  </button>
                  <button
                    type="button"
                    aria-label={DOCUMENT_UPLOAD_COPY.removePhoto(index + 1)}
                    onClick={() => removePhoto(photo.id)}
                    className={`grid h-11 w-11 place-items-center rounded-control border border-control bg-transparent text-trust-critical hover:bg-canvas ${FOCUS_RING}`}
                  >
                    <IoTrashOutline aria-hidden="true" focusable="false" className="text-[16px]" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <input
            id={photoInputId}
            type="file"
            accept={ACCEPT_ATTRIBUTE}
            aria-label={DOCUMENT_UPLOAD_COPY.addPhoto}
            disabled={!canAdd}
            onChange={onPhotoChange}
            className="peer sr-only"
          />
          <label
            htmlFor={photoInputId}
            aria-disabled={!canAdd}
            className={`inline-flex h-11 items-center gap-1.5 rounded-control border border-control bg-transparent px-3 text-[13px] font-semibold text-text-primary hover:bg-page-surface peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring ${
              canAdd ? "cursor-pointer" : "cursor-not-allowed opacity-60"
            }`}
          >
            <IoAddOutline aria-hidden="true" focusable="false" className="text-[16px]" />
            {DOCUMENT_UPLOAD_COPY.addPhoto}
          </label>
          {!canAdd ? <span className="text-xs text-text-secondary">{DOCUMENT_UPLOAD_COPY.photoLimit}</span> : null}
        </div>
      </fieldset>
    </div>
  );
}
