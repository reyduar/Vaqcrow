/**
 * The PyME company capability of the onboarding wizard (Feature #398, Task
 * #399 / T3c). Vendor-free and React-free: the HTTP adapter lives in
 * `infrastructure/business/`.
 *
 * A company belongs to exactly one owner, and the API is the single
 * enforcement point: it resolves the owner from the verified token, so the
 * browser never sends one. `BusinessDraft` therefore carries no owner field —
 * a draft with an owner key is a defect, not a payload.
 *
 * Every failure is a sanitized code in the API's own vocabulary plus the
 * transport's `network`; provider messages never cross this boundary.
 */

/** The company data the wizard collects; exactly the API's `POST /businesses` body. */
export interface BusinessDraft {
  readonly name: string;
  /** Eleven digits, no separators. */
  readonly cuit: string;
  readonly sector: string;
  readonly city: string;
  readonly description: string;
  /** The financing goal in whole ARS, always greater than zero. */
  readonly goalArs: number;
  /** The revenue-share percentage, inclusive of 1 and 10. */
  readonly revenueShare: number;
}

/** A stored company as `POST /businesses` and `GET /businesses/mine` return it. */
export interface BusinessRecord extends BusinessDraft {
  readonly businessId: string;
  /** Resolved by the backend; echoed back, never sent by this client. */
  readonly ownerUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Sanitized failure codes. They mirror the API's `{ code }` / `{ errors }`
 * envelopes plus the transport's own `network`; the UI maps each one to copy.
 */
export type BusinessErrorCode = "invalid_request" | "not_found" | "unauthorized" | "unavailable" | "network";

export const BUSINESS_ERROR_CODES: readonly BusinessErrorCode[] = Object.freeze([
  "invalid_request",
  "not_found",
  "unauthorized",
  "unavailable",
  "network"
]);

export type BusinessResult =
  | { readonly ok: true; readonly business: BusinessRecord }
  | { readonly ok: false; readonly code: BusinessErrorCode };

export interface BusinessPort {
  /** Creates the signed-in principal's company; the owner is never a parameter. */
  createBusiness(draft: BusinessDraft): Promise<BusinessResult>;
  /** The signed-in principal's own company; `not_found` when none is registered. */
  getMyBusiness(): Promise<BusinessResult>;
}
