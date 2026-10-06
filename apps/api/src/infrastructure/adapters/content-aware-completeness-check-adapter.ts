import type { VisionKind, VisionProviderPort } from "@vaqcrow/ai";
import { Buffer } from "node:buffer";
import {
  checkCompleteness,
  COMPLETENESS_CONTENT_LABELS,
  type CompletenessCheckResult,
  type CompletenessFinding
} from "../../application/completeness/completeness-check.js";
import type {
  CompletenessCheckCommand,
  CompletenessCheckPort
} from "../../application/ports/completeness-check-port.js";
import type { PdfRasterizerPort } from "../../application/ports/pdf-rasterizer-port.js";
import type {
  PymeDocumentRecord,
  PymeDocumentRepositoryPort,
  PymeDocumentRepositoryResult
} from "../../application/ports/pyme-document-repository-port.js";
import type { StoragePort } from "../../application/ports/storage-port.js";
import { isOwnedObjectPath } from "../../application/storage/object-path.js";
import type { DocumentKind } from "../../application/storage/document-upload.js";

/**
 * The content-aware completeness checker (content-relevance/vision feature, U5).
 *
 * It **composes** the pure declared-data rules with a content pass:
 *
 * 1. `checkCompleteness(command.input)` runs first, unchanged — a missing
 *    mandatory document is still a gap even when every uploaded file is relevant.
 * 2. The owner's persisted `pyme_document` rows are resolved with
 *    `listByOwner(command.ownerUserId)` (owner from the verified principal).
 * 3. Per row: the path is re-checked with `isOwnedObjectPath` before any read,
 *    the bytes are downloaded, a PDF is rasterized to its first page (D1) and the
 *    image is judged by the vision provider; a non-PDF image passes straight
 *    through.
 * 4. An irrelevant verdict is `content_irrelevant` with severity **`gap`** (D2)
 *    — it warns, it never blocks the send. Anything that stops a document from
 *    being judged (unowned path, unreadable object, unrenderable PDF, a failed or
 *    malformed vision answer) becomes the honest, non-blocking `content_unverified`
 *    `warning`, never a silent pass and never a failed check.
 *
 * The model's own `reason` never crosses this boundary: finding copy is fixed and
 * server-authored, so untrusted model text cannot reach the UI.
 *
 * It lives in `infrastructure/` because it performs I/O (storage, rasterizer,
 * vision); `application/` keeps only the port and the pure rules.
 */

export interface ContentAwareCompletenessCheckDependencies {
  readonly documents: PymeDocumentRepositoryPort;
  readonly storage: StoragePort;
  readonly rasterizer: PdfRasterizerPort;
  readonly vision: VisionProviderPort;
}

/**
 * The persisted `kind` and the vision vocabulary are the same four slots today;
 * the explicit map makes that a checked contract rather than a coincidence — if
 * either union gains a slot, this no longer compiles.
 */
const VISION_KIND_BY_DOCUMENT: Readonly<Record<DocumentKind, VisionKind>> = Object.freeze({
  "sales-declarations": "sales-declarations",
  cuit: "cuit",
  "articles-of-incorporation": "articles-of-incorporation",
  photo: "photo"
});

/** Owner-pending Spanish copy (U5): names the document so meaning never rides on colour alone. */
const irrelevantCopy = (label: string): string =>
  `El contenido de «${label}» no parece corresponder a ese documento.`;
const unverifiedCopy = (label: string): string => `No pudimos verificar el contenido de «${label}».`;
const UNVERIFIED_LIST_COPY = "No pudimos verificar el contenido de tus documentos.";

/**
 * The honest warning for one document whose content could not be judged. Shared
 * by the in-band `{ ok: false }` paths and by a port that rejects its promise:
 * R3-3 is a resilience fix, so both failures must degrade identically.
 */
