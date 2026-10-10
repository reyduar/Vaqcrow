/**
 * Test-only in-memory `KycPort`. No network, no timers.
 *
 * It mirrors the adapter's observable contract: one deterministic result per
 * synthetic document, a provider label, and a reference string. It adds test
 * controls the real adapter does not have — `seedResult`, `failNext` and a
 * held promise (`holdNextVerify`) so a test can assert the busy state without
 * fake timers.
 *
 * Not collected as a test suite: it has no `.test.` segment.
 */
import type { KycDocument, KycPort, KycResult, KycVerifyInput } from "@/application/ports/kyc-port";

/** Sanitized rejection of a `KycPort.verify` call; carries no provider message. */
export class KycVerificationError extends Error {
  constructor() {
    super("KYC verification failed");
    this.name = "KycVerificationError";
  }
}

export class FakeKyc implements KycPort {
  /** Verify requests received, in order. */
  readonly calls: KycVerifyInput[] = [];
  private readonly results = new Map<KycDocument, KycResult>();
  private failures = 0;
  private held: Promise<void> | null = null;

  /** Overrides the result returned for `document`. */
  seedResult(document: KycDocument, result: KycResult): void {
    this.results.set(document, result);
  }

  /** The next `verify` call rejects with `KycVerificationError`. */
  failNext(): void {
    this.failures += 1;
  }

  /**
   * Holds the next `verify` resolution until the returned release is called.
   * The request is recorded when the call starts, so the busy state is
   * observable while the promise is pending.
   */
  holdNextVerify(): () => void {
    let release!: () => void;
    this.held = new Promise<void>((resolve) => {
      release = resolve;
    });
    return release;
  }

  async verify(input: KycVerifyInput): Promise<KycResult> {
    this.calls.push(input);
    const held = this.held;
    this.held = null;
    if (held) await held;
    if (this.failures > 0) {
      this.failures -= 1;
      throw new KycVerificationError();
    }
    return (
      this.results.get(input.document) ?? {
        outcome: "approved",
        reference: "kyc:FAKE-0001",
        provider: "Adaptador KYC simulado v1"
      }
    );
  }
}
