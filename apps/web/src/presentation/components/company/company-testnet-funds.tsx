"use client";

import { IoAlertCircleOutline, IoGitNetworkOutline, IoOpenOutline, IoWalletOutline } from "react-icons/io5";
import { friendbotUrl, fundingState, TESTNET_FUNDS_COPY } from "@/application/company/funding";
import { Button, buttonClasses } from "../button";

/**
 * Testnet funds guide of `/company` (Feature #434, WU5; reworked by issue #531).
 *
 * The owner found that the old bare «Fondear con Friendbot» link landed on
 * Friendbot's own 400 page whenever the account already had the starting
 * balance, and never reflected whether the wallet was connected or funded. The
 * guide now has one primary action — connect Freighter — and, once connected,
 * points at the wallet card above for the balance and says whether the account
 * can pay for the vault deploy.
 * Friendbot stays as explanatory, secondary help, offered only while the account
 * still needs funds and prefilled with the public key it requires.
 *
 * Presentational only: the container (`CompanyWorkspace`) owns the connection,
 * the balance and the connect sequence and passes them down. Vaqcrow is
 * non-custodial and never moves funds; only Testnet XLM (no economic value) is
 * involved. The template does not design this guide, so the copy is neutral,
 * honest Spanish (owner-pending) and lives in `application/company/funding.ts`.
 */
export interface CompanyTestnetFundsProps {
  /** The connected wallet's public key, or `null` when none is linked yet. */
  readonly publicKey?: string | null;
  /** The connected wallet's raw XLM balance; `null` while it is unknown. */
  readonly balanceXlm?: string | null;
  /** Connects Freighter; only rendered while no wallet is connected. */
  readonly onConnect?: () => void;
  /** `true` while the connect sequence runs: the primary action is busy. */
  readonly connecting?: boolean;
  /** Sanitized connect-failure message, or `null`. */
  readonly error?: string | null;
}

export function CompanyTestnetFunds({
  publicKey = null,
  balanceXlm = null,
  onConnect,
  connecting = false,
  error = null
}: CompanyTestnetFundsProps) {
  const state = fundingState(publicKey, balanceXlm);

  return (
    <section
      aria-label="Guía para fondear tu wallet de Testnet"
      className="flex flex-col gap-3 rounded-panel border border-page-border bg-raised p-5"
    >
      <header className="flex flex-wrap items-center gap-2">
        <IoGitNetworkOutline aria-hidden="true" focusable="false" className="text-[20px] text-text-secondary" />
        <h2 className="m-0 text-[17px] font-[650]">{TESTNET_FUNDS_COPY.title}</h2>
        <span className="inline-flex h-[22px] items-center rounded-pill border border-page-border px-2.5 text-xs font-[650] tracking-[0.04em] text-text-secondary">
          {TESTNET_FUNDS_COPY.badge}
        </span>
      </header>

      <p className="m-0 text-sm leading-normal text-text-secondary">{TESTNET_FUNDS_COPY.body}</p>

      {state === "disconnected" ? (
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            isLoading={connecting}
            loadingLabel={TESTNET_FUNDS_COPY.connecting}
            {...(onConnect ? { onPress: onConnect } : {})}
          >
            <IoWalletOutline aria-hidden="true" focusable="false" className="text-[18px]" />
            {TESTNET_FUNDS_COPY.connect}
          </Button>
          <p className="m-0 text-[13px] leading-[1.5] text-text-secondary">{TESTNET_FUNDS_COPY.disconnectedHint}</p>
        </div>
      ) : (
        <div aria-live="polite" className="flex flex-col gap-2">
          <p className="m-0 text-[13px] leading-[1.5] text-text-secondary">{TESTNET_FUNDS_COPY.balancePointer}</p>
          {state === "funded" ? (
            <p className="m-0 text-[13px] leading-[1.5] text-text-secondary">{TESTNET_FUNDS_COPY.fundedNote}</p>
          ) : (
            <p className="m-0 flex items-center gap-2 text-[13px] leading-[1.5] font-semibold text-trust-caution">
              <IoAlertCircleOutline aria-hidden="true" focusable="false" className="shrink-0 text-[16px]" />
              {TESTNET_FUNDS_COPY.unfundedWarning}
            </p>
          )}
        </div>
      )}

      {error ? (
        <p role="alert" className="m-0 flex items-center gap-2 text-sm font-semibold text-trust-critical">
          <IoAlertCircleOutline aria-hidden="true" focusable="false" className="shrink-0 text-[18px]" />
          {error}
        </p>
      ) : null}

      {state === "unfunded" ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-[13px] leading-[1.5] text-text-secondary">{TESTNET_FUNDS_COPY.friendbotHelp}</p>
          <a
            href={friendbotUrl(publicKey)}
            target="_blank"
            rel="noreferrer noopener"
            className={`inline-flex w-fit items-center gap-1.5 ${buttonClasses("secondary")}`}
          >
            {TESTNET_FUNDS_COPY.friendbotLink}
            <IoOpenOutline aria-hidden="true" focusable="false" className="text-[15px]" />
          </a>
        </div>
      ) : null}

      <p className="m-0 text-[13px] leading-[1.5] text-text-secondary">{TESTNET_FUNDS_COPY.noValue}</p>
    </section>
  );
}
