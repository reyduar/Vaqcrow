import type { SmeRequest } from "@vaqcrow/contracts";
import type { SmeRequestGateway } from "@/application/ports/sme-request-gateway";
import type { SmeRequestFormValues, SmeRequestSubmitError } from "./review-view-model";
import { toSmeSubmitError } from "./sme-request-errors";

export type BuildSmeRequestResult =
  | { readonly ok: true; readonly request: SmeRequest }
  | { readonly ok: false; readonly error: SmeRequestSubmitError };

export type SubmitSmeRequestResult = BuildSmeRequestResult;

const DIGITS_ONLY = /^\d+$/;

/**
 * Builds the contract-shaped request from raw form strings. The amount must be
 * a non-negative integer of pesos (the demo has no cents); anything else is
 * rejected here, before any network call, and is never coerced or rounded.
 * Period order and other business rules stay with the backend.
 */
export function buildSmeRequest(values: SmeRequestFormValues, smeReference: string): BuildSmeRequestResult {
  const amount = DIGITS_ONLY.test(values.declaredTotalArs) ? Number(values.declaredTotalArs) : Number.NaN;
  if (!Number.isSafeInteger(amount)) {
    return {
      ok: false,
      error: { fieldErrors: { declaredTotalArs: "El total debe ser un número entero de pesos." } }
    };
  }
  return {
    ok: true,
    request: {
      smeReference,
      declaredTotalArs: amount,
      periodStart: values.periodStart,
      periodEnd: values.periodEnd,
      simuladoLabel: "SIMULADO"
    }
  };
}

/** Never reports success unless the gateway resolved with a validated request. */
export async function submitSmeRequest(
  gateway: SmeRequestGateway,
  values: SmeRequestFormValues,
  smeReference: string
): Promise<SubmitSmeRequestResult> {
  const built = buildSmeRequest(values, smeReference);
  if (!built.ok) return built;
  try {
    return { ok: true, request: await gateway.submit(built.request) };
  } catch (error) {
    return { ok: false, error: toSmeSubmitError(error) };
  }
}
