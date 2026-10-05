import { z } from "zod";
import type { VisionRelevance } from "./vision-relevance.js";

/**
 * The vision provider boundary (Feature #402, U3).
 *
 * Same discipline as `assessment-provider-port.ts`: nothing vendor-specific
 * crosses this boundary — no SDK type, no API key, no provider error shape —
 * and a failure is a closed, sanitized code the caller can branch on.
 *
 * It lives in `packages/ai` for the same reason the assessment port does: the
 * workspace rule `packages-never-import-apps` forbids a package from importing
 * an application, so a port owned by `apps/api` could never be implemented
 * inside this package.
 */

/**
 * The four slots a PyME uploads (mirrors `DOCUMENT_KINDS` in
 * `apps/api/src/application/storage/document-upload.ts`). The vocabulary is
 * duplicated rather than imported because a package may not import an app;
 * the API maps its own kind onto this one at the call site.
 */
export const VISION_KINDS = [
  "sales-declarations",
  "cuit",
  "articles-of-incorporation",
  "photo"
] as const;

export type VisionKind = (typeof VISION_KINDS)[number];

/**
 * Model, prompt and generation provenance, retained so a relevance finding can
 * always name what judged it. Mirrors the assessment metadata; `source` is not
 * decoration — a simulated provider marks itself as such so it can never pass
 * for a real evaluation downstream.
 */
export const visionMetadataSchema = z.strictObject({
  model: z.string().trim().min(1).max(120),
  promptVersion: z.string().trim().min(1).max(120),
  generatedAt: z.iso.datetime({ offset: true }),
  source: z.enum(["simulated", "provider"])
});

export type VisionMetadata = z.infer<typeof visionMetadataSchema>;

/**
 * Provider failures are closed to sanitized codes. `timeout` and
 * `provider_unavailable` are the transport's; `invalid_output` is the answer's
 * — a malformed verdict is a failure, not a relevance result.
 */
export type VisionProviderFailure = {
  readonly code: "timeout" | "provider_unavailable" | "invalid_output";
};

export type VisionOutcome =
  | {
      readonly ok: true;
      /** Already validated against `visionRelevanceSchema` on the adapter side. */
      readonly value: VisionRelevance;
      readonly metadata: VisionMetadata;
    }
  | { readonly ok: false; readonly error: VisionProviderFailure };

export interface VisionProviderPort {
  /**
   * Judges whether one image is the document or photo its slot claims.
   *
   * The input is an image and its content type — PDFs are rasterized before
   * this point (U4). The adapter embeds the bytes as a data URL; nothing about
   * the provider's request shape leaks into this signature.
   */
  assessRelevance(input: {
    readonly kind: VisionKind;
    readonly contentType: string;
    readonly imageBase64: string;
  }): Promise<VisionOutcome>;
}
