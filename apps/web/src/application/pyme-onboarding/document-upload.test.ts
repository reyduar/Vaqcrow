import { describe, expect, it } from "vitest";
import {
  ACCEPT_ATTRIBUTE,
  ALLOWED_MIME_TYPES,
  DOCUMENT_SLOTS,
  DOCUMENT_UPLOAD_COPY,
  MAX_PHOTOS,
  MAX_UPLOAD_BYTES,
  allDocumentsUploaded,
  canAddPhoto,
  canMovePhoto,
  documentUploadErrorMessage,
  emptyDocumentsState,
  formatFileSize,
  missingDocumentKinds,
  movePhoto,
  submitGateMessage,
  validateUploadFile,
  type DocumentsState
} from "./document-upload";

function file(name: string, type: string, size: number): { name: string; type: string; size: number } {
  return { name, type, size };
}

function loadedDocuments(): DocumentsState {
  const state = emptyDocumentsState();
  return {
    ...state,
    "sales-declarations": { ...state["sales-declarations"], phase: "uploaded", document: doc("sales") },
    cuit: { ...state.cuit, phase: "uploaded", document: doc("cuit") },
    "articles-of-incorporation": {
      ...state["articles-of-incorporation"],
      phase: "uploaded",
      document: doc("articles")
    }
  };
}

function doc(path: string) {
  return { path, name: `${path}.pdf`, size: 1024, contentType: "application/pdf" };
}

describe("upload constraints", () => {
  it("allows only PDF, JPEG and PNG up to the 10 MB cap", () => {
    expect(ALLOWED_MIME_TYPES).toEqual(["application/pdf", "image/jpeg", "image/png"]);
    expect(MAX_UPLOAD_BYTES).toBe(10485760);
    expect(MAX_PHOTOS).toBe(4);
    expect(ACCEPT_ATTRIBUTE).toBe("application/pdf,image/jpeg,image/png");
  });

  it("defines the three mandatory slots in the owner's order", () => {
    expect(DOCUMENT_SLOTS.map((slot) => slot.kind)).toEqual(["sales-declarations", "cuit", "articles-of-incorporation"]);
    expect(DOCUMENT_SLOTS.map((slot) => slot.title)).toEqual([
      "Declaraciones de ventas",
      "Constancia de CUIT",
      "Estatuto"
    ]);
  });
});

describe("validateUploadFile", () => {
  it.each([
    ["application/pdf", "factura.pdf"],
    ["image/jpeg", "local.jpg"],
    ["image/png", "local.png"]
  ])("accepts a %s under the cap", (type, name) => {
    expect(validateUploadFile(file(name, type, 1024))).toEqual({ ok: true });
  });

  it("accepts a file of exactly 10 MB", () => {
    expect(validateUploadFile(file("exact.pdf", "application/pdf", MAX_UPLOAD_BYTES))).toEqual({ ok: true });
  });

  it("rejects a type outside the allow-list", () => {
    expect(validateUploadFile(file("notas.txt", "text/plain", 1024))).toEqual({
      ok: false,
      code: "unsupported_type"
    });
    expect(validateUploadFile(file("sin-tipo", "", 1024))).toEqual({ ok: false, code: "unsupported_type" });
  });

  it("rejects a file over the cap even with an allowed type", () => {
    expect(validateUploadFile(file("grande.pdf", "application/pdf", MAX_UPLOAD_BYTES + 1))).toEqual({
      ok: false,
      code: "too_large"
    });
  });
});

describe("formatFileSize", () => {
  it("renders bytes, KB and MB with a comma decimal", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1,5 KB");
    expect(formatFileSize(1048576)).toBe("1 MB");
    expect(formatFileSize(10485760)).toBe("10 MB");
  });
});

