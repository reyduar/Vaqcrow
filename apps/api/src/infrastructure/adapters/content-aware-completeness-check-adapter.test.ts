import type { VisionOutcome, VisionProviderPort } from "@vaqcrow/ai";
import { describe, expect, it, vi } from "vitest";
import type {
  CompletenessCheckCommand,
  CompletenessCheckPort
} from "../../application/ports/completeness-check-port.js";
import type { PdfRasterizeResult, PdfRasterizerPort } from "../../application/ports/pdf-rasterizer-port.js";
import type {
  PymeDocumentRecord,
  PymeDocumentRepositoryPort,
  PymeDocumentRepositoryResult
} from "../../application/ports/pyme-document-repository-port.js";
import type { DownloadedObject, StoragePort, StorageResult } from "../../application/ports/storage-port.js";
import type { CompletenessCheckInput } from "../../application/completeness/completeness-check.js";
import { createContentAwareCompletenessCheckAdapter } from "./content-aware-completeness-check-adapter.js";

/**
 * U5 — the content-aware completeness check.
 *
 * Every collaborator is a hand-written double: no storage, no rasterizer engine
 * and no model are ever called from these tests. The declared-data rules run
 * unchanged underneath, so the content pass is what is under test.
 */

const OWNER = "11111111-1111-4111-8111-111111111111";

const VISION_METADATA = {
  model: "test-vision",
  promptVersion: "vision-v1",
  generatedAt: "2026-10-05T00:00:00.000Z",
  source: "simulated" as const
};

function relevant(): VisionOutcome {
  return { ok: true, value: { relevant: true, reason: "Es el documento esperado." }, metadata: VISION_METADATA };
}

function irrelevant(): VisionOutcome {
  return { ok: true, value: { relevant: false, reason: "No parece el documento." }, metadata: VISION_METADATA };
}

function visionFailure(): VisionOutcome {
  return { ok: false, error: { code: "provider_unavailable" } };
}

/** Declared metadata that is complete on its own, so any finding comes from the content pass. */
const COMPLETE_INPUT: CompletenessCheckInput = {
  documents: [
    { kind: "sales-declarations", present: true },
    { kind: "cuit", present: true },
    { kind: "articles-of-incorporation", present: true }
  ],
  photoCount: 2,
  salesMonths: [
    { month: "Enero", valueArs: 3_100_000 },
    { month: "Febrero", valueArs: 3_200_000 },
    { month: "Marzo", valueArs: 3_300_000 },
    { month: "Abril", valueArs: 3_400_000 },
    { month: "Mayo", valueArs: 3_500_000 },
    { month: "Junio", valueArs: 3_600_000 }
  ]
};

const PDF_BYTES = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);
const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9]);
const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 4]);

function base64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function record(overrides: Partial<PymeDocumentRecord> = {}): PymeDocumentRecord {
  return {
    documentId: "doc-1",
    ownerUserId: OWNER,
    kind: "cuit",
    objectPath: `${OWNER}/cuit/abc-constancia.pdf`,
    name: "constancia.pdf",
    sizeBytes: 10,
    contentType: "application/pdf",
    createdAt: "2026-10-05T00:00:00.000Z",
    ...overrides
  };
}

function documentsDouble(
  result: PymeDocumentRepositoryResult<readonly PymeDocumentRecord[]>
): { port: PymeDocumentRepositoryPort; listByOwner: ReturnType<typeof vi.fn> } {
  const listByOwner = vi.fn(async () => result);
  const port = {
    listByOwner,
    create: vi.fn(),
    deleteByObjectPath: vi.fn()
  } as unknown as PymeDocumentRepositoryPort;
  return { port, listByOwner };
}

function storageDouble(
  downloads: Readonly<Record<string, StorageResult<DownloadedObject>>>
): { port: StoragePort; downloadObject: ReturnType<typeof vi.fn> } {
  const downloadObject = vi.fn(async (path: string) => downloads[path] ?? { ok: false, error: { code: "not_found" } });
  const port = {
    uploadObject: vi.fn(),
    removeObject: vi.fn(),
    downloadObject
  } as unknown as StoragePort;
  return { port, downloadObject };
}

const DEFAULT_RASTERIZE: PdfRasterizeResult = { ok: true, value: { bytes: PNG_BYTES, contentType: "image/png" } };

