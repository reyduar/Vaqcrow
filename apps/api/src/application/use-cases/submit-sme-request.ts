import { smeRequestSchema } from "@vaqcrow/contracts";
import type { ApplicationId, CorrelationId, SmeRequest } from "@vaqcrow/contracts";
import type { BusinessRepositoryPort } from "../ports/business-repository-port.js";
import type { NotificationPublisherPort } from "../ports/notification-publisher-port.js";
import type { SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";
import type { WalletRepositoryPort } from "../ports/wallet-repository-port.js";

/**
 * Submits the SME request and creates the application it belongs to. The
 * application id is generated here, server-side, and is the root identifier of
 * the whole demo journey: the caller never supplies it.
 *
 * Validation uses the shared contract and reports only sanitized
 * `{ field, code }` pairs — the envelope `apps/web` already understands. Raw
 * schema messages never leave this function.
 *
 * Submission is gated on the principal's stored Freighter key (Feature #406's
 * seam, closed here) and is idempotent across transport requests: the RPC's
 * correlation id is per-request, so an owner's replay is matched against the
 * request it already submitted. On a real apply only, the admin event
 * `admin.new_application` is published best-effort — a delivery failure never
 * fails the submission — and the advisory AI assessment is started in the
 * background (U12), never awaited, so it can neither delay nor fail the send.
 */

export interface SmeRequestFieldError {
  readonly field: string;
  readonly code: string;
}

export type SubmitSmeRequestError =
  | { readonly code: "invalid_request"; readonly fieldErrors: readonly SmeRequestFieldError[] }
  | { readonly code: "wallet_required" }
  | { readonly code: "unavailable"; readonly fieldErrors: readonly [] };

export type SubmitSmeRequestResult =
  | {
      readonly ok: true;
      readonly value: { readonly applicationId: ApplicationId; readonly request: SmeRequest; readonly applied: boolean };
    }
  | { readonly ok: false; readonly error: SubmitSmeRequestError };

/**
 * The collaborator that starts the advisory AI assessment of a newly applied
 * submission (U12). It is a single callback rather than the assessment ports so
 * this use case stays independent of the assessment engine — the same seam the
 * human decision uses to start a vault deploy. Invoking it is best-effort and
 * fire-and-forget: a slow or failing assessment never blocks or fails the send.
 * The assessment itself never decides: it only moves the application to
 * `human_review` (or to manual review on failure).
 */
export interface SubmissionAssessmentDependencies {
  readonly onSubmitted: (input: {
    readonly applicationId: ApplicationId;
    readonly correlationId: CorrelationId;
  }) => Promise<unknown>;
}

export interface SubmitSmeRequestDependencies {
  readonly repository: Pick<SmeRequestRepositoryPort, "submit" | "findByOwner">;
  readonly wallet: Pick<WalletRepositoryPort, "readPublicKey">;
  readonly businesses: Pick<BusinessRepositoryPort, "findByOwner">;
  readonly notifications: Pick<NotificationPublisherPort, "publish">;
  readonly generateApplicationId: () => ApplicationId;
  /** Optional: when omitted, a submission stays in `awaiting_assessment`. */
  readonly assessment?: SubmissionAssessmentDependencies | undefined;
}

/** The neutral label used when the owner's company cannot be resolved. */
const UNRESOLVED_SME_NAME = "PyME";

export async function submitSmeRequest(
  dependencies: SubmitSmeRequestDependencies,
  input: { readonly body: unknown; readonly correlationId: CorrelationId; readonly ownerUserId: string }
): Promise<SubmitSmeRequestResult> {
  const parsed = smeRequestSchema.safeParse(input.body);

  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "invalid_request", fieldErrors: toFieldErrors(input.body, parsed.error.issues) }
    };
  }

  // The wallet precondition is server-side and derived from the verified
  // principal, never from the body: a submission is only accepted once the
  // PyME's Freighter public key is stored on its profile.
  const key = await dependencies.wallet.readPublicKey(input.ownerUserId);
  if (!key.ok) {
    return { ok: false, error: { code: "unavailable", fieldErrors: [] } };
  }
  if (key.value === null) {
    return { ok: false, error: { code: "wallet_required" } };
  }

  // Fast path: the common sequential retry short-circuits here without reaching
  // the RPC. This read is awaited *before* `submit`, so it is not the
  // authoritative guard — two concurrent retries can both miss it. The RPC
  // `submit_sme_request` re-checks owner+content inside its own transaction under
  // an owner-scoped advisory lock, which is what makes the retry idempotent under
  // concurrency; this lookup only saves a round trip.
  const existing = await dependencies.repository.findByOwner(input.ownerUserId);
  if (!existing.ok) {
    return { ok: false, error: { code: "unavailable", fieldErrors: [] } };
  }
  const replay = existing.value.find(
    (record) => record.ownerUserId === input.ownerUserId && sameRequest(record.request, parsed.data)
  );
  if (replay !== undefined) {
    return { ok: true, value: { applicationId: replay.applicationId, request: replay.request, applied: false } };
  }

  const result = await dependencies.repository.submit({
    applicationId: dependencies.generateApplicationId(),
    request: parsed.data,
    correlationId: input.correlationId,
    ownerUserId: input.ownerUserId
  });

  if (!result.ok) {
    return result.error.code === "invalid_request"
      ? { ok: false, error: { code: "invalid_request", fieldErrors: [] } }
      : { ok: false, error: { code: "unavailable", fieldErrors: [] } };
  }

  // Only a real apply notifies the admin and starts the assessment: a replay
  // (owner match or correlation replay, which reports `applied: false`) must not
  // raise a second event nor spend a second assessment.
  if (result.value.applied) {
    if (dependencies.assessment !== undefined) {
      triggerAssessment(dependencies.assessment, result.value.applicationId, input.correlationId);
    }
    await publishNewApplication(dependencies, input.ownerUserId, result.value.applicationId);
  }

  // The owner is persistence metadata, not part of the submission result.
  return {
    ok: true,
    value: {
      applicationId: result.value.applicationId,
      request: result.value.request,
      applied: result.value.applied
    }
  };
}