describe("submit gate", () => {
  it("lists the missing slots in the owner's order", () => {
    const state = emptyDocumentsState();
    expect(missingDocumentKinds(state)).toEqual(["sales-declarations", "cuit", "articles-of-incorporation"]);
    expect(allDocumentsUploaded(state)).toBe(false);

    const partial: DocumentsState = { ...state, cuit: { ...state.cuit, document: doc("cuit") } };
    expect(missingDocumentKinds(partial)).toEqual(["sales-declarations", "articles-of-incorporation"]);
    expect(allDocumentsUploaded(partial)).toBe(false);
  });

  it("reports no missing slots once the three are loaded", () => {
    expect(missingDocumentKinds(loadedDocuments())).toEqual([]);
    expect(allDocumentsUploaded(loadedDocuments())).toBe(true);
  });

  it("names the missing slots in a singular or plural sentence", () => {
    expect(submitGateMessage([])).toBe("");
    expect(submitGateMessage(["cuit"])).toBe("Antes de enviar, subí el documento obligatorio: Constancia de CUIT.");
    expect(submitGateMessage(["sales-declarations", "cuit"])).toBe(
      "Antes de enviar, subí los documentos obligatorios: Declaraciones de ventas y Constancia de CUIT."
    );
    expect(submitGateMessage(["sales-declarations", "cuit", "articles-of-incorporation"])).toBe(
      "Antes de enviar, subí los documentos obligatorios: Declaraciones de ventas, Constancia de CUIT y Estatuto."
    );
  });
});

describe("photo ordering", () => {
  const photos = ["a", "b", "c"] as const;

  it("moves an item left or right and returns a new array", () => {
    expect(movePhoto(photos, 1, "left")).toEqual(["b", "a", "c"]);
    expect(movePhoto(photos, 1, "right")).toEqual(["a", "c", "b"]);
    expect(movePhoto(photos, 0, "left")).toEqual(["a", "b", "c"]);
    expect(movePhoto(photos, 2, "right")).toEqual(["a", "b", "c"]);
    expect(photos).toEqual(["a", "b", "c"]);
  });

  it("disables a move at the ends of the list", () => {
    expect(canMovePhoto(0, "left", 3)).toBe(false);
    expect(canMovePhoto(2, "right", 3)).toBe(false);
    expect(canMovePhoto(1, "left", 3)).toBe(true);
    expect(canMovePhoto(1, "right", 3)).toBe(true);
  });

  it("caps the photo count at four", () => {
    expect(canAddPhoto(0)).toBe(true);
    expect(canAddPhoto(3)).toBe(true);
    expect(canAddPhoto(4)).toBe(false);
  });
});

describe("DOCUMENT_UPLOAD_COPY", () => {
  it("carries the new Spanish copy and the accessible labels", () => {
    expect(DOCUMENT_UPLOAD_COPY.documentsLegend).toBe("Documentos obligatorios");
    expect(DOCUMENT_UPLOAD_COPY.photosTitle).toBe("Fotos (opcional)");
    expect(DOCUMENT_UPLOAD_COPY.chooseFile).toBe("Elegir archivo");
    expect(DOCUMENT_UPLOAD_COPY.replace).toBe("Reemplazar");
    expect(DOCUMENT_UPLOAD_COPY.retry).toBe("Reintentar");
    expect(DOCUMENT_UPLOAD_COPY.addPhoto).toBe("Agregar foto");
    expect(DOCUMENT_UPLOAD_COPY.movePhotoLeft(2)).toBe("Mover foto 2 a la izquierda");
    expect(DOCUMENT_UPLOAD_COPY.movePhotoRight(2)).toBe("Mover foto 2 a la derecha");
    expect(DOCUMENT_UPLOAD_COPY.removePhoto(2)).toBe("Quitar foto 2");
    expect(DOCUMENT_UPLOAD_COPY.photoAlt(2)).toBe("Vista previa de la foto 2");
    expect(DOCUMENT_UPLOAD_COPY.progressLabel("factura.pdf")).toBe("Subiendo factura.pdf");
    expect(DOCUMENT_UPLOAD_COPY.photoLimit).toBe("Llegaste al máximo de 4 fotos.");
    expect(DOCUMENT_UPLOAD_COPY.removeFailed).toBe("No se pudo quitar el archivo. Probá de nuevo.");
  });

  it("maps every sanitized code to its own message", () => {
    expect(documentUploadErrorMessage("unsupported_type")).toBe("Formato no admitido. Usá PDF, JPG o PNG.");
    expect(documentUploadErrorMessage("too_large")).toBe("El archivo supera los 10 MB.");
    expect(documentUploadErrorMessage("unavailable")).toBe("No se pudo subir el archivo. Probá de nuevo.");
    expect(documentUploadErrorMessage("network")).toBe(
      "No hay conexión con el servidor. Revisá tu conexión y volvé a intentar."
    );
  });
});
