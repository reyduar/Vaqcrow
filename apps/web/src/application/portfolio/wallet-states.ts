import {
  walletConnectFailureCopy,
  type WalletConnectFailure
} from "@/application/pyme-onboarding/wallet-connection";

/**
 * Connect-mode copy and state text of the investor portfolio (Feature #426,
 * WU4). React-free so the wording and the error mapping are unit-tested without
 * rendering.
 *
 * The connect flow itself is not re-implemented here: the portfolio calls the
 * PyME flow's `connectAndStoreWallet` and reports failures through
 * `walletConnectErrorMessage`, which reuses the PyME copy verbatim so both
 * surfaces tell the same person the same thing. `walletConnectFailureCopy` is
 * itself built from `WALLET_KIND_COPY` (the wallet's own outcomes) and
 * `WALLET_CONNECTION_COPY` (the API's persistence codes).
 */

/** Every string the portfolio's wallet card shows before a key is connected. */
export const PORTFOLIO_WALLET_COPY = Object.freeze({
  connectTitle: "Conectá tu wallet Freighter",
  connectBody:
    "Conectá Freighter para ver el saldo de tu cuenta en Stellar Testnet. Vaqcrow no custodia tus fondos ni tus claves.",
  connectCta: "Conectar Freighter",
  connecting: "Conectando…",
  fundsTitle: "¿Tu cuenta no tiene fondos?",
  fundsBody:
    "Estás en Testnet: los XLM de prueba no tienen valor económico. Podés pedirlos con Friendbot o abrir Stellar Laboratory.",
  friendbotLabel: "Pedir XLM de prueba (Friendbot)",
  laboratoryLabel: "Abrir Stellar Laboratory"
});

/**
 * Empty portfolio copy (#426/WU4). Neutral and honest: it describes the empty
 * state without promising any return. The exact wording is owner-pending.
 */
export const EMPTY_PORTFOLIO_COPY = Object.freeze({
  title: "Todavía no aportaste a ninguna PyME",
  body: "Cuando aportes a una campaña vas a ver acá su estado y las distribuciones que te correspondan.",
  cta: "Explorar PyMEs"
});

/** Stellar's Testnet faucet, which funds a fresh account with test XLM. */
export const TESTNET_FRIENDBOT_URL = "https://friendbot.stellar.org";
/** Stellar Laboratory, where a Testnet account can also be funded manually. */
export const TESTNET_LABORATORY_URL = "https://laboratory.stellar.org";

/**
 * The visible message for a failed connection. Delegates to the PyME flow so
 * the portfolio never re-assembles its own error copy; the code the wallet or
 * the API reported selects the string.
 */
export function walletConnectErrorMessage(failure: WalletConnectFailure): string {
  return walletConnectFailureCopy(failure);
}