function rasterizerDouble(
  result: PdfRasterizeResult = DEFAULT_RASTERIZE
): { port: PdfRasterizerPort; rasterize: ReturnType<typeof vi.fn> } {
  const rasterize = vi.fn(async () => result);
  return { port: { rasterize }, rasterize };
}

function visionDouble(
  outcome: (input: { kind: string; contentType: string; imageBase64: string }) => VisionOutcome
): { port: VisionProviderPort; assessRelevance: ReturnType<typeof vi.fn> } {
  const assessRelevance = vi.fn(async (input: { kind: string; contentType: string; imageBase64: string }) =>
    outcome(input)
  );
  return { port: { assessRelevance }, assessRelevance };
}

interface Harness {
  readonly checker: CompletenessCheckPort;
  readonly documents: ReturnType<typeof documentsDouble>;
  readonly storage: ReturnType<typeof storageDouble>;
  readonly rasterizer: ReturnType<typeof rasterizerDouble>;
  readonly vision: ReturnType<typeof visionDouble>;
}

function harness(options: {
  readonly rows?: PymeDocumentRepositoryResult<readonly PymeDocumentRecord[]>;
  readonly downloads?: Readonly<Record<string, StorageResult<DownloadedObject>>>;
  readonly rasterize?: PdfRasterizeResult;
  readonly outcome?: (input: { kind: string; contentType: string; imageBase64: string }) => VisionOutcome;
} = {}): Harness {
  const documents = documentsDouble(options.rows ?? { ok: true, value: [] });
  const storage = storageDouble(options.downloads ?? {});
  const rasterizer = rasterizerDouble(options.rasterize);
  const vision = visionDouble(options.outcome ?? (() => relevant()));
  const checker = createContentAwareCompletenessCheckAdapter({
    documents: documents.port,
    storage: storage.port,
    rasterizer: rasterizer.port,
    vision: vision.port
  });
  return { checker, documents, storage, rasterizer, vision };
}

function command(input: CompletenessCheckInput = COMPLETE_INPUT): CompletenessCheckCommand {
  return { ownerUserId: OWNER, input };
}