const unverifiedDocumentFinding = (kind: DocumentKind): CompletenessFinding => ({
  code: "content_unverified",
  severity: "warning",
  detail: unverifiedCopy(COMPLETENESS_CONTENT_LABELS[kind])
});

function isGap(finding: CompletenessFinding): boolean {
  return finding.severity === "gap";
}

/**
 * Judge one persisted document. Returns zero findings when it is relevant and
 * exactly one when it is irrelevant (gap) or could not be verified (warning).
 */
async function checkDocument(
  dependencies: ContentAwareCompletenessCheckDependencies,
  record: PymeDocumentRecord,
  ownerUserId: string
): Promise<readonly CompletenessFinding[]> {
  const label = COMPLETENESS_CONTENT_LABELS[record.kind];
  const unverified = (): readonly CompletenessFinding[] => [unverifiedDocumentFinding(record.kind)];

  // Defence in depth: the adapter runs as service_role, so the API owns this
  // check. A row whose path escaped the owner prefix is never read.
  if (!isOwnedObjectPath(record.objectPath, ownerUserId)) {
    return unverified();
  }

  const downloaded = await dependencies.storage.downloadObject(record.objectPath);
  if (!downloaded.ok) {
    return unverified();
  }

  // The persisted content type is the server-validated one from upload; the
  // vision provider accepts images only, so a PDF is rasterized to its first page.
  let imageBase64: string;
  let imageContentType: string;
  if (record.contentType === "application/pdf") {
    const rasterized = await dependencies.rasterizer.rasterize({ bytes: downloaded.value.bytes });
    if (!rasterized.ok) {
      return unverified();
    }
    imageBase64 = Buffer.from(rasterized.value.bytes).toString("base64");
    imageContentType = rasterized.value.contentType;
  } else {
    imageBase64 = Buffer.from(downloaded.value.bytes).toString("base64");
    imageContentType = record.contentType;
  }

  const outcome = await dependencies.vision.assessRelevance({
    kind: VISION_KIND_BY_DOCUMENT[record.kind],
    contentType: imageContentType,
    imageBase64
  });
  if (!outcome.ok) {
    return unverified();
  }
  if (outcome.value.relevant) {
    return [];
  }
  return [{ code: "content_irrelevant", severity: "gap", detail: irrelevantCopy(label) }];
}

export function createContentAwareCompletenessCheckAdapter(
  dependencies: ContentAwareCompletenessCheckDependencies
): CompletenessCheckPort {
  return {
    async check(command: CompletenessCheckCommand): Promise<CompletenessCheckResult> {
      const findings: CompletenessFinding[] = [...checkCompleteness(command.input).findings];

      const degradeListRead = (): CompletenessCheckResult => {
        // The declared rules already ran; a read failure — resolved `{ ok: false }`
        // or a rejected promise — degrades to one honest warning instead of
        // failing the whole advisory check.
        findings.push({
          code: "content_unverified",
          severity: "warning",
          detail: UNVERIFIED_LIST_COPY
        });
        return { complete: !findings.some(isGap), findings };
      };

      let listed: PymeDocumentRepositoryResult<readonly PymeDocumentRecord[]>;
      try {
        listed = await dependencies.documents.listByOwner(command.ownerUserId);
      } catch {
        // R3-3: a rejected port must not reject `check` (the route would turn it
        // into a 503 and discard the declared findings already computed).
        return degradeListRead();
      }
      if (!listed.ok) {
        return degradeListRead();
      }

      for (const record of listed.value) {
        try {
          findings.push(...(await checkDocument(dependencies, record, command.ownerUserId)));
        } catch {
          // R3-3: a rejecting port degrades exactly like an in-band `{ ok: false }`
          // inside `checkDocument` — one non-blocking warning for this document.
          // `findings` keeps every declared finding, never a silent pass, never a
          // failed check.
          findings.push(unverifiedDocumentFinding(record.kind));
        }
      }

      return { complete: !findings.some(isGap), findings };
    }
  };
}
