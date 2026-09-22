import { z } from "zod";
import type { AssessmentEvidenceBundle } from "./assessment-evidence.js";

/**
 * The provider boundary (docs/architecture/monorepo.md line 71: "encapsular el
 * proveedor LLM"). It lives in `packages/ai` because the workspace rule
 * `packages-never-import-apps` forbids a package from importing an application,
 * so a port owned by `apps/api` could never be implemented inside this package.
 *
 * Nothing provider-specific crosses this boundary: no SDK type, no API key, no
 * vendor error shape. A real provider is one more implementation of this
 * interface, which is what "provider stays replaceable" means concretely.
 */

/**
 * Model and prompt provenance, retained so a recommendation can always show
 * what produced it (docs/planning/DEMO.md §5). `source` is not decoration: a
 * simulated provider marks itself as such so it can never pass for a real
 * evaluation downstream.
 */
export const assessmentMetadataSchema = z.strictObject({
  model: z.string().trim().min(1).max(120),
  promptVersion: z.string().trim().min(1).max(120),
  generatedAt: z.iso.datetime({ offset: true }),
  source: z.enum(["simulated", "provider"])
});

export type AssessmentMetadata = z.infer<typeof assessmentMetadataSchema>;

/**
 * Provider failures are closed to two sanitized codes. A vendor's own error
 * vocabulary — status codes, messages, retry hints — never crosses this
 * boundary, the same way Horizon's result codes never cross the Stellar one.
 */
export type AssessmentProviderFailure = {
  readonly code: "timeout" | "provider_unavailable";
};

export type AssessmentProviderOutcome =
  | {
      readonly ok: true;
      /**
       * Untrusted, unvalidated provider output. Deliberately `unknown`: a
       * provider does not get to declare its own output valid, so validation
       * happens on the caller's side of this boundary.
       */
      readonly rawOutput: unknown;
      readonly metadata: AssessmentMetadata;
    }
  | { readonly ok: false; readonly error: AssessmentProviderFailure };

export interface AssessmentProviderPort {
  assess(input: {
    readonly evidence: AssessmentEvidenceBundle;
  }): Promise<AssessmentProviderOutcome>;
}