describe("createContentAwareCompletenessCheckAdapter", () => {
  it("emits no content finding when the document is relevant", async () => {
    const rows = { ok: true as const, value: [record()] };
    const downloads = { [record().objectPath]: { ok: true as const, value: { bytes: PDF_BYTES, contentType: "application/pdf" } } };
    const h = harness({ rows, downloads, outcome: () => relevant() });

    const result = await h.checker.check(command());

    expect(result).toEqual({ complete: true, findings: [] });
    expect(h.vision.assessRelevance).toHaveBeenCalledTimes(1);
  });

  it("emits a content_irrelevant gap naming the document in Spanish", async () => {
    const h = harness({
      rows: { ok: true, value: [record()] },
      downloads: { [record().objectPath]: { ok: true, value: { bytes: PDF_BYTES, contentType: "application/pdf" } } },
      outcome: () => irrelevant()
    });

    const result = await h.checker.check(command());

    expect(result.complete).toBe(false);
    expect(result.findings).toEqual([
      { code: "content_irrelevant", severity: "gap", detail: expect.stringContaining("Constancia de CUIT") }
    ]);
  });

  it("emits a content_unverified warning when the vision call fails, without blocking", async () => {
    const h = harness({
      rows: { ok: true, value: [record()] },
      downloads: { [record().objectPath]: { ok: true, value: { bytes: PDF_BYTES, contentType: "application/pdf" } } },
      outcome: () => visionFailure()
    });

    const result = await h.checker.check(command());

    expect(result.complete).toBe(true);
    expect(result.findings).toEqual([
      { code: "content_unverified", severity: "warning", detail: expect.stringContaining("Constancia de CUIT") }
    ]);
  });

  it("rasterizes a PDF and sends the rendered image to the vision provider", async () => {
    const h = harness({
      rows: { ok: true, value: [record()] },
      downloads: { [record().objectPath]: { ok: true, value: { bytes: PDF_BYTES, contentType: "application/pdf" } } },
      outcome: () => relevant()
    });

    await h.checker.check(command());

    expect(h.rasterizer.rasterize).toHaveBeenCalledExactlyOnceWith({ bytes: PDF_BYTES });
    expect(h.vision.assessRelevance).toHaveBeenCalledExactlyOnceWith({
      kind: "cuit",
      contentType: "image/png",
      imageBase64: base64(PNG_BYTES)
    });
  });

  it("passes an image straight through without rasterizing", async () => {
    const photo = record({
      documentId: "doc-photo",
      kind: "photo",
      objectPath: `${OWNER}/photo/abc-frente.jpg`,
      name: "frente.jpg",
      contentType: "image/jpeg"
    });
    const h = harness({
      rows: { ok: true, value: [photo] },
      downloads: { [photo.objectPath]: { ok: true, value: { bytes: JPEG_BYTES, contentType: "image/jpeg" } } },
      outcome: () => relevant()
    });

    await h.checker.check(command());

    expect(h.rasterizer.rasterize).not.toHaveBeenCalled();
    expect(h.vision.assessRelevance).toHaveBeenCalledExactlyOnceWith({
      kind: "photo",
      contentType: "image/jpeg",
      imageBase64: base64(JPEG_BYTES)
    });
  });

  it("names an irrelevant photo as the business photo", async () => {
    const photo = record({
      documentId: "doc-photo",
      kind: "photo",
      objectPath: `${OWNER}/photo/abc-frente.jpg`,
      name: "frente.jpg",
      contentType: "image/jpeg"
    });
    const h = harness({
      rows: { ok: true, value: [photo] },
      downloads: { [photo.objectPath]: { ok: true, value: { bytes: JPEG_BYTES, contentType: "image/jpeg" } } },
      outcome: () => irrelevant()
    });

    const result = await h.checker.check(command());

    expect(result.findings).toEqual([
      { code: "content_irrelevant", severity: "gap", detail: expect.stringContaining("Foto del negocio") }
    ]);
  });

  it("resolves the persisted rows only for the owner in the command, never a body field", async () => {
    const h = harness();

    await h.checker.check(command());

    expect(h.documents.listByOwner).toHaveBeenCalledExactlyOnceWith(OWNER);
  });

  it("still runs the declared-data rules and keeps a missing document a gap", async () => {
    const input: CompletenessCheckInput = {
      ...COMPLETE_INPUT,
      documents: [
        { kind: "cuit", present: true },
        { kind: "articles-of-incorporation", present: true }
      ]
    };
    const h = harness({
      rows: { ok: true, value: [record()] },
      downloads: { [record().objectPath]: { ok: true, value: { bytes: PDF_BYTES, contentType: "application/pdf" } } },
      outcome: () => relevant()
    });

    const result = await h.checker.check(command(input));

    expect(result.complete).toBe(false);
    expect(result.findings).toContainEqual({
      code: "missing_document",
      severity: "gap",
      detail: expect.stringContaining("Declaraciones de ventas")
    });
  });

  it("emits content_unverified when the object cannot be downloaded", async () => {
    const h = harness({
      rows: { ok: true, value: [record()] },
      downloads: { [record().objectPath]: { ok: false, error: { code: "not_found" } } },
      outcome: () => relevant()
    });

    const result = await h.checker.check(command());

    expect(result.complete).toBe(true);
    expect(result.findings).toEqual([
      { code: "content_unverified", severity: "warning", detail: expect.stringContaining("Constancia de CUIT") }
    ]);
    expect(h.vision.assessRelevance).not.toHaveBeenCalled();
  });

  it("emits content_unverified when the rasterizer cannot render the PDF", async () => {
    const h = harness({
      rows: { ok: true, value: [record()] },
      downloads: { [record().objectPath]: { ok: true, value: { bytes: PDF_BYTES, contentType: "application/pdf" } } },
      rasterize: { ok: false, error: { code: "invalid_pdf" } },
      outcome: () => relevant()
    });

    const result = await h.checker.check(command());

    expect(result.findings).toEqual([
      { code: "content_unverified", severity: "warning", detail: expect.stringContaining("Constancia de CUIT") }
    ]);
    expect(h.vision.assessRelevance).not.toHaveBeenCalled();
  });

  it("refuses to download an object path that is not under the owner's prefix", async () => {
    const foreign = record({ objectPath: `99999999-9999-4999-8999-999999999999/cuit/other.pdf` });
    const h = harness({ rows: { ok: true, value: [foreign] }, outcome: () => relevant() });

    const result = await h.checker.check(command());

    expect(h.storage.downloadObject).not.toHaveBeenCalled();
    expect(result.findings).toEqual([
      { code: "content_unverified", severity: "warning", detail: expect.stringContaining("Constancia de CUIT") }
    ]);
  });

  it("degrades to one content_unverified warning when the document list cannot be read", async () => {
    const input: CompletenessCheckInput = {
      ...COMPLETE_INPUT,
      documents: [
        { kind: "cuit", present: true },
        { kind: "articles-of-incorporation", present: true }
      ]
    };
    const h = harness({ rows: { ok: false, error: { code: "unavailable" } } });

    const result = await h.checker.check(command(input));

    expect(result.complete).toBe(false);
    expect(result.findings).toEqual([
      {
        code: "missing_document",
        severity: "gap",
        detail: expect.stringContaining("Declaraciones de ventas")
      },
      { code: "content_unverified", severity: "warning", detail: expect.any(String) }
    ]);
  });

  it("checks every persisted row and flags only the irrelevant one", async () => {
    const cuit = record();
    const statute = record({
      documentId: "doc-2",
      kind: "articles-of-incorporation",
      objectPath: `${OWNER}/articles-of-incorporation/abc-estatuto.pdf`,
      name: "estatuto.pdf"
    });
    const h = harness({
      rows: { ok: true, value: [cuit, statute] },
      downloads: {
        [cuit.objectPath]: { ok: true, value: { bytes: PDF_BYTES, contentType: "application/pdf" } },
        [statute.objectPath]: { ok: true, value: { bytes: PDF_BYTES, contentType: "application/pdf" } }
      },
      outcome: (input) => (input.kind === "articles-of-incorporation" ? irrelevant() : relevant())
    });

    const result = await h.checker.check(command());

    expect(h.vision.assessRelevance).toHaveBeenCalledTimes(2);
    expect(result.findings).toEqual([
      { code: "content_irrelevant", severity: "gap", detail: expect.stringContaining("Estatuto") }
    ]);
  });

  it("runs the declared rules only when the owner has no persisted documents", async () => {
    const h = harness({ rows: { ok: true, value: [] } });

    const result = await h.checker.check(command());

    expect(result).toEqual({ complete: true, findings: [] });
    expect(h.storage.downloadObject).not.toHaveBeenCalled();
    expect(h.vision.assessRelevance).not.toHaveBeenCalled();
  });
});

