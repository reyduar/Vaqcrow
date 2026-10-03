import { KYC_PROVIDER_LABEL } from "@/application/pyme-onboarding/kyc-step";
import type { KycDocument, KycPort, KycResult, KycVerifyInput } from "@/application/ports/kyc-port";

/**
 * Deterministic simulated KYC/KYB adapter (owner decision: KYC is simulated and
 * behind a port). No network, no document contents, no clock and no randomness:
 * the same synthetic document always yields the same result, which is what the
 * demo's test doubles and Playwright run rely on.
 *
 * ASSUMPTION FOR THE OWNER (recorded, not in the template): the template only
 * exposed the outcome through a `kycOutcome` prop, so it never fixed which
 * synthetic document produces which result. The demo's deterministic mapping
 * is `person_a` (responsable) → approved and `person_b` (socia) →
 * requires_changes; confirm or change it before this reaches a real provider.
 */

/** The template's ~1.3 s spinner (line 313: `setTimeout(..., 1300)`). */
export const SIMULATED_KYC_DELAY_MS = 1300;

/** Canonical provider label, shared with the presentation copy. */
export const KYC_PROVIDER = KYC_PROVIDER_LABEL;

const OUTCOMES: Readonly<Record<KycDocument, KycResult["outcome"]>> = Object.freeze({
  person_a: "approved",
  person_b: "requires_changes"
});

const REFERENCES: Readonly<Record<KycDocument, string>> = Object.freeze({
  person_a: "kyc:PH-2026-0001",
  person_b: "kyc:PH-2026-0002"
});

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class SimulatedKycAdapter implements KycPort {
  private readonly delayMs: number;

  /** Injectable delay (ms); tests pass `0` or drive fake timers. */
  constructor(delayMs: number = SIMULATED_KYC_DELAY_MS) {
    this.delayMs = delayMs;
  }

  async verify({ document }: KycVerifyInput): Promise<KycResult> {
    await wait(this.delayMs);
    return { outcome: OUTCOMES[document], reference: REFERENCES[document], provider: KYC_PROVIDER };
  }
}
