import type { BusinessDraft, BusinessErrorCode, BusinessPort, BusinessRecord } from "@/application/ports/business-port";
import { cuitDigits, parseAmount, type RegistrationValues } from "./registration-step";

/**
 * Persists the company from the wizard's step 4 before the SME request is sent
 * (Feature #398, Task #399 / T3c). React-free so the mapping and the
 * ensure-then-create flow are unit-tested without rendering.
 *
 * The owner is the API's responsibility: the draft has no owner field and this
 * model never adds one.
 */

/** Maps the wizard's raw form strings onto the API's company draft. */
export function businessDraftFromRegistration(values: RegistrationValues): BusinessDraft {
  return {
    name: values.name.trim(),
    cuit: cuitDigits(values.cuit),
    sector: values.sector,
    city: values.city.trim(),
    description: values.desc.trim(),
    goalArs: parseAmount(values.goal),
    revenueShare: parseAmount(values.rs)
  };
}

export type EnsureBusinessResult =
  | { readonly ok: true; readonly business: BusinessRecord; readonly created: boolean }
  | { readonly ok: false; readonly code: BusinessErrorCode };

/**
 * Ensures the signed-in principal owns a company: an existing one is reused
 * (never duplicated), and only `not_found` triggers a create. Any other read
 * failure stops before writing, so a transient backend error never creates a
 * second company.
 */
export async function ensureMyBusiness(
  port: BusinessPort,
  values: RegistrationValues
): Promise<EnsureBusinessResult> {
  const existing = await port.getMyBusiness();
  if (existing.ok) return { ok: true, business: existing.business, created: false };
  if (existing.code !== "not_found") return { ok: false, code: existing.code };

  const created = await port.createBusiness(businessDraftFromRegistration(values));
  return created.ok ? { ok: true, business: created.business, created: true } : { ok: false, code: created.code };
}
