/**
 * Identity-verification capability of the PyME onboarding wizard: KYC/KYB is
 * a replaceable provider behind this port. Vendor-free and React-free; the
 * simulated adapter lives in `infrastructure/kyc/`.
 *
 * In this demo the result is always simulated — the outcome, the provider and
 * the reference are shown with the `SIMULADO` marker and never constitute a
 * real identity verification. The port carries no document contents: the
 * caller names one of two synthetic identities, never a real person's data.
 */

/**
 * The two synthetic identities the demo offers, mapping 1:1 to the template's
 * `<select>` options (`person_a` is the responsable, `person_b` the socia).
 */
export type KycDocument = "person_a" | "person_b";

/**
 * `approved`: identity and company verified by the simulated adapter.
 * `requires_changes`: the test document does not match the company, retry.
 */
export type KycOutcome = "approved" | "requires_changes";

export interface KycResult {
  readonly outcome: KycOutcome;
  /** Provider-assigned reference shown to the person (e.g. `kyc:PH-2026-0001`). */
  readonly reference: string;
  /** The provider label; the demo shows `SIMULADO` next to every result. */
  readonly provider: string;
}

export interface KycVerifyInput {
  readonly document: KycDocument;
}

export interface KycPort {
  /**
   * Runs the simulated verification for one synthetic document. Resolves with
   * the deterministic result; a provider failure rejects so the caller can
   * return to the idle state and let the person retry.
   */
  verify(input: KycVerifyInput): Promise<KycResult>;
}
