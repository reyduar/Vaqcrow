"use client";

import { useId, useState } from "react";
import {
  IoAlertCircleOutline,
  IoCheckmarkOutline,
  IoCopyOutline,
  IoGitNetworkOutline,
  IoOpenOutline,
  IoWalletOutline
} from "react-icons/io5";
import { shortPublicKey } from "@/application/pyme-onboarding/review-step";
import { FOCUS_RING } from "./auth-field";

/**
 * Wallet card of `Vaqcrow Portafolio.dc.html:116–137` (Feature #406, Task #407
 * / T1c). It renders a connected, non-custodial Freighter account on its purple
 * surface with the template's verbatim copy: «Freighter conectada de forma no
 * custodial», the `STELLAR TESTNET` badge, «Saldo disponible», «Activo de
 * prueba sin valor económico», the shortened key with `Copiar`/`Copiada`, the
 * Stellar Testnet explorer link and `Desconectar`.
 *
 * Presentational only: the container loads the connection and the balance, so
 * this component never talks to the network. When the account is frozen (a vault
 * already exists) the card says so and refuses to replace the key — the
 * `Desconectar` action is disabled with a visible reason.
 */
export interface WalletCardProps {
  readonly publicKey: string;
  /** `true` once a vault exists: the destination can no longer change. */
  readonly frozen: boolean;
  /** Already-formatted XLM balance; `null` while it is loading or unavailable. */
  readonly balanceXlm: string | null;
  /** Caller-supplied Stellar Testnet account URL. */
  readonly explorerUrl: string;
  /** Disconnect action; never called while frozen. */
  readonly onDisconnect?: () => void;
}

type CopyState = "idle" | "copied" | "failed";

export function WalletCard({ publicKey, frozen, balanceXlm, explorerUrl, onDisconnect }: WalletCardProps) {
  const headingId = useId();
  const frozenReasonId = useId();
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const shortKey = shortPublicKey(publicKey);
  const balance = balanceXlm === null ? "—" : `${balanceXlm} XLM`;

  function copyAccount(): void {
    const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (!clipboard?.writeText) {
      setCopyState("failed");
      return;
    }
    clipboard
      .writeText(publicKey)
      .then(() => setCopyState("copied"))
      .catch(() => setCopyState("failed"));
  }

  return (
    <section
      aria-labelledby={headingId}
      className="relative flex flex-col gap-6 overflow-hidden rounded-panel bg-brand-accent p-7 text-white"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IoWalletOutline aria-hidden="true" focusable="false" className="text-[22px]" />
          <h2 id={headingId} className="m-0 text-[17px] font-[650]">
            Freighter conectada de forma no custodial
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {frozen ? (
            <span className="inline-flex h-[26px] items-center rounded-pill border border-white bg-white/15 px-2.5 text-xs font-[650] tracking-[0.04em]">
              CONGELADA
            </span>
          ) : null}
          <span className="inline-flex h-[26px] items-center gap-1 rounded-pill border border-white/70 px-2.5 text-xs font-[650] tracking-[0.04em]">
            <IoGitNetworkOutline aria-hidden="true" focusable="false" className="text-[14px]" />
            STELLAR TESTNET
          </span>
        </div>
      </div>

      <div>
        <div className="text-[13px] font-medium">Saldo disponible</div>
        <div aria-live="polite" className="mt-0.5 text-[clamp(32px,4vw,44px)] leading-[1.1] font-bold tracking-[-0.03em]">
          {balance}
        </div>
        <div className="mt-1 text-[13px]">Activo de prueba sin valor económico</div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-control bg-white/15 py-1.5 pr-1.5 pl-3">
          <span title={publicKey} className="font-mono text-[13px]">
            <span aria-hidden="true">{shortKey}</span>
            <span className="sr-only">{publicKey}</span>
          </span>
          <button
            type="button"
            onClick={copyAccount}
            aria-label="Copiar cuenta completa"
            className="inline-flex h-8 items-center gap-1 rounded-control bg-white px-2.5 text-xs font-[650] text-[#111111] hover:bg-brand-accent-tint"
          >
            {copyState === "copied" ? (
              <IoCheckmarkOutline aria-hidden="true" focusable="false" className="text-[14px]" />
            ) : (
              <IoCopyOutline aria-hidden="true" focusable="false" className="text-[14px]" />
            )}
            {copyState === "copied" ? "Copiada" : "Copiar"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Ver cuenta en el explorador de Stellar Testnet (abre en una pestaña nueva)"
            className="inline-flex h-10 items-center gap-1.5 rounded-control bg-white px-3.5 text-sm font-semibold text-[#111111] hover:bg-brand-accent-tint"
          >
            Explorador
            <IoOpenOutline aria-hidden="true" focusable="false" className="text-[15px]" />
          </a>
          <button
            type="button"
            onClick={frozen ? undefined : onDisconnect}
            disabled={frozen}
            aria-describedby={frozen ? frozenReasonId : undefined}
            className={`inline-flex h-10 items-center rounded-control border border-white bg-transparent px-3.5 text-sm font-semibold text-white hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
          >
            Desconectar
          </button>
        </div>
      </div>

      {copyState === "failed" ? (
        <p role="alert" className="m-0 flex items-center gap-2 text-sm font-semibold">
          <IoAlertCircleOutline aria-hidden="true" focusable="false" className="text-[18px]" />
          No pudimos copiar la cuenta. Copiala manualmente.
        </p>
      ) : null}

      {frozen ? (
        <p id={frozenReasonId} className="m-0 text-[13px] leading-[1.5]">
          La bóveda ya se abrió: esta cuenta es el destino inmutable de los fondos y no se puede cambiar.
        </p>
      ) : null}
    </section>
  );
}
