"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CampaignVaultError } from "@/application/campaign/campaign-vault-errors";
import {
  POSITION_ACTION_COPY,
  positionActionFor,
  type PositionActionOutcome,
  type PositionOperation
} from "@/application/portfolio/actions";
import type { CampaignGateway } from "@/application/ports/campaign-gateway";
import type { PortfolioPosition } from "@/application/ports/portfolio-port";
import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import type { WalletPort } from "@/application/ports/wallet-port";
import { microcopy } from "@/application/trust/disclosures";
import { createCampaignGateway } from "@/infrastructure/campaign/default-gateway";
import { createBrowserWalletConnectionPort } from "@/infrastructure/wallet/create-wallet-connection-port";
import { FreighterWallet } from "@/infrastructure/wallet/freighter-wallet";
import { useCampaignVault, type UseCampaignVaultOptions } from "@/state/use-campaign-vault";
import { useWalletConnected } from "@/state/use-wallet-connected";
import { Button } from "../button";
import { TransactionStatusList, type TransactionStatusItem } from "../transaction-status-list";
import {
  TransactionReviewModal,
  type TransactionReviewDescriptionRow,
  type TransactionReviewNetworkState,
  type TransactionReviewSigningState
} from "../transaction-review-modal";

/** Module scope keeps the default ports stable across renders (mirrors `campaign-withdraw`). */
const defaultWallet = new FreighterWallet();
const defaultGateway = createCampaignGateway(process.env["NEXT_PUBLIC_API_BASE_URL"]);

const PORTFOLIO_HREF = "/portfolio";

/**
 * Maps a vault failure to the review modal's signing state, the same mapping
 * `campaign-withdraw.tsx` uses: `wallet_rejected` is the only failure the modal
 * calls a signature rejection; a wrong network blocks signing through the
 * network state; every other failure is the closest existing prop,
 * `verification-rejected`. No new modal state is invented.
 */
function reviewSigningState(
  isSigning: boolean,
  reviewError: CampaignVaultError | undefined
): TransactionReviewSigningState {
  if (isSigning) return { signingStatus: "signing" };
  if (!reviewError) return { signingStatus: "idle" };
  if (reviewError.kind === "wallet_network_mismatch") return { signingStatus: "idle" };
  if (reviewError.kind === "wallet_rejected") {
    return { signingStatus: "signature-rejected", signingErrorMessage: reviewError.message };
  }
  return { signingStatus: "verification-rejected", signingErrorMessage: reviewError.message };
}

/**
 * The only post-signature engine errors that are a **definite** failure. The
 * engine answers `refused` when the submitted transaction settled `failed` and
 * `not_funding` when the vault left the funding state; every other error it can
 * report after a signature (`unavailable` from the bounded poll exhausting,
 * `network`, `unknown`) is **inconclusive** and must never render as "Fallida".
 */
function isDefiniteVaultFailure(error: CampaignVaultError | undefined): boolean {
  return error?.kind === "refused" || error?.kind === "not_funding";
}

/** Injectable ports/navigation for the portfolio action (all optional in production). */
export interface PortfolioPositionActionInjection {
  readonly gateway?: CampaignGateway | null;
  readonly wallet?: WalletPort;
  readonly connection?: WalletConnectionPort | null;
  readonly onConnectWallet?: () => void;
  /**
   * Bounded-poll timing forwarded to the vault engine. A test seam: production
   * omits it and the engine's own defaults (1.5s between polls, 10 attempts)
   * apply.
   */
  readonly vaultOptions?: UseCampaignVaultOptions;
}

export interface PortfolioPositionActionProps extends PortfolioPositionActionInjection {
  readonly position: PortfolioPosition;
  /** Refreshes the portfolio once an attempt settled (mirrors `campaign-withdraw`'s callback). */
  readonly onActionSubmitted?: () => void;
}

