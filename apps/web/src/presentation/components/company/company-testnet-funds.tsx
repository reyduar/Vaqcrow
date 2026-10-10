import { IoGitNetworkOutline, IoOpenOutline } from "react-icons/io5";

/**
 * Testnet funds guide (Feature #434, WU5, owner decision D5): a short text and
 * a link to Friendbot so the PyME funds its **own** wallet. Vaqcrow is
 * non-custodial and never moves funds; this component never performs the
 * funding — it only points at the public Friendbot service and states the
 * limit.
 *
 * The template's PyME mode does not design this guide, so the copy is neutral,
 * honest Spanish and owner-pending. The link is prefilled with the connected
 * public key when one is known; Friendbot requires a public address (G), never
 * a secret, and only Testnet XLM (no economic value) is involved.
 */
export interface CompanyTestnetFundsProps {
  /** The connected wallet's public key, or `null` when none is linked yet. */
  readonly publicKey?: string | null;
}

export const TESTNET_FUNDS_COPY = Object.freeze({
  title: "Fondear tu wallet con XLM de prueba",
  body: "Tu wallet necesita XLM de Testnet para operar. Vaqcrow no custodia fondos ni mueve dinero: vos fondeás tu propia cuenta.",
  friendbot: "Fondear con Friendbot",
  genericHint: "Abrí Friendbot y pegá la dirección pública de tu wallet (empieza con G).",
  prefilledHint: "El enlace ya incluye tu dirección pública. Abrila para fondearla.",
  noValue: "Sólo XLM de Testnet, sin valor económico. Friendbot pide una dirección pública, nunca una clave privada."
});

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

export function CompanyTestnetFunds({ publicKey = null }: CompanyTestnetFundsProps) {
  const prefilled = publicKey !== null && publicKey !== "";

  return (
    <section
      aria-label="Guía para fondear tu wallet de Testnet"
      className="flex flex-col gap-3 rounded-panel border border-page-border bg-raised p-5"
    >
      <header className="flex flex-wrap items-center gap-2">
        <IoGitNetworkOutline aria-hidden="true" focusable="false" className="text-[20px] text-text-secondary" />
        <h2 className="m-0 text-[17px] font-[650]">{TESTNET_FUNDS_COPY.title}</h2>
        <span className="inline-flex h-[22px] items-center rounded-pill border border-page-border px-2.5 text-xs font-[650] tracking-[0.04em] text-text-secondary">
          TESTNET
        </span>
      </header>

      <p className="m-0 text-sm leading-normal text-text-secondary">{TESTNET_FUNDS_COPY.body}</p>

      <a
        href={friendbotUrl(publicKey)}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex h-11 w-fit items-center gap-1.5 rounded-control bg-brand-accent px-4 text-sm font-semibold text-on-accent hover:bg-brand-accent-hover"
      >
        {TESTNET_FUNDS_COPY.friendbot}
        <IoOpenOutline aria-hidden="true" focusable="false" className="text-[15px]" />
      </a>

      <p className="m-0 text-[13px] leading-[1.5] text-text-secondary">
        {prefilled ? TESTNET_FUNDS_COPY.prefilledHint : TESTNET_FUNDS_COPY.genericHint}
      </p>
      <p className="m-0 text-[13px] leading-[1.5] text-text-secondary">{TESTNET_FUNDS_COPY.noValue}</p>
    </section>
  );
}
