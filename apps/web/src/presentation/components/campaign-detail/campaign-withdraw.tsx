"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { CampaignVaultError } from "@/application/campaign/campaign-vault-errors";
import { canWithdraw } from "@/application/campaign/campaign-withdraw";
import { formatStroopsAsXlm } from "@/application/format/stroops";
import type { PrincipalRole } from "@/application/ports/auth-session-port";
import type { CampaignDetail } from "@/application/ports/campaign-detail-port";
import type { CampaignGateway } from "@/application/ports/campaign-gateway";
import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import type { WalletPort } from "@/application/ports/wallet-port";
import { microcopy } from "@/application/trust/disclosures";
import { createCampaignGateway } from "@/infrastructure/campaign/default-gateway";
import { createBrowserWalletConnectionPort } from "@/infrastructure/wallet/create-wallet-connection-port";
import { FreighterWallet } from "@/infrastructure/wallet/freighter-wallet";
import { useCampaignVault } from "@/state/use-campaign-vault";
import { useWalletConnected } from "@/state/use-wallet-connected";
import { Button } from "../button";
import {
  TransactionReviewModal,
  type TransactionReviewNetworkState,
  type TransactionReviewSigningState
} from "../transaction-review-modal";

/** Module scope keeps the default ports stable across renders (mirrors `campaign-contribution`). */
const defaultWallet = new FreighterWallet();
const defaultGateway = createCampaignGateway(process.env["NEXT_PUBLIC_API_BASE_URL"]);

const PORTFOLIO_HREF = "/portfolio";

/**
 * Maps a withdraw failure to the review modal's signing state, the same mapping
 * `campaign-workspace.tsx` and `campaign-contribution.tsx` use: `wallet_rejected`
 * is the only failure the modal calls a signature rejection; a wrong network
 * blocks signing through the network state; every other failure is the closest
 * existing prop, `verification-rejected`. No new modal state is invented.
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

/** Injectable ports/navigation for the withdraw flow (all optional in production). */
export interface CampaignWithdrawInjection {
  readonly gateway?: CampaignGateway | null;
  readonly wallet?: WalletPort;
  readonly connection?: WalletConnectionPort | null;
  readonly onConnectWallet?: () => void;
}

export interface CampaignWithdrawProps extends CampaignWithdrawInjection {
  readonly campaignId: string;
  readonly campaignName: string;
  readonly vaultAddress: string | null;
  readonly status: CampaignDetail["status"];
  /** The signed-in viewer's verified role; only `INVERSOR` withdraws. */
  readonly viewerRole: PrincipalRole | null;
  /** Refreshes the detail once the chain observed the withdrawal. */
  readonly onWithdrawalSubmitted?: () => void;
}

/**
 * The "Retirar" action on the campaign detail (Feature #422, WU5). It reuses the
 * existing vault-invocation engine (`useCampaignVault`'s `withdraw`) and the
 * shared `TransactionReviewModal`; it does not fork either. Owner decision D4:
 * the action is gated on the campaign still being in `funding` **and** the
 * investor having a non-zero contribution — the demo has an on-chain vault but
 * the discovery of that contribution is an API read, so the action stays hidden
 * until it is known.
 *
 * The investor's own contribution comes from the same chain-observed campaign
 * read the engine already exposes (`investorContributionStroops`), fetched with
 * the **persisted** connection's public key — no Freighter prompt is opened to
 * discover it. The persisted connection is also the "is a wallet connected?"
 * signal: without one, pressing the action follows the contribution flow's own
 * behaviour and sends the person to `/portfolio`. Confirmation is never claimed
 * locally; the ledger poll is the only authority ("sent ≠ confirmed").
 */
export function CampaignWithdraw({
  campaignId,
  campaignName,
  vaultAddress,
  status,
  viewerRole,
  gateway,
  wallet,
  connection,
  onConnectWallet,
  onWithdrawalSubmitted
}: CampaignWithdrawProps) {
  const router = useRouter();

  const [resolvedGateway] = useState<CampaignGateway | null>(() => gateway ?? defaultGateway);
  const [resolvedWallet] = useState<WalletPort>(() => wallet ?? defaultWallet);
  const [resolvedConnection] = useState<WalletConnectionPort | null>(
    () => connection ?? createBrowserWalletConnectionPort()
  );
  const walletState = useWalletConnected(resolvedConnection);

  const [sent, setSent] = useState(false);
  const [review, setReview] = useState<{
    readonly errorBaseline: CampaignVaultError | undefined;
    readonly attempted: boolean;
  } | null>(null);

  // The engine's own `connect` is how its campaign read learns the investor's
  // address; here it resolves the **persisted** public key without prompting
  // (the contribution flow's own default navigation handles the no-wallet case).
  // Freighter is only touched at `signTransaction`, which records the exact
  // moment a signature was produced — the template's "Enviada".
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

  const { publicKey, connect, campaign, withdraw, isSubmitting, pendingOperation, error } = useCampaignVault(
    resolvedGateway,
    engineWallet,
    campaignId
  );

  // Load the investor-specific snapshot as soon as the persisted connection is
  // known, so the gate can see the contribution. Nothing is prompted: the key
  // already exists server-side.
  useEffect(() => {
    if (!walletState.publicKey || publicKey) return;
    void connect();
  }, [walletState.publicKey, publicKey, connect]);

  const contribution = campaign?.investorContributionStroops ?? null;
  const allowed = canWithdraw({
    status,
    viewerRole,
    vaultAddress,
    investorContributionStroops: contribution
  });

  const isReviewSigning = isSubmitting && pendingOperation === "withdraw";
  // One error owner at a time, mirroring the contribution flow.
  const reviewError = review && review.errorBaseline !== error ? error : undefined;

  // Close on success: a signing attempt that finished with no error of its own
  // leaves the updated view on screen. A failure keeps the review open to retry.
  if (review?.attempted && !isReviewSigning && !reviewError) setReview(null);

  if (!allowed) return null;

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
    void withdraw().then(() => onWithdrawalSubmitted?.());
  };

  const networkProps: TransactionReviewNetworkState =
    reviewError?.kind === "wallet_network_mismatch"
      ? { isWrongNetwork: true, wrongNetworkMessage: microcopy.wrongNetwork }
      : {};
  const signingProps = reviewSigningState(isReviewSigning, reviewError);
  const amountLabel = contribution === null ? "" : formatStroopsAsXlm(contribution);

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="secondary"
        fullWidth
        isDisabled={isSubmitting || walletState.status === "loading"}
        onPress={handleOpenReview}
      >
        {isSubmitting && pendingOperation === "withdraw"
          ? "Retirando…"
          : sent
            ? "Retirar de nuevo"
            : "Retirar mi aporte"}
      </Button>

      {sent ? (
        <div
          role="status"
          className="flex gap-2.5 rounded-control bg-trust-caution-surface p-3 text-[13px] leading-[1.45] text-trust-caution"
        >
          <span>
            <strong className="font-semibold">Enviada · pendiente de confirmación.</strong>{" "}
            {microcopy.submittedNotConfirmed}
          </span>
        </div>
      ) : null}

      <TransactionReviewModal
        isOpen={review !== null}
        onClose={() => setReview(null)}
        onSign={handleSign}
        title={`Retirar tu aporte de ${campaignName}`}
        amount={amountLabel}
        assetCode="XLM"
        descriptionRows={[
          { label: "Contrato", value: vaultAddress ?? "", mono: true },
          { label: "Función", value: "withdraw" },
          { label: "Custodia", value: "El contrato de la bóveda, no una persona" }
        ]}
        {...networkProps}
        {...signingProps}
      />
    </div>
  );
}