describe("rejected ports (R3-3): a rejected promise never rejects the check", () => {
  const reject = (): Promise<never> => Promise.reject(new Error("port rejected"));

  it("degrades the list read to one warning when listByOwner rejects", async () => {
    const documents = documentsDouble({ ok: true, value: [] });
    const checker = createContentAwareCompletenessCheckAdapter({
      documents: { ...documents.port, listByOwner: reject },
      storage: storageDouble({}).port,
      rasterizer: rasterizerDouble().port,
      vision: visionDouble(() => relevant()).port
    });

    await expect(checker.check(command())).resolves.toEqual({
      complete: true,
      findings: [{ code: "content_unverified", severity: "warning", detail: expect.any(String) }]
    });
  });

  it("degrades the document when the storage download rejects", async () => {
    const h = harness({ rows: { ok: true, value: [record()] } });
    const checker = createContentAwareCompletenessCheckAdapter({
      documents: h.documents.port,
      storage: { ...h.storage.port, downloadObject: reject },
      rasterizer: h.rasterizer.port,
      vision: h.vision.port
    });

    const result = await checker.check(command());

    expect(result.complete).toBe(true);
    expect(result.findings).toEqual([
      { code: "content_unverified", severity: "warning", detail: expect.stringContaining("Constancia de CUIT") }
    ]);
  });

  it("degrades the document when the rasterizer rejects", async () => {
    const h = harness({
      rows: { ok: true, value: [record()] },
      downloads: {
        [record().objectPath]: { ok: true, value: { bytes: PDF_BYTES, contentType: "application/pdf" } }
      }
    });
    const checker = createContentAwareCompletenessCheckAdapter({
      documents: h.documents.port,
      storage: h.storage.port,
      rasterizer: { ...h.rasterizer.port, rasterize: reject },
      vision: h.vision.port
    });

    const result = await checker.check(command());

    expect(result.findings).toEqual([
      { code: "content_unverified", severity: "warning", detail: expect.stringContaining("Constancia de CUIT") }
    ]);
  });

  it("degrades the document when the vision provider rejects", async () => {
    const h = harness({
      rows: { ok: true, value: [record()] },
      downloads: {
        [record().objectPath]: { ok: true, value: { bytes: PDF_BYTES, contentType: "application/pdf" } }
      }
    });
    const checker = createContentAwareCompletenessCheckAdapter({
      documents: h.documents.port,
      storage: h.storage.port,
      rasterizer: h.rasterizer.port,
      vision: { ...h.vision.port, assessRelevance: reject }
    });

    const result = await checker.check(command());

    expect(result.findings).toEqual([
      { code: "content_unverified", severity: "warning", detail: expect.stringContaining("Constancia de CUIT") }
    ]);
  });

  it("keeps every already-computed declared finding when a document rejects", async () => {
    const input: CompletenessCheckInput = {
      ...COMPLETE_INPUT,
      documents: [
        { kind: "cuit", present: true },
        { kind: "articles-of-incorporation", present: true }
      ]
    };
    const h = harness({ rows: { ok: true, value: [record()] } });
    const checker = createContentAwareCompletenessCheckAdapter({
      documents: h.documents.port,
      storage: { ...h.storage.port, downloadObject: reject },
      rasterizer: h.rasterizer.port,
      vision: h.vision.port
    });

    const result = await checker.check(command(input));

    expect(result.complete).toBe(false);
    expect(result.findings).toEqual([
      { code: "missing_document", severity: "gap", detail: expect.stringContaining("Declaraciones de ventas") },
      { code: "content_unverified", severity: "warning", detail: expect.stringContaining("Constancia de CUIT") }
    ]);
  });
});