/** The four declared fields identify a submission; the label is a constant. */
function sameRequest(a: SmeRequest, b: SmeRequest): boolean {
  return (
    a.smeReference === b.smeReference &&
    a.declaredTotalArs === b.declaredTotalArs &&
    a.periodStart === b.periodStart &&
    a.periodEnd === b.periodEnd
  );
}

/**
 * Raises the admin "new application" event, best-effort: neither a failed
 * business lookup nor a throwing publisher may fail the submission. An
 * unresolved business is published under a neutral label rather than dropped,
 * so the admin is still told a submission happened without leaking company data.
 */
async function publishNewApplication(
  dependencies: SubmitSmeRequestDependencies,
  ownerUserId: string,
  applicationId: ApplicationId
): Promise<void> {
  let smeName = UNRESOLVED_SME_NAME;
  try {
    const business = await dependencies.businesses.findByOwner(ownerUserId);
    if (business.ok) {
      smeName = business.value.name;
    }
  } catch {
    // The fallback label stands.
  }

  try {
    await dependencies.notifications.publish({
      eventKey: `application:${applicationId}:submitted`,
      type: "admin.new_application",
      smeName
    });
  } catch {
    // Delivery is best-effort by contract; the submission already succeeded.
  }
}

/**
 * Starts the assessment for a newly applied submission without blocking the
 * response. The callback is invoked immediately but its promise is deliberately
 * not awaited; a rejection or a synchronous throw is swallowed because the
 * submission is already persisted. The application then simply stays in
 * `awaiting_assessment`, and `POST /application-reviews/:id/assessments`
 * remains the explicit retry surface.
 */
function triggerAssessment(
  assessment: SubmissionAssessmentDependencies,
  applicationId: ApplicationId,
  correlationId: CorrelationId
): void {
  try {
    void Promise.resolve(assessment.onSubmitted({ applicationId, correlationId })).catch(() => {
      // Best-effort: the trigger logs its own sanitized outcome.
    });
  } catch {
    // A synchronously-throwing collaborator must never fail the submission.
  }
}

interface ContractIssue {
  readonly code: string;
  readonly path: readonly PropertyKey[];
}

function toFieldErrors(body: unknown, issues: readonly ContractIssue[]): readonly SmeRequestFieldError[] {
  const isObject = typeof body === "object" && body !== null && !Array.isArray(body);
  if (!isObject) {
    return [{ field: "body", code: "invalid" }];
  }

  // The period-order rule also fires when a period is malformed (the strings
  // still compare); that ordering complaint would be misleading, so it is
  // reported only when nothing else is wrong.
  const relevant = issues.some((issue) => issue.code !== "custom")
    ? issues.filter((issue) => issue.code !== "custom")
    : issues;

  const seen = new Set<string>();
  const errors: SmeRequestFieldError[] = [];
  for (const issue of relevant) {
    const error = toFieldError(body as Record<string, unknown>, issue);
    const key = `${error.field}:${error.code}`;
    if (!seen.has(key)) {
      seen.add(key);
      errors.push(error);
    }
  }
  return errors;
}

/**
 * A root-level issue (empty path: an unknown key, a refinement without a path)
 * belongs to the body as a whole. It is reported as `{ body, invalid }` — the
 * same pair a non-object body gets, which the web treats as a form-level
 * error — never as `required`, which would blame a field that is not missing.
 */
function toFieldError(body: Readonly<Record<string, unknown>>, issue: ContractIssue): SmeRequestFieldError {
  const field = issue.path[0];
  if (typeof field !== "string") {
    return { field: "body", code: "invalid" };
  }
  return { field, code: toCode(issue.code, body[field]) };
}

function toCode(issueCode: string, value: unknown): string {
  if (value === undefined) return "required";
  switch (issueCode) {
    case "invalid_format":
      return "invalid_format";
    case "too_small":
    case "too_big":
      return "out_of_range";
    case "custom":
      return "before_start";
    default:
      return "invalid";
  }
}
