import type {
  BusinessDraft,
  BusinessRecord,
  BusinessRepositoryPort
} from "../ports/business-repository-port.js";

/**
 * The company use cases (Feature #398, Task #399 / T3b).
 *
 * Validation mirrors the database's own `CHECK` constraints (an 11-digit CUIT, a
 * positive goal, a revenue share in [1, 10]) plus the required-string rules the
 * columns impose, and reports only sanitized `{ field, code }` pairs. The owner
 * is always the authenticated principal the route resolved, never a field in the
 * body — a body that carries one is refused outright.
 */

export interface BusinessFieldError {
  readonly field: string;
  readonly code: string;
}

const DRAFT_KEYS: ReadonlySet<string> = new Set([
  "name",
  "cuit",
  "sector",
  "city",
  "description",
  "goalArs",
  "revenueShare",
  "deadline"
]);

const CUIT_PATTERN = /^[0-9]{11}$/;

/**
 * Matches the campaign contract's deadline shape (`z.iso.datetime({ offset: true })`):
 * a full date-time with an explicit `Z` or `±HH:MM` offset. The `Date.parse`
 * round-trip rejects impossible dates the pattern alone would let through
 * (for example a `2026-13-01` month).
 */
const ISO_DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function isIsoDateTime(value: string): boolean {
  return ISO_DATETIME_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

export type BusinessValidation =
  | { readonly ok: true; readonly value: BusinessDraft }
  | { readonly ok: false; readonly fieldErrors: readonly BusinessFieldError[] };

function requiredString(
  value: unknown,
  field: string,
  errors: BusinessFieldError[],
  maxLength: number
): string | undefined {
  if (value === undefined || value === null) {
    errors.push({ field, code: "required" });
    return undefined;
  }
  if (typeof value !== "string") {
    errors.push({ field, code: "invalid" });
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    errors.push({ field, code: "required" });
    return undefined;
  }
  if (trimmed.length > maxLength) {
    errors.push({ field, code: "out_of_range" });
    return undefined;
  }
  return trimmed;
}

export function validateBusinessDraft(body: unknown): BusinessValidation {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, fieldErrors: [{ field: "body", code: "invalid" }] };
  }

  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => !DRAFT_KEYS.has(key))) {
    return { ok: false, fieldErrors: [{ field: "body", code: "invalid" }] };
  }

  const errors: BusinessFieldError[] = [];
  const name = requiredString(record["name"], "name", errors, 160);
  const sector = requiredString(record["sector"], "sector", errors, 80);
  const city = requiredString(record["city"], "city", errors, 80);
  const description = requiredString(record["description"], "description", errors, 2000);

  const cuitValue = record["cuit"];
  let cuit: string | undefined;
  if (cuitValue === undefined || cuitValue === null) {
    errors.push({ field: "cuit", code: "required" });
  } else if (typeof cuitValue !== "string" || !CUIT_PATTERN.test(cuitValue.trim())) {
    errors.push({ field: "cuit", code: "invalid_format" });
  } else {
    cuit = cuitValue.trim();
  }

  const goalValue = record["goalArs"];
  let goalArs: number | undefined;
  if (goalValue === undefined || goalValue === null) {
    errors.push({ field: "goalArs", code: "required" });
  } else if (typeof goalValue !== "number" || !Number.isFinite(goalValue) || !Number.isInteger(goalValue)) {
    errors.push({ field: "goalArs", code: "invalid" });
  } else if (goalValue < 1) {
    errors.push({ field: "goalArs", code: "out_of_range" });
  } else {
    goalArs = goalValue;
  }

  const revenueValue = record["revenueShare"];
  let revenueShare: number | undefined;
  if (revenueValue === undefined || revenueValue === null) {
    errors.push({ field: "revenueShare", code: "required" });
  } else if (typeof revenueValue !== "number" || !Number.isFinite(revenueValue)) {
    errors.push({ field: "revenueShare", code: "invalid" });
  } else if (revenueValue < 1 || revenueValue > 10) {
    errors.push({ field: "revenueShare", code: "out_of_range" });
  } else {
    revenueShare = revenueValue;
  }

  const deadlineValue = record["deadline"];
  let deadline: string | undefined;
  if (deadlineValue !== undefined && deadlineValue !== null) {
    if (typeof deadlineValue !== "string" || !isIsoDateTime(deadlineValue.trim())) {
      errors.push({ field: "deadline", code: "invalid_format" });
    } else {
      deadline = deadlineValue.trim();
    }
  }

  if (errors.length > 0) {
    return { ok: false, fieldErrors: errors };
  }

  return {
    ok: true,
    value: {
      name: name as string,
      cuit: cuit as string,
      sector: sector as string,
      city: city as string,
      description: description as string,
      goalArs: goalArs as number,
      revenueShare: revenueShare as number,
      ...(deadline === undefined ? {} : { deadline })
    }
  };
}

export type CreateBusinessError =
  | { readonly code: "invalid_request"; readonly fieldErrors: readonly BusinessFieldError[] }
  | { readonly code: "unavailable"; readonly fieldErrors: readonly [] };

export type CreateBusinessResult =
  | { readonly ok: true; readonly value: BusinessRecord }
  | { readonly ok: false; readonly error: CreateBusinessError };

export interface CreateBusinessDependencies {
  readonly repository: Pick<BusinessRepositoryPort, "createForOwner">;
}

export async function createBusiness(
  dependencies: CreateBusinessDependencies,
  input: { readonly ownerUserId: string; readonly body: unknown }
): Promise<CreateBusinessResult> {
  const validated = validateBusinessDraft(input.body);

  if (!validated.ok) {
    return { ok: false, error: { code: "invalid_request", fieldErrors: validated.fieldErrors } };
  }

  const created = await dependencies.repository.createForOwner({
    ownerUserId: input.ownerUserId,
    draft: validated.value
  });

  if (created.ok) {
    return { ok: true, value: created.value };
  }

  return created.error.code === "invalid_request"
    ? { ok: false, error: { code: "invalid_request", fieldErrors: [] } }
    : { ok: false, error: { code: "unavailable", fieldErrors: [] } };
}

export type GetMyBusinessResult =
  | { readonly ok: true; readonly value: BusinessRecord }
  | { readonly ok: false; readonly error: { readonly code: "not_found" | "unavailable" } };

export interface GetMyBusinessDependencies {
  readonly repository: Pick<BusinessRepositoryPort, "findByOwner">;
}

export async function getMyBusiness(
  dependencies: GetMyBusinessDependencies,
  input: { readonly ownerUserId: string }
): Promise<GetMyBusinessResult> {
  const found = await dependencies.repository.findByOwner(input.ownerUserId);

  if (found.ok) {
    return { ok: true, value: found.value };
  }

  return {
    ok: false,
    error: { code: found.error.code === "not_found" ? "not_found" : "unavailable" }
  };
}