describe("bounded content pass (R3-1): a row cap and an overall deadline", () => {
  function rows(count: number): PymeDocumentRecord[] {
    return Array.from({ length: count }, (_, index) =>
      record({ documentId: `doc-${index}`, objectPath: `${OWNER}/cuit/doc-${index}.pdf` })
    );
  }

  function downloadsFor(records: readonly PymeDocumentRecord[]): Readonly<Record<string, StorageResult<DownloadedObject>>> {
    return Object.fromEntries(
      records.map((row) => [
        row.objectPath,
        { ok: true as const, value: { bytes: PDF_BYTES, contentType: "application/pdf" } }
      ])
    );
  }

  it("caps how many documents one pass judges", async () => {
    const records = rows(9);
    const h = harness({ rows: { ok: true, value: records }, downloads: downloadsFor(records), outcome: () => relevant() });

    const result = await h.checker.check(command());

    expect(h.vision.assessRelevance).toHaveBeenCalledTimes(8);
    expect(result.findings).toEqual([
      { code: "content_unverified", severity: "warning", detail: expect.any(String) }
    ]);
  });

  it("judges no document once the overall deadline has passed, and keeps the declared findings", async () => {
    const records = rows(2);
    const input: CompletenessCheckInput = {
      ...COMPLETE_INPUT,
      documents: [
        { kind: "cuit", present: true },
        { kind: "articles-of-incorporation", present: true }
      ]
    };
    const h = harness({ rows: { ok: true, value: records }, downloads: downloadsFor(records), outcome: () => relevant() });
    const checker = createContentAwareCompletenessCheckAdapter({
      documents: h.documents.port,
      storage: h.storage.port,
      rasterizer: h.rasterizer.port,
      vision: h.vision.port,
      deadlineMs: 0
    });

    const result = await checker.check(command(input));

    expect(h.vision.assessRelevance).not.toHaveBeenCalled();
    expect(h.storage.downloadObject).not.toHaveBeenCalled();
    expect(result.complete).toBe(false);
    expect(result.findings).toEqual([
      { code: "missing_document", severity: "gap", detail: expect.stringContaining("Declaraciones de ventas") },
      { code: "content_unverified", severity: "warning", detail: expect.stringContaining("Constancia de CUIT") },
      { code: "content_unverified", severity: "warning", detail: expect.stringContaining("Constancia de CUIT") }
    ]);
  });

  it("still judges every document while the deadline has not passed", async () => {
    const records = rows(3);
    const h = harness({ rows: { ok: true, value: records }, downloads: downloadsFor(records), outcome: () => relevant() });

    const result = await h.checker.check(command());

    expect(h.vision.assessRelevance).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ complete: true, findings: [] });
  });
});
