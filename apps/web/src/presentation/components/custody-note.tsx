import { CanonicalDisclosure } from "./canonical-disclosure";

/**
 * CustodyNote (Issue #310 / T2): the vault (the contract, not a person)
 * holds the campaign's funds. Renders the canonical `contract-custody`
 * disclosure through `CanonicalDisclosure` — the only render path for that
 * text — rather than duplicating `TrustBanner` markup here. When a wallet
 * signer is in context (e.g. the funding step, where Freighter signs on the
 * person's behalf), `includeSigner` also renders the canonical
 * `non-custody` disclosure alongside it, matching how `step-disclosures.ts`
 * pairs `testnet`, `non-custody` and `contract-custody` at the funding step.
 */
export interface CustodyNoteProps {
  /** Also render the canonical non-custody (signer) disclosure. Default: false. */
  readonly includeSigner?: boolean;
  readonly lang?: "es" | "en";
  readonly className?: string;
}

export function CustodyNote({ includeSigner = false, lang = "es", className }: CustodyNoteProps) {
  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`.trim()}>
      <CanonicalDisclosure id="contract-custody" lang={lang} />
      {includeSigner ? <CanonicalDisclosure id="non-custody" lang={lang} /> : null}
    </div>
  );
}
