import { xlmToStroops, type XlmAmountError } from "@/application/funding/xlm-amount";

/**
 * Pure, React-free contribution rules for the campaign detail (Feature #422,
 * WU3). The detail page shows the minimum the template designs ("10 XLM de
 * prueba") but the demo never adds a contract `min_contribution` (owner
 * decision D3): the rule lives here, in the view layer, and the contract stays
 * unchanged.
 *
 * "Saldo insuficiente" is deliberately NOT a case: the only balance adapter
 * available today simulates an unfunded account (`simulated-wallet-balance-
 * adapter.ts`), so a specific insufficient-balance error would be invented
 * (owner decision D4). A real balance failure is left to the engine's existing
 * generic failure mapping.
 */

/** 1 XLM = 10,000,000 stroops, so 10 XLM = 100,000,000 stroops. */
export const MIN_CONTRIBUTION_STROOPS = "100000000";

/** The displayed minimum, exactly as the template writes it. */
export const MIN_CONTRIBUTION_XLM = "10";

/** The network this demo declares; a campaign on anything else cannot be signed here. */
const TESTNET = "TESTNET";

/** Amount failures: the conversion's own kinds plus the minimum-amount rule. */
export type ContributionAmountError = XlmAmountError | "below_minimum";

export type ContributionAmountResult =
  | { readonly ok: true; readonly stroops: string }
  | { readonly ok: false; readonly error: ContributionAmountError };

const AMOUNT_MESSAGES: Readonly<Record<ContributionAmountError, string>> = {
  invalid_format: "Ingresá un monto en XLM, por ejemplo 12.5.",
  too_many_decimals: "El monto admite hasta 7 decimales (1 XLM = 10.000.000 stroops).",
  not_positive: "El monto tiene que ser mayor que cero.",
  below_minimum: `El aporte mínimo es ${MIN_CONTRIBUTION_XLM} XLM.`
};

/** The sanitized copy for one amount failure; never a provider message. */
export function contributionAmountMessage(error: ContributionAmountError): string {
  return AMOUNT_MESSAGES[error];
}

/**
 * Converts the person's input and enforces the 10 XLM minimum. Money stays a
 * decimal integer string (`xlmToStroops`' own rule): the comparison is a
 * `bigint`, never a float.
 */
export function validateContributionAmount(input: string): ContributionAmountResult {
  const parsed = xlmToStroops(input);
  if (!parsed.ok) return parsed;
  if (BigInt(parsed.stroops) < BigInt(MIN_CONTRIBUTION_STROOPS)) {
    return { ok: false, error: "below_minimum" };
  }
  return { ok: true, stroops: parsed.stroops };
}

export interface ContributionPreSignInput {
  readonly amountInput: string;
  /** The campaign's vault id; `null` when the demo has not persisted one. */
  readonly vaultAddress: string | null;
  /** The chain-observed network once the engine loaded it; `null` while unknown. */
  readonly network: string | null;
}

/**
 * The single sanitized reason signing must not proceed, or `null` when the
 * review is safe to open: the amount is at least the 10 XLM minimum, the vault
 * id is known, and the campaign declares Stellar Testnet. The Freighter network
 * itself is verified by the wallet adapter at sign time; this is the pre-sign
 * check the issue names.
 */
export function contributionPreSignError(input: ContributionPreSignInput): string | null {
  const validated = validateContributionAmount(input.amountInput);
  if (!validated.ok) return contributionAmountMessage(validated.error);

  if (!input.vaultAddress || input.vaultAddress.trim() === "") {
    return "La campaña todavía no tiene una bóveda desplegada; no se puede aportar.";
  }

  if (input.network !== null && input.network !== TESTNET) {
    return "Esta demo sólo opera en Stellar Testnet.";
  }

  return null;
}
