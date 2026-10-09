"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  contributionAmountMessage,
  contributionPreSignError,
  MIN_CONTRIBUTION_XLM,
  validateContributionAmount
} from "@/application/campaign/campaign-contribution";
import type { CampaignVaultError } from "@/application/campaign/campaign-vault-errors";
import type { PrincipalRole } from "@/application/ports/auth-session-port";
import type { CampaignDetail } from "@/application/ports/campaign-detail-port";
import type { CampaignGateway } from "@/application/ports/campaign-gateway";
import type { InvestorKycPort } from "@/application/ports/investor-kyc-port";
import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import type { WalletPort } from "@/application/ports/wallet-port";
import { microcopy } from "@/application/trust/disclosures";
import { createCampaignGateway } from "@/infrastructure/campaign/default-gateway";
import { createBrowserInvestorKycPort } from "@/infrastructure/kyc/create-investor-kyc-port";
import { createBrowserWalletConnectionPort } from "@/infrastructure/wallet/create-wallet-connection-port";
import { FreighterWallet } from "@/infrastructure/wallet/freighter-wallet";
import { useCampaignVault } from "@/state/use-campaign-vault";
import { useInvestorKyc } from "@/state/use-investor-kyc";
import { useWalletConnected } from "@/state/use-wallet-connected";
import { Button } from "../button";
import { TextField } from "../text-field";
import { InvestorKycInterstitial } from "./investor-kyc-interstitial";
import {
  TransactionReviewModal,
  type TransactionReviewNetworkState,
  type TransactionReviewSigningState
} from "../transaction-review-modal";

/** Module scope keeps the default ports stable across renders (mirrors `campaign-workspace`). */
const defaultWallet = new FreighterWallet();
const defaultGateway = createCampaignGateway(process.env["NEXT_PUBLIC_API_BASE_URL"]);

const PORTFOLIO_HREF = "/portfolio";

/** The template's helper text under the amount field (`Vaqcrow Detalle PyME.dc.html:196`). */
const MIN_AMOUNT_HELPER = `Activo de prueba sin valor económico · mínimo ${MIN_CONTRIBUTION_XLM} XLM`;

/**
 * Maps a contribute failure to the review modal's signing state, the same
 * mapping `campaign-workspace.tsx` uses (D5): `wallet_rejected` is the only
 * failure the modal calls a signature rejection; a wrong network blocks
 * signing through the network state; every other failure is the closest
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

/** Injectable ports/navigation for the contribution flow (all optional in production). */
export interface CampaignContributionInjection {
  readonly gateway?: CampaignGateway | null;
  readonly wallet?: WalletPort;
  readonly connection?: WalletConnectionPort | null;
  readonly kyc?: InvestorKycPort | null;
  readonly onConnectWallet?: () => void;
}

export interface CampaignContributionProps extends CampaignContributionInjection {
  readonly campaignId: string;
  readonly campaignName: string;
  readonly vaultAddress: string | null;
  readonly status: CampaignDetail["status"];
  /** The signed-in viewer's verified role; only `INVERSOR` contributes. */
  readonly viewerRole: PrincipalRole | null;
  /** Refreshes the detail once the chain observed the contribution. */
  readonly onContributionSubmitted?: () => void;
}

/**
 * The contribution flow on the campaign detail (Feature #422, WU3). It reuses
 * the existing vault-invocation engine (`useCampaignVault`) and the shared
 * `TransactionReviewModal`; it does not fork either. The gate is the same one
 * the template draws: only a `funding` campaign, only for an investor (a PYME
 * never contributes to its own campaign — the detail does not expose the owner
 * id, so the verified role is the gate), and only when a vault id is known.
 *
 * The persisted wallet connection decides the redirect: without one the CTA
 * sends the person to `/portfolio` to connect or create Freighter; with one it
 * opens the review. The amount input lives here, beside the CTA, and is passed
 * to the modal as a prop — the shared modal renders values, it collects none.
 */
