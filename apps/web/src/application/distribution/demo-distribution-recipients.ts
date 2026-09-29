/**
 * Frozen synthetic recipient fixture for the distribution demo (Task #89 / S3).
 *
 * This is **synthetic demo data**, not a real recipient registry: the addresses
 * are invented Testnet accounts (`G…`, 56 characters, base32 alphabet) and the
 * amounts are integers chosen only to make the demo legible. No seeds, private
 * keys or PII appear here — an account id is a public key, never key material.
 *
 * Mapping the demo's settlement allocations to real Stellar destinations is
 * **future work**: the revenue-share engine's `contributorId` is an opaque
 * domain string, and a real product needs an investor registry that resolves it
 * to a public key the investor controls. Until that exists, the web has to send
 * *some* recipients to prepare a distribution, and this frozen fixture is that
 * stand-in. Each record carries the `SIMULADO` label itself so a consumer that
 * summarizes, charts or quotes the datum never has to reattach it independently.
 */

export const SIMULADO_DISTRIBUTION_LABEL = "SIMULADO" as const;

/**
 * The demo's declared revenue-share rule version, mirroring the domain engine's
 * canonical `RS-2026-01`. The API is the only authority for the calculation;
 * this value is carried for display only, under the `SIMULADO` label.
 */
export const DEMO_DISTRIBUTION_RULE_VERSION = "RS-2026-01" as const;

export interface DemoDistributionRecipient {
  /** Opaque demo contributor identifier; never a transaction field. */
  readonly contributorId: string;
  /** Synthetic Testnet destination account (`G…`). */
  readonly accountId: string;
  /** Integer stroop count (1 XLM = 10.000.000 stroops). */
  readonly amountStroops: bigint;
  readonly simuladoLabel: typeof SIMULADO_DISTRIBUTION_LABEL;
}

export interface DemoDistributionRecipients {
  readonly ruleVersion: string;
  readonly recipients: readonly DemoDistributionRecipient[];
  readonly simuladoLabel: typeof SIMULADO_DISTRIBUTION_LABEL;
}

export const demoDistributionRecipients: DemoDistributionRecipients = Object.freeze({
  ruleVersion: DEMO_DISTRIBUTION_RULE_VERSION,
  simuladoLabel: SIMULADO_DISTRIBUTION_LABEL,
  recipients: Object.freeze([
    Object.freeze({
      contributorId: "inversionista-01",
      accountId: "GDISTRIBUTIONDEMOV27EJOTY5CHMRW3AFKPUZ6DINSX4BGLQV27EJOT",
      amountStroops: 6_000_000n,
      simuladoLabel: SIMULADO_DISTRIBUTION_LABEL
    }),
    Object.freeze({
      contributorId: "inversionista-02",
      accountId: "GINVESTORONEDEMOQV27EJOTY5CHMRW3AFKPUZ6DINSX4BGLQV27EJOT",
      amountStroops: 4_000_000n,
      simuladoLabel: SIMULADO_DISTRIBUTION_LABEL
    }),
    Object.freeze({
      contributorId: "inversionista-03",
      accountId: "GINVESTORTWODEMOQV27EJOTY5CHMRW3AFKPUZ6DINSX4BGLQV27EJOT",
      amountStroops: 3_500_000n,
      simuladoLabel: SIMULADO_DISTRIBUTION_LABEL
    })
  ])
});
