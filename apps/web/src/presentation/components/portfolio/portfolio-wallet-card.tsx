"use client";

import { useId, useState } from "react";
import { IoAlertCircleOutline, IoOpenOutline, IoWalletOutline } from "react-icons/io5";
// The funded/unfunded decision and the `?addr=` Friendbot rule are the same ones
// `/company` already uses (issue #531); reused rather than re-implemented, so the
// two surfaces cannot drift (issue #544). Only the wording is the portfolio's own.
import { friendbotUrl, fundingState } from "@/application/company/funding";
import {
  PORTFOLIO_WALLET_COPY,
  TESTNET_LABORATORY_URL,
  walletConnectErrorMessage
} from "@/application/portfolio/wallet-states";
import { connectAndStoreWallet, walletAccountExplorerUrl } from "@/application/pyme-onboarding/wallet-connection";
import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import type { WalletPort } from "@/application/ports/wallet-port";
import { Button } from "../button";
import { WalletCard } from "../wallet-card";

/**
 * The investor portfolio's wallet surface (Feature #426, WU4; reworked by issue
 * #544).
 *
 * When a key is persisted it renders the existing connected `WalletCard` plus
 * the Testnet-funds help; when there is none it renders a connect-mode card:
 * `Conectar Freighter` runs the same `connectAndStoreWallet` sequence the PyME
 * onboarding uses (connect → challenge → sign → store) and reports a
 * not-installed, rejected, wrong-network or persistence failure through the
 * reused PyME copy, never a provider message.
 *
 * The funds guide is gated on an address: Friendbot answers 400 without `addr`,
 * so the disconnected state never links it, and the connected state offers a
 * prefilled Friendbot link only while the account still needs XLM (the same
 * rule `/company` uses). The honest framing stays: Testnet only, no economic
 * value, Vaqcrow never custodies funds.
 *
 * Presentational + orchestration only: the container loads the connection and
 * the balance, and refreshes them through `onConnected`.
 */

export interface PortfolioWallet {
  readonly publicKey: string;
  readonly frozen: boolean;
  readonly balanceXlm: string | null;
}

export interface PortfolioWalletCardProps {
  /** The persisted connection, or `null` to render the connect-mode card. */
  readonly wallet: PortfolioWallet | null;
  /** Freighter signer; injectable so tests never touch the extension. */
  readonly walletPort: WalletPort;
  /** Challenge/store capability; injectable for tests. */
  readonly connectionPort: WalletConnectionPort;
  /** Called after a successful connect so the container re-reads and refreshes. */
  readonly onConnected: () => void;
  /** Local disconnect of the connected card; never called while frozen. */
  readonly onDisconnect: () => void;
}

interface FundsGuideProps {
  /** The connected account's public key, or `null`/absent while disconnected. */
  readonly publicKey?: string | null;
  /** The connected account's raw XLM balance, or `null` while it is unknown. */
  readonly balanceXlm?: string | null;
}

/**
 * The Testnet-funds help. Without an address (disconnected) it explains Testnet
 * honestly and offers only the address-free Stellar Laboratory; a connected
 * account either gets the funded note or the unfunded warning plus a Friendbot
 * link prefilled with its public key.
 */
function FundsGuide({ publicKey = null, balanceXlm = null }: FundsGuideProps) {
  const state = fundingState(publicKey, balanceXlm);
  const canFundWithFriendbot = state === "unfunded" && publicKey !== null && publicKey !== "";

  return (
    <div className="flex flex-col gap-3 rounded-card bg-page-surface p-4">
      <div>
        <p className="m-0 text-[15px] font-semibold text-text-primary">{PORTFOLIO_WALLET_COPY.fundsTitle}</p>
        <p className="m-0 mt-1 text-sm leading-[1.5] text-text-secondary">{PORTFOLIO_WALLET_COPY.fundsBody}</p>
      </div>

      {state === "funded" ? (
        <p className="m-0 text-sm leading-[1.5] text-text-secondary">{PORTFOLIO_WALLET_COPY.fundsFundedNote}</p>
      ) : null}

      {state === "unfunded" ? (
        <p className="m-0 flex items-center gap-2 text-sm font-semibold text-trust-caution">
          <IoAlertCircleOutline aria-hidden="true" focusable="false" className="shrink-0 text-[18px]" />
          {PORTFOLIO_WALLET_COPY.fundsUnfundedWarning}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canFundWithFriendbot ? (
          <a
            href={friendbotUrl(publicKey)}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex h-10 items-center gap-1.5 rounded-control border border-control px-3.5 text-sm font-semibold text-text-primary hover:bg-canvas"
          >
            {PORTFOLIO_WALLET_COPY.friendbotLabel}
            <IoOpenOutline aria-hidden="true" focusable="false" className="text-[15px]" />
          </a>
        ) : null}
        <a
          href={TESTNET_LABORATORY_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex h-10 items-center gap-1.5 rounded-control border border-control px-3.5 text-sm font-semibold text-text-primary hover:bg-canvas"
        >
          {PORTFOLIO_WALLET_COPY.laboratoryLabel}
          <IoOpenOutline aria-hidden="true" focusable="false" className="text-[15px]" />
        </a>
      </div>

      {state === "unfunded" ? (
        <p className="m-0 text-sm leading-[1.5] text-text-secondary">{PORTFOLIO_WALLET_COPY.fundsFriendbotHelp}</p>
      ) : null}
    </div>
  );
}

export function PortfolioWalletCard({
  wallet,
  walletPort,
  connectionPort,
  onConnected,
  onDisconnect
}: PortfolioWalletCardProps) {
  const headingId = useId();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (wallet) {
    return (
      <div className="flex flex-col gap-4">
        <WalletCard
          publicKey={wallet.publicKey}
          frozen={wallet.frozen}
          balanceXlm={wallet.balanceXlm}
          explorerUrl={walletAccountExplorerUrl(wallet.publicKey)}
          onDisconnect={onDisconnect}
        />
        <FundsGuide publicKey={wallet.publicKey} balanceXlm={wallet.balanceXlm} />
      </div>
    );
  }

  async function connect(): Promise<void> {
    if (connecting) return;
    setConnecting(true);
    setError(null);
    const outcome = await connectAndStoreWallet(walletPort, connectionPort);
    if (outcome.ok) {
      onConnected();
    } else {
      setError(walletConnectErrorMessage(outcome));
    }
    setConnecting(false);
  }

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-6 rounded-panel border border-page-border bg-canvas p-7"
    >
      <div className="flex items-start gap-3">
        <IoWalletOutline aria-hidden="true" focusable="false" className="mt-0.5 shrink-0 text-[24px] text-brand-accent" />
        <div>
          <h2 id={headingId} className="m-0 text-[17px] font-[650] text-text-primary">
            {PORTFOLIO_WALLET_COPY.connectTitle}
          </h2>
          <p className="m-0 mt-1 text-sm leading-[1.55] text-text-secondary">{PORTFOLIO_WALLET_COPY.connectBody}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          isLoading={connecting}
          loadingLabel={PORTFOLIO_WALLET_COPY.connecting}
          onPress={() => void connect()}
        >
          {PORTFOLIO_WALLET_COPY.connectCta}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="m-0 flex items-center gap-2 text-sm font-semibold text-trust-critical">
          <IoAlertCircleOutline aria-hidden="true" focusable="false" className="shrink-0 text-[18px]" />
          {error}
        </p>
      ) : null}

      <FundsGuide />
    </section>
  );
}