export function CampaignContribution({
  campaignId,
  campaignName,
  vaultAddress,
  status,
  viewerRole,
  gateway,
  wallet,
  connection,
  kyc,
  onConnectWallet,
  onContributionSubmitted
}: CampaignContributionProps) {
  const router = useRouter();
  const canContribute =
    status === "funding" && viewerRole === "INVERSOR" && Boolean(vaultAddress && vaultAddress.trim() !== "");

  const [resolvedGateway] = useState<CampaignGateway | null>(() => gateway ?? defaultGateway);
  const [resolvedWallet] = useState<WalletPort>(() => wallet ?? defaultWallet);
  const [resolvedConnection] = useState<WalletConnectionPort | null>(
    () => connection ?? createBrowserWalletConnectionPort()
  );
  const [resolvedKycPort] = useState<InvestorKycPort>(() => kyc ?? createBrowserInvestorKycPort());
  const walletState = useWalletConnected(resolvedConnection);
  // The simulated KYC is fetched only for a would-be contributor: a PYME never
  // contributes to its own campaign, so it never calls this route.
  const kycState = useInvestorKyc(resolvedKycPort, canContribute);

  const [sent, setSent] = useState(false);
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | undefined>();
  // The one-shot simulated-KYC interstitial (WU4), shown before the review modal.
  const [kycOpen, setKycOpen] = useState(false);
  const [kycApproving, setKycApproving] = useState(false);
  const [kycFailed, setKycFailed] = useState(false);
  const [review, setReview] = useState<{
    readonly amount: string;
    readonly stroops: string;
    readonly errorBaseline: CampaignVaultError | undefined;
    readonly attempted: boolean;
  } | null>(null);

  // The engine's own `contribute` only knows a public key after `connect`; the
  // swap wrapper records the exact moment Freighter produced a signature, which
  // is what the template calls "Enviada" — distinct from "confirmada", which is
  // the engine's ledger poll.
  const engineWallet = useMemo<WalletPort>(
    () => ({
      isAvailable: () => resolvedWallet.isAvailable(),
      connect: () => resolvedWallet.connect(),
      signMessage: (message) => resolvedWallet.signMessage(message),
      signTransaction: async (xdr, passphrase) => {
        const signed = await resolvedWallet.signTransaction(xdr, passphrase);
        setSent(true);
        return signed;
      }
    }),
    [resolvedWallet]
  );

  const { publicKey, connect, campaign, contribute, isSubmitting, pendingOperation, error } = useCampaignVault(
    resolvedGateway,
    engineWallet,
    campaignId
  );

  const isReviewSigning = isSubmitting && pendingOperation === "contribute";
  // One error owner at a time, mirroring the workspace: while the review shows
  // its own error, no duplicate banner is rendered elsewhere.
  const reviewError = review && review.errorBaseline !== error ? error : undefined;

  // Close on success: a signing attempt that finished with no error of its own
  // leaves the updated view on screen. A failure keeps the review open to retry.
  if (review?.attempted && !isReviewSigning && !reviewError) setReview(null);

  if (!canContribute) return null;

  const openPortfolio = onConnectWallet ?? (() => router.push(PORTFOLIO_HREF));

  // The final step shared by an already-approved investor and the one-shot KYC
  // confirm: validate the amount, ensure a signing account, then open the review.
  const openReview = async () => {
    const parsed = validateContributionAmount(amount);
    if (!parsed.ok) {
      setAmountError(contributionAmountMessage(parsed.error));
      return;
    }

    setAmountError(undefined);
    // Establish the signing account before opening the review, so "Firmar en
    // Freighter" runs against a connected wallet (a fresh page has none).
    if (!publicKey) await connect();
    setReview({ amount, stroops: parsed.stroops, errorBaseline: error, attempted: false });
  };

  const handleOpenReview = async () => {
    const reason = contributionPreSignError({
      amountInput: amount,
      vaultAddress,
      network: campaign?.network ?? null
    });
    if (reason) {
      setAmountError(reason);
      return;
    }

    if (walletState.status !== "connected") {
      setAmountError(undefined);
      openPortfolio();
      return;
    }

    // The simulated KYC interstitial appears once, before the review modal
    // (owner decision D2); an already-approved investor skips it.
    if (kycState.approved) {
      await openReview();
      return;
    }

    setKycFailed(false);
    setKycOpen(true);
  };

  const handleKycConfirm = async () => {
    setKycApproving(true);
    const approved = await kycState.approve();
    setKycApproving(false);
    if (!approved) {
      // Keep the interstitial open with an honest retry, never opening the
      // review on an unconfirmed approval.
      setKycFailed(true);
      return;
    }
    setKycOpen(false);
    await openReview();
  };

  const handleSign = () => {
    if (!review) return;
    setReview({ ...review, attempted: true });
    void contribute(review.stroops).then(() => onContributionSubmitted?.());
  };

  const networkProps: TransactionReviewNetworkState =
    reviewError?.kind === "wallet_network_mismatch"
      ? { isWrongNetwork: true, wrongNetworkMessage: microcopy.wrongNetwork }
      : {};
  const signingProps = reviewSigningState(isReviewSigning, reviewError);

  return (
    <div className="flex flex-col gap-3">
      <TextField
        label="Monto del aporte (XLM)"
        inputMode="decimal"
        value={amount}
        helperText={MIN_AMOUNT_HELPER}
        {...(amountError ? { error: amountError } : {})}
        onChange={(value) => {
          setAmount(value);
          setAmountError(undefined);
        }}
      />

      <Button
        type="button"
        fullWidth
        isDisabled={isSubmitting || walletState.status === "loading" || kycState.isLoading}
        onPress={handleOpenReview}
      >
        {sent ? "Aportar de nuevo" : "Aportar a la campaña"}
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
        title={`Aportar a ${campaignName}`}
        amount={review?.amount ?? ""}
        assetCode="XLM"
        descriptionRows={[
          { label: "Contrato", value: vaultAddress ?? "", mono: true },
          { label: "Función", value: "contribute" },
          { label: "Custodia", value: "El contrato de la bóveda, no una persona" },
          { label: "Aporte mínimo", value: `${MIN_CONTRIBUTION_XLM} XLM de prueba` }
        ]}
        {...networkProps}
        {...signingProps}
      />

      <InvestorKycInterstitial
        isOpen={kycOpen}
        isApproving={kycApproving}
        failed={kycFailed}
        onConfirm={handleKycConfirm}
        onClose={() => {
          setKycOpen(false);
          setKycFailed(false);
        }}
      />
    </div>
  );
}