/**
 * The withdraw/refund action on an investor portfolio position card (Feature
 * #426, WU3). One component parameterized by the position's own `status`
 * (`positionActionFor`), reusing the shipped vault-invocation engine
 * (`useCampaignVault`'s `withdraw`/`refund`), the shared `TransactionReviewModal`
 * and the `TransactionStatusList`. It never forks `campaign-withdraw.tsx`.
 *
 * The engine reads the campaign's chain-observed snapshot with the **persisted**
 * connection's public key; that same connection is the "is a wallet connected?"
 * signal. Without one, pressing the action follows the shipped gate behaviour
 * and sends the person to `/portfolio` (no new empty state — that is WU4).
 *
 * `sent` is recorded at `signTransaction`, the exact moment a signature was
 * produced (the template's "Enviada"). Confirmation is never claimed locally:
 * the card advances to "Confirmada en el ledger" only when the engine's own
 * ledger poll observed it. An inconclusive result — a bounded poll exhaustion
 * (`unavailable`) or a lost connection (`network`/`unknown`) — is **not** a
 * failure: it stays on "Enviada · pendiente de confirmación", exactly as the
 * shipped `campaign-withdraw.tsx` never claims failure or confirmation. Only
 * the engine's definite refusals (`refused`/`not_funding`) mark it "Fallida".
 */
export function PortfolioPositionAction({
  position,
  gateway,
  wallet,
  connection,
  onConnectWallet,
  onActionSubmitted,
  vaultOptions
}: PortfolioPositionActionProps) {
  const router = useRouter();
  const operation = positionActionFor(position.status);

  const [resolvedGateway] = useState<CampaignGateway | null>(() => gateway ?? defaultGateway);
  const [resolvedWallet] = useState<WalletPort>(() => wallet ?? defaultWallet);
  const [resolvedConnection] = useState<WalletConnectionPort | null>(
    () => connection ?? createBrowserWalletConnectionPort()
  );
  const walletState = useWalletConnected(resolvedConnection);

  // `sent` records the signature moment; it is never reset, so the card cannot
  // fall back to pretending nothing was submitted.
  const [sent, setSent] = useState(false);
  const [review, setReview] = useState<{
    readonly errorBaseline: CampaignVaultError | undefined;
    readonly attempted: boolean;
  } | null>(null);

  const engineWallet = useMemo<WalletPort>(
    () => ({
      isAvailable: () => resolvedWallet.isAvailable(),
      connect: async () => {
        if (walletState.publicKey) return { publicKey: walletState.publicKey };
        return resolvedWallet.connect();
      },
      signMessage: (message) => resolvedWallet.signMessage(message),
      signTransaction: async (xdr, passphrase) => {
        const signed = await resolvedWallet.signTransaction(xdr, passphrase);
        setSent(true);
        return signed;
      }
    }),
    [resolvedWallet, walletState.publicKey]
  );

  const { publicKey, connect, withdraw, refund, isSubmitting, pendingOperation, error } = useCampaignVault(
    resolvedGateway,
    engineWallet,
    operation ? position.campaignId : null,
    vaultOptions
  );

  // Resolve the persisted key without prompting, exactly as `campaign-withdraw`.
  useEffect(() => {
    if (!walletState.publicKey || publicKey) return;
    void connect();
  }, [walletState.publicKey, publicKey, connect]);

  const isReviewSigning = isSubmitting && pendingOperation === operation;
  // One error owner at a time, mirroring the contribution flow.
  const reviewError = review && review.errorBaseline !== error ? error : undefined;

  // Close on success: a signing attempt that finished with no error of its own
  // leaves the updated card on screen. A failure keeps the review open to retry.
  if (review?.attempted && !isReviewSigning && !reviewError) setReview(null);

  // Derive the displayed outcome from the engine's own signals. `confirmed`
  // requires a settled, error-free attempt — the engine only reaches that state
  // when its ledger poll observed `success`. After a signature, only a definite
  // engine failure is "failed"; any other error is inconclusive and stays
  // pending ("sent"), so a bounded timeout never reads as "Fallida".
  const outcome: PositionActionOutcome | null = !sent
    ? null
    : isSubmitting
      ? "sent"
      : isDefiniteVaultFailure(error)
        ? "failed"
        : error
          ? "sent"
          : "confirmed";

  if (operation === null) return null;

  const copy = POSITION_ACTION_COPY[operation];
  const openPortfolio = onConnectWallet ?? (() => router.push(PORTFOLIO_HREF));

  const handleOpenReview = () => {
    if (walletState.status !== "connected") {
      openPortfolio();
      return;
    }
    setReview({ errorBaseline: error, attempted: false });
  };

  const handleSign = () => {
    if (!review) return;
    setReview({ ...review, attempted: true });
    const run = operation === "withdraw" ? withdraw : refund;
    void run().then(() => onActionSubmitted?.());
  };

  const networkProps: TransactionReviewNetworkState =
    reviewError?.kind === "wallet_network_mismatch"
      ? { isWrongNetwork: true, wrongNetworkMessage: microcopy.wrongNetwork }
      : {};
  const signingProps = reviewSigningState(isReviewSigning, reviewError);
  // The template's sent card carries no action button: once a signature was
  // produced the card reports the last tx state instead. A definite failure
  // re-offers the action so the person can retry.
  const showButton = outcome !== "sent" && outcome !== "confirmed";

  return (
    <div className="flex flex-col gap-3">
      {showButton ? (
        <Button
          type="button"
          variant="secondary"
          isDisabled={isSubmitting || walletState.status === "loading"}
          onPress={handleOpenReview}
        >
          {isReviewSigning ? copy.pending : copy.button}
        </Button>
      ) : null}

      {outcome ? (
        <TransactionStatusList
          items={positionActionStatusItems(outcome)}
          headingLevel={4}
          subtitle={`${copy.button} · Stellar Testnet`}
        />
      ) : null}

      <TransactionReviewModal
        isOpen={review !== null}
        onClose={() => setReview(null)}
        onSign={handleSign}
        title={copy.reviewTitle(position.name)}
        amount={position.contributionXlm}
        assetCode="XLM"
        descriptionRows={positionActionDescriptionRows(operation, position.vaultAddress)}
        {...networkProps}
        {...signingProps}
      />
    </div>
  );
}

