import {
  aiAssessmentSchema,
  validateAssessmentEvidence
} from "./ai-assessment.js";
import type { AiAssessment, AssessmentEvidenceViolation } from "./ai-assessment.js";
import { citableReferences } from "./assessment-evidence.js";
import type { AssessmentEvidenceBundle } from "./assessment-evidence.js";
import { assessmentMetadataSchema } from "./assessment-provider-port.js";
import type {
  AssessmentMetadata,
  AssessmentProviderFailure,
  AssessmentProviderOutcome,
  AssessmentProviderPort
} from "./assessment-provider-port.js";

/**
 * The provider-independent half of the boundary: call, validate, and fail in a
 * typed way. Every failure mode collapses to a code the caller can branch on,
 * and none of them produces a success — a provider that times out, breaks or
 * answers nonsense routes the case to a person, never to an approval.
 */

export type RunAssessmentError =
  | AssessmentProviderFailure
  /** The output did not satisfy the assessment contract from Feature #20. */
  | { readonly code: "invalid_output" }
  /** The output cited evidence that was not supplied to the model. */
  | {
      readonly code: "unknown_evidence_reference";
      readonly violations: readonly AssessmentEvidenceViolation[];
    };

export type RunAssessmentResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly assessment: AiAssessment;
        readonly metadata: AssessmentMetadata;
      };
    }
  | { readonly ok: false; readonly error: RunAssessmentError };

export const DEFAULT_ASSESSMENT_TIMEOUT_MS = 30_000;

const TIMED_OUT = Symbol("assessment-timed-out");

/**
 * Bounds the provider call. `Promise.race` is enough here and keeps the package
 * free of an `AbortSignal` dependency; the loser of the race is abandoned, and
 * the timer is always cleared so a settled call cannot keep the process alive.
 */
async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number
): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      work,
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs);
      })
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * Normalizes what a provider handed back before the contract judges it.
 *
 * A chat provider answers with **text**, so the raw output is a string that
 * contains the JSON object the contract describes. Parsing it is normalization,
 * not validation: an unparseable string is passed through untouched and the
 * contract rejects it as `invalid_output`, which is exactly the outcome a
 * malformed answer deserves.
 *
 * Markdown fences are deliberately **not** stripped. The prompt asks for one
 * JSON object and nothing else; an answer wrapped in a fence is not that, and
 * forgiving it here would hide a prompt or model regression behind leniency.
 */
function normalizeRawOutput(rawOutput: unknown): unknown {
  if (typeof rawOutput !== "string") {
    return rawOutput;
  }

  try {
    return JSON.parse(rawOutput);
  } catch {
    return rawOutput;
  }
}

/** A provider that throws is a provider that is unavailable, not an exception the caller must remember to catch. */
async function callProvider(
  provider: AssessmentProviderPort,
  evidence: AssessmentEvidenceBundle
): Promise<AssessmentProviderOutcome> {
  try {
    return await provider.assess({ evidence });
  } catch {
    return { ok: false, error: { code: "provider_unavailable" } };
  }
}

/**
 * Rebuilds the failure from the one field that is allowed across the boundary.
 *
 * Passing the provider's object through would let an adapter attach `message`,
 * `retryAfterMs` or a vendor trace to an error a caller logs — the repository
 * forbids leaking `message`/`details`/`hint` from an adapter, and a type does
 * not survive contact with a third-party implementation at runtime. An
 * unrecognised code fails closed to `provider_unavailable`.
 */
function sanitizeProviderFailure(failure: AssessmentProviderFailure): AssessmentProviderFailure {
  return failure.code === "timeout" ? { code: "timeout" } : { code: "provider_unavailable" };
}

export async function runAssessment(
  provider: AssessmentProviderPort,
  input: {
    readonly evidence: AssessmentEvidenceBundle;
    readonly timeoutMs?: number;
  }
): Promise<RunAssessmentResult> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_ASSESSMENT_TIMEOUT_MS;

  const outcome = await withTimeout(callProvider(provider, input.evidence), timeoutMs);

  if (outcome === TIMED_OUT) {
    return { ok: false, error: { code: "timeout" } };
  }

  if (!outcome.ok) {
    return { ok: false, error: sanitizeProviderFailure(outcome.error) };
  }

  const parsed = aiAssessmentSchema.safeParse(normalizeRawOutput(outcome.rawOutput));

  if (!parsed.success) {
    return { ok: false, error: { code: "invalid_output" } };
  }

  // Provenance is validated on the same side of the boundary as the output, so
  // the metadata a caller shows is exactly the declared shape and nothing a
  // provider decided to append to it.
  const metadata = assessmentMetadataSchema.safeParse(outcome.metadata);

  if (!metadata.success) {
    return { ok: false, error: { code: "invalid_output" } };
  }

  const evidence = validateAssessmentEvidence(parsed.data, citableReferences(input.evidence));

  if (!evidence.ok) {
    return {
      ok: false,
      error: { code: "unknown_evidence_reference", violations: evidence.violations }
    };
  }

  return { ok: true, value: { assessment: parsed.data, metadata: metadata.data } };
}
