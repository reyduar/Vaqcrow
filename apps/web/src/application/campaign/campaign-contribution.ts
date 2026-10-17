import { formatStroopsAsXlm } from "@/application/format/stroops";
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

/**
 * The demo's real signable networks. A campaign's `network` is the API's
 * `config.stellar.network`: `"testnet"` on Testnet (lowercase) and `"local"`
 * on the local profile. A campaign on anything else cannot be signed here.
 * Compared case-insensitively: the wallet reports its own label (`"TESTNET"`),
 * and a network name is a human-readable identifier, not a case-sensitive key.
 */
const SIGNABLE_NETWORKS: ReadonlySet<string> = new Set(["testnet", "local"]);

/**
 * The refusal copy when the campaign is on a network this demo cannot sign.
 * Owner-pending: the template draws no such message, and the wording that names
 * exactly what IS supported is not yet confirmed by the owner.
 */
export const UNSUPPORTED_NETWORK_MESSAGE =
  "Esta demo sólo firma aportes en Stellar Testnet o en el entorno local.";

/**
 * Amount failures: the conversion's own kinds, the minimum-amount rule, and the
 * over-funding rule (#579/S1).
 */
export type ContributionAmountError = XlmAmountError | "below_minimum" | "exceeds_remaining";

export type ContributionAmountResult =
  | { readonly ok: true; readonly stroops: string }
  | { readonly ok: false; readonly error: ContributionAmountError };

const AMOUNT_MESSAGES: Readonly<Record<ContributionAmountError, string>> = {
  invalid_format: "Ingresá un monto en XLM, por ejemplo 12.5.",
  too_many_decimals: "El monto admite hasta 7 decimales (1 XLM = 10.000.000 stroops).",
  not_positive: "El monto tiene que ser mayor que cero.",
  below_minimum: `El aporte mínimo es ${MIN_CONTRIBUTION_XLM} XLM.`,
  exceeds_remaining: "El aporte supera lo que falta para alcanzar la meta. Aportá como máximo el remanente."
};

/**
 * The floor a contribution must clear, in stroops. Normally the demo's 10 XLM
 * minimum, but a campaign whose remainder is smaller can still be closed from
 * the screen: the floor drops to what is left (#579/S1). `null`/`undefined`
 * means the remaining is not known yet (no chain snapshot), so the fixed
 * minimum stands.
 */
export function minimumContributionStroops(remainingStroops?: string | null): bigint {
  const minimum = BigInt(MIN_CONTRIBUTION_STROOPS);
  if (remainingStroops === null || remainingStroops === undefined) return minimum;
  const remaining = BigInt(remainingStroops);
  return remaining < minimum ? remaining : minimum;
}

/**
 * The sanitized copy for one amount failure; never a provider message. When the
 * remaining is known, the two rules that depend on it name the real limit — the
 * number a person can act on — instead of the generic wording.
 */
export function contributionAmountMessage(
  error: ContributionAmountError,
  remainingStroops?: string | null
): string {
  if (remainingStroops === null || remainingStroops === undefined) return AMOUNT_MESSAGES[error];

  if (error === "exceeds_remaining") {
    return `El aporte no puede superar lo que falta para alcanzar la meta: ${formatStroopsAsXlm(
      BigInt(remainingStroops)
    )} XLM.`;
  }

  if (error === "below_minimum" && BigInt(remainingStroops) < BigInt(MIN_CONTRIBUTION_STROOPS)) {
    return `El aporte mínimo es ${formatStroopsAsXlm(
      minimumContributionStroops(remainingStroops)
    )} XLM: es lo que falta para alcanzar la meta.`;
  }

  return AMOUNT_MESSAGES[error];
}

/**
 * Converts the person's input and enforces both rules: the amount may not
 * exceed what is left to reach the goal (#579/S1), and it must clear the
 * minimum — the demo's 10 XLM, relaxed to the remaining when that is smaller.
 * Money stays a decimal integer string (`xlmToStroops`' own rule): every
 * comparison is a `bigint`, never a float.
 */
export function validateContributionAmount(
  input: string,
  remainingStroops?: string | null
): ContributionAmountResult {
  const parsed = xlmToStroops(input);
  if (!parsed.ok) return parsed;

  const stroops = BigInt(parsed.stroops);

  if (remainingStroops !== null && remainingStroops !== undefined) {
    if (stroops > BigInt(remainingStroops)) return { ok: false, error: "exceeds_remaining" };
  }

  if (stroops < minimumContributionStroops(remainingStroops)) {
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
  /**
   * What is left to reach the goal, in stroops, from the chain snapshot; `null`
   * while the snapshot has not arrived (#579/S1). Unknown means "do not enforce
   * the bound here" — the API preflight stays the authority.
   */
  readonly remainingStroops?: string | null;
}

/**
 * The single sanitized reason signing must not proceed, or `null` when the
 * review is safe to open: the amount clears the minimum and does not exceed
 * what is left to reach the goal (#579/S1), the vault id is known, and the
 * campaign is on a network this demo can sign (`testnet` or `local`). The
 * Freighter network itself is verified by the wallet adapter at sign time;
 * this is the pre-sign check the issue names.
 */
export function contributionPreSignError(input: ContributionPreSignInput): string | null {
  const validated = validateContributionAmount(input.amountInput, input.remainingStroops);
  if (!validated.ok) return contributionAmountMessage(validated.error, input.remainingStroops);

  if (!input.vaultAddress || input.vaultAddress.trim() === "") {
    return "La campaña todavía no tiene una bóveda desplegada; no se puede aportar.";
  }

  if (input.network !== null && !SIGNABLE_NETWORKS.has(input.network.trim().toLowerCase())) {
    return UNSUPPORTED_NETWORK_MESSAGE;
  }

  return null;
}