/** The custody row the withdraw review already ships; reused by both operations. */
const CUSTODY_COPY = "El contrato de la bóveda, no una persona";

/**
 * The review's description rows: the vault contract (middle-truncated by the
 * modal), the invoked function and the contract custody. Mirrors
 * `campaign-withdraw.tsx`'s rows exactly, parameterized by operation. Lives in
 * the presentation layer now that it names the modal's own row type.
 */
export function positionActionDescriptionRows(
  operation: PositionOperation,
  vaultAddress: string
): readonly TransactionReviewDescriptionRow[] {
  return [
    { label: "Contrato", value: vaultAddress, mono: true },
    { label: "Función", value: operation },
    { label: "Custodia", value: CUSTODY_COPY }
  ];
}

/**
 * Builds the `TransactionStatusList` items for an outcome: the cumulative
 * signed -> sent -> confirmed/failed walk. A `sent` outcome stops at the pending
 * step (the list itself renders the "Enviada · pendiente de confirmación" label
 * and the shared `submittedNotConfirmed` microcopy), so nothing is ever claimed
 * as confirmed before the ledger says so — and an inconclusive result stays
 * here rather than reaching the "failed" step.
 */
export function positionActionStatusItems(outcome: PositionActionOutcome): TransactionStatusItem[] {
  const signed: TransactionStatusItem = { state: "signed" };
  if (outcome === "signed") return [signed];

  const sent: TransactionStatusItem = { state: "sent" };
  if (outcome === "sent") return [signed, sent];
  if (outcome === "confirmed") return [signed, sent, { state: "confirmed" }];

  return [signed, sent, { state: "failed" }];
}
