import type { VisionOutcome, VisionProviderPort } from "@vaqcrow/ai";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompletenessCheckPort } from "../../../application/ports/completeness-check-port.js";
import type { PdfRasterizerPort } from "../../../application/ports/pdf-rasterizer-port.js";
import type {
  PymeDocumentRecord,
  PymeDocumentRepositoryPort
} from "../../../application/ports/pyme-document-repository-port.js";
import type { StoragePort } from "../../../application/ports/storage-port.js";
import { createDeterministicCompletenessCheckAdapter } from "../../adapters/deterministic-completeness-check-adapter.js";
import { createContentAwareCompletenessCheckAdapter } from "../../adapters/content-aware-completeness-check-adapter.js";
import { buildAppAs, principalFor } from "../test-support/auth.js";

const VALID_BODY = {
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

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

function build(checker: CompletenessCheckPort = createDeterministicCompletenessCheckAdapter()): FastifyInstance {
  app = buildAppAs("PYME", { completenessCheck: { checker } });
  return app;
}

describe("POST /completeness-check", () => {
  it("answers 200 { result } with the deterministic result", async () => {
    const response = await build().inject({ method: "POST", url: "/completeness-check", payload: VALID_BODY });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ result: { complete: true, findings: [] } });
  });

  it("passes the strictly parsed body and the verified owner to the port", async () => {
    const checker = { check: vi.fn().mockResolvedValue({ complete: true, findings: [] }) };

    await build(checker).inject({ method: "POST", url: "/completeness-check", payload: VALID_BODY });

    expect(checker.check).toHaveBeenCalledExactlyOnceWith({
      ownerUserId: principalFor("PYME").userId,
      input: VALID_BODY
    });
  });

  it("returns an incomplete result with 200: a gap warns, it never blocks", async () => {
    const checker = {
      check: vi.fn().mockResolvedValue({
        complete: false,
        findings: [{ code: "missing_document", severity: "gap", detail: "Falta un documento obligatorio: Estatuto." }]
      })
    };

    const response = await build(checker).inject({
      method: "POST",
      url: "/completeness-check",
      payload: { ...VALID_BODY, photoCount: 0 }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      result: {
        complete: false,
        findings: [{ code: "missing_document", severity: "gap", detail: "Falta un documento obligatorio: Estatuto." }]
      }
    });
  });

  it("accepts an empty documents list, leaving the missing documents to the check", async () => {
    const checker = { check: vi.fn().mockResolvedValue({ complete: false, findings: [] }) };

    const response = await build(checker).inject({
      method: "POST",
      url: "/completeness-check",
      payload: { ...VALID_BODY, documents: [] }
    });

    expect(response.statusCode).toBe(200);
    expect(checker.check).toHaveBeenCalledWith({
      ownerUserId: principalFor("PYME").userId,
      input: { ...VALID_BODY, documents: [] }
    });
  });

  it("takes the owner from the verified principal, never from the body", async () => {
    const checker = { check: vi.fn().mockResolvedValue({ complete: true, findings: [] }) };

    // A body carrying an attempted owner is refused outright by strict validation.
    const forged = await build(checker).inject({
      method: "POST",
      url: "/completeness-check",
      payload: { ...VALID_BODY, ownerUserId: "attacker" }
    });

    expect(forged.statusCode).toBe(400);
    expect(checker.check).not.toHaveBeenCalled();

    // And an ordinary body always carries the principal's id, never the body's.
    await build(checker).inject({ method: "POST", url: "/completeness-check", payload: VALID_BODY });
    expect(checker.check).toHaveBeenCalledWith({
      ownerUserId: principalFor("PYME").userId,
      input: VALID_BODY
    });
  });

  it("answers 503 { code: unavailable } and never echoes the failure when the port throws", async () => {
    const sentinel = "SENTINEL-completeness-detail-9a2";
    const checker = {
      check: vi.fn().mockRejectedValue(Object.assign(new Error(sentinel), { name: "CheckerCrashError" }))
    };
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await build(checker).inject({
      method: "POST",
      url: "/completeness-check",
      payload: VALID_BODY
    });

    expect(response.statusCode).toBe(503);
    expect(response.body).toBe(JSON.stringify({ code: "unavailable" }));
    expect(response.body).not.toContain(sentinel);
    expect(logged).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logged.mock.calls)).not.toContain(sentinel);
  });

  describe("content-aware path, composed end to end (U7)", () => {
    const OWNER = principalFor("PYME").userId;

    function persistedDocument(overrides: Partial<PymeDocumentRecord> = {}): PymeDocumentRecord {
      return {
        documentId: "doc-cuit",
        ownerUserId: OWNER,
        kind: "cuit",
        objectPath: `${OWNER}/cuit/abc-constancia.pdf`,
        name: "constancia.pdf",
        sizeBytes: 8,
        contentType: "application/pdf",
        createdAt: "2026-10-05T00:00:00.000Z",
        ...overrides
      };
    }

    /**
     * Composes the route with the real content-aware adapter and the real
     * declared-data rules; only the three I/O collaborators are doubles. This is
     * the one test that proves the verified principal's id reaches the content
     * pass end to end, and that a PDF gap still answers a non-blocking 200.
     */
    it("rasterizes the owner's persisted PDF and returns content_irrelevant as a 200", async () => {
      const cuit = persistedDocument();
      const listByOwner = vi.fn(async () => ({ ok: true as const, value: [cuit] }));
      const documents = {
        listByOwner,
        create: vi.fn(),
        deleteByObjectPath: vi.fn()
      } as unknown as PymeDocumentRepositoryPort;
      const downloadObject = vi.fn(async () => ({
        ok: true as const,
        value: { bytes: Uint8Array.from([1, 2, 3]), contentType: "application/pdf" }
      }));
      const storage = {
        uploadObject: vi.fn(),
        removeObject: vi.fn(),
        downloadObject
      } as unknown as StoragePort;
      const rasterize = vi.fn(async () => ({
        ok: true as const,
        value: { bytes: Uint8Array.from([4, 5]), contentType: "image/png" }
      }));
      const rasterizer = { rasterize } as unknown as PdfRasterizerPort;
      const assessRelevance = vi.fn(async (): Promise<VisionOutcome> => ({
        ok: true,
        value: { relevant: false, reason: "No parece una Constancia de CUIT." },
        metadata: {
          model: "test-vision",
          promptVersion: "vision-v1",
          generatedAt: "2026-10-05T00:00:00.000Z",
          source: "simulated"
        }
      }));
      const vision = { assessRelevance } as unknown as VisionProviderPort;

      const checker = createContentAwareCompletenessCheckAdapter({
        documents,
        storage,
        rasterizer,
        vision
      });

      const response = await build(checker).inject({
        method: "POST",
        url: "/completeness-check",
        payload: VALID_BODY
      });

      // The declared rules passed, so the only finding is the content one — and
      // a gap warns, it never blocks the send.
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        result: {
          complete: false,
          findings: [
            {
              code: "content_irrelevant",
              severity: "gap",
              detail: expect.stringContaining("Constancia de CUIT")
            }
          ]
        }
      });
      // The owner is the verified principal end to end, never a body field.
      expect(listByOwner).toHaveBeenCalledExactlyOnceWith(OWNER);
      // A PDF is rasterized before the vision provider sees it.
      expect(rasterize).toHaveBeenCalledTimes(1);
      expect(assessRelevance).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "cuit", contentType: "image/png" })
      );
    });
  });

  describe("strict body validation", () => {
    const cases: ReadonlyArray<readonly [string, unknown, readonly { field: string; code: string }[]]> = [
      ["a body that is not an object", [], [{ field: "body", code: "invalid" }]],
      ["an unknown top-level key", { ...VALID_BODY, ownerUserId: "attacker" }, [{ field: "body", code: "invalid" }]],
      ["a missing required key", { photoCount: 2 }, [
        { field: "documents", code: "required" },
        { field: "salesMonths", code: "required" }
      ]],
      ["documents that are not an array", { ...VALID_BODY, documents: {} }, [{ field: "documents", code: "invalid" }]],
      [
        "a document with an unknown kind",
        { ...VALID_BODY, documents: [{ kind: "selfie", present: true }] },
        [{ field: "documents", code: "invalid_kind" }]
      ],
      [
        "a document with a non-boolean present flag",
        {
          ...VALID_BODY,
          documents: [
            { kind: "cuit", present: true },
            { kind: "sales-declarations", present: true },
            { kind: "articles-of-incorporation", present: "yes" }
          ]
        },
        [{ field: "documents", code: "invalid" }]
      ],
      [
        "a duplicated document kind",
        {
          ...VALID_BODY,
          documents: [
            { kind: "cuit", present: true },
            { kind: "cuit", present: false },
            { kind: "articles-of-incorporation", present: true }
          ]
        },
        [{ field: "documents", code: "invalid" }]
      ],
      ["a non-integer photoCount", { ...VALID_BODY, photoCount: 2.5 }, [{ field: "photoCount", code: "invalid" }]],
      ["a negative photoCount", { ...VALID_BODY, photoCount: -1 }, [{ field: "photoCount", code: "invalid" }]],
      [
        "a sales month with an empty label",
        { ...VALID_BODY, salesMonths: [{ month: "", valueArs: 100 }] },
        [{ field: "salesMonths", code: "invalid" }]
      ],
      [
        "a sales month with a negative value",
        { ...VALID_BODY, salesMonths: [{ month: "Enero", valueArs: -5 }] },
        [{ field: "salesMonths", code: "invalid" }]
      ],
      [
        "more than eight sales months",
        {
          ...VALID_BODY,
          salesMonths: Array.from({ length: 9 }, (_value, index) => ({
            month: `Mes ${index}`,
            valueArs: 100
          }))
        },
        [{ field: "salesMonths", code: "invalid" }]
      ]
    ];

    it.each(cases)("answers 400 with the sanitized field errors for %s", async (_label, payload, errors) => {
      const checker = { check: vi.fn() };

      const response = await build(checker).inject({
        method: "POST",
        url: "/completeness-check",
        payload: payload as object
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ errors });
      expect(checker.check).not.toHaveBeenCalled();
    });
  });
});
