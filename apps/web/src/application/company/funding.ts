/**
 * Funding copy and state of the `/company` Testnet-funds guide (Feature #434;
 * reworked by issue #531). React-free so the wording and the funded/unfunded
 * decision can be unit-tested without rendering; the presentational component
 * in `presentation/components/company/` only renders what this module decides.
 *
 * The guide no longer sends the PyME to Friendbot as its primary action
 * (owner finding, 2026-10-15): opening Friendbot on an already-funded account
 * lands on its own 400 page and never reflects whether the wallet is connected
 * or funded. The primary action now connects Freighter; once connected the
 * guide shows the account's balance and says whether it can pay for the vault
 * deploy. Friendbot stays as explanatory, secondary help — offered only while
 * the account still needs funds, and prefilled with the public key so it is
 * used with the address it requires.
 *
 * Vaqcrow is non-custodial: it never holds keys nor moves funds, and only
 * Testnet XLM (no economic value) is involved.
 */

/** The three shapes of the guide, derived from the connection and the balance. */
export type FundingState = "disconnected" | "funded" | "unfunded";

/**
 * The least XLM a Testnet account needs to create the vault: Stellar's base
 * reserve (1 XLM) plus a fee margin. Below it the account cannot pay, so the
 * guide warns instead of staying silent.
 */
export const MIN_TESTNET_XLM = 1;

/** Every string the `/company` Testnet-funds guide shows. Copy is owner-pending. */
export const TESTNET_FUNDS_COPY = Object.freeze({
  title: "Fondear tu wallet con XLM de prueba",
  badge: "TESTNET",
  body: "Tu wallet necesita XLM de Testnet para crear la bóveda. Vaqcrow no custodia fondos ni mueve dinero: vos fondeás tu propia cuenta.",
  connect: "Conectar Freighter",
  connecting: "Conectando…",
  disconnectedHint: "Conectá tu wallet para ver su saldo y saber si puede pagar la creación de la bóveda.",
  // The number itself lives in the wallet card above; the guide never repeats it (#531).
  balancePointer: "Mirá tu saldo disponible en la tarjeta de wallet, arriba.",
  fundedNote: "Tu cuenta ya tiene XLM de Testnet para pagar la creación de la bóveda.",
  unfundedWarning: "Tu cuenta todavía no tiene XLM de Testnet: sin saldo no se puede crear la bóveda.",
  friendbotHelp: "Friendbot fondea una cuenta de Testnet una sola vez, con su dirección pública y nunca con la clave privada.",
  friendbotLink: "Pedir XLM de prueba con Friendbot",
  noValue: "Sólo XLM de Testnet, sin valor económico."
});

/**
 * Whether the guide is disconnected, connected with enough XLM, or connected
 * without it. An empty public key is the same as none; a missing or non-numeric
 * balance is never treated as funded.
 */
export function fundingState(
  publicKey: string | null | undefined,
  balanceXlm: string | null | undefined
): FundingState {
  if (publicKey === null || publicKey === undefined || publicKey === "") return "disconnected";
  const balance = balanceXlm === null || balanceXlm === undefined ? Number.NaN : Number(balanceXlm);
  return Number.isFinite(balance) && balance >= MIN_TESTNET_XLM ? "funded" : "unfunded";
}

/**
 * The public Friendbot URL: prefilled with the wallet's public key when one is
 * known, generic otherwise. `https://friendbot.stellar.org` without `addr`
 * returns a 400, so the generic form is only a starting point the person
 * completes with their own address.
 */
export function friendbotUrl(publicKey?: string | null): string {
  return publicKey === undefined || publicKey === null || publicKey === ""
    ? "https://friendbot.stellar.org"
    : `https://friendbot.stellar.org/?addr=${encodeURIComponent(publicKey)}`;
}
