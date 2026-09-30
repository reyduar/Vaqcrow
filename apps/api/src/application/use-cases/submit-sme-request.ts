import { smeRequestSchema } from "@vaqcrow/contracts";
import type { ApplicationId, CorrelationId, SmeRequest } from "@vaqcrow/contracts";
import type { SmeRequestRepositoryPort } from "../ports/sme-request-repository-port.js";

/**
 * Submits the SME request and creates the application it belongs to. The
 * application id is generated here, server-side, and is the root identifier of
 * the whole demo journey: the caller never supplies it.
 *
 * Validation uses the shared contract and reports only sanitized
 * `{ field, code }` pairs — the envelope `apps/web` already understands. Raw
 * schema messages never leave this function.
 */

export interface SmeRequestFieldError {
  readonly field: string;
  readonly code: string;
}

export type SubmitSmeRequestError =
  | { readonly code: "invalid_request"; readonly fieldErrors: readonly SmeRequestFieldError[] }
  | { readonly code: "unavailable"; readonly fieldErrors: readonly [] };

export type SubmitSmeRequestResult =
  | {
      readonly ok: true;
      readonly value: { readonly applicationId: ApplicationId; readonly request: SmeRequest; readonly applied: boolean };
    }
  | { readonly ok: false; readonly error: SubmitSmeRequestError };

export interface SubmitSmeRequestDependencies {
  readonly repository: Pick<SmeRequestRepositoryPort, "submit">;
  readonly generateApplicationId: () => ApplicationId;
}

export async function submitSmeRequest(
  dependencies: SubmitSmeRequestDependencies,
  input: { readonly body: unknown; readonly correlationId: CorrelationId }
): Promise<SubmitSmeRequestResult> {
  const parsed = smeRequestSchema.safeParse(input.body);

  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "invalid_request", fieldErrors: toFieldErrors(input.body, parsed.error.issues) }
    };
  }

  const result = await dependencies.repository.submit({
    applicationId: dependencies.generateApplicationId(),
    request: parsed.data,
    correlationId: input.correlationId
  });

  if (result.ok) {
    return { ok: true, value: result.value };
  }

  return result.error.code === "invalid_request"
    ? { ok: false, error: { code: "invalid_request", fieldErrors: [] } }
    : { ok: false, error: { code: "unavailable", fieldErrors: [] } };
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
    const field = typeof issue.path[0] === "string" ? issue.path[0] : "body";
    const value = (body as Record<string, unknown>)[field];
    const error = { field, code: toCode(issue.code, value) };
    const key = `${error.field}:${error.code}`;
    if (!seen.has(key)) {
      seen.add(key);
      errors.push(error);
    }
  }
  return errors;
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
