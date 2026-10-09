"use client";

import { useEffect, useRef } from "react";
import {
  distributionReviewRows,
  totalRecipientStroops
} from "@/application/company/distribution-signing";
import { formatStroopsAsXlm } from "@/application/format/stroops";
import { failureReasonCopy } from "@/application/funding/failure-reason-copy";
import type { MyCampaign, MyCampaignDistribution } from "@/application/ports/my-campaigns-port";
import type { RevenueShareDistributionGateway } from "@/application/ports/revenue-share-distribution-gateway";
import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import type { WalletPort } from "@/application/ports/wallet-port";
import { microcopy } from "@/application/trust/disclosures";
import { HttpRevenueShareDistributionGateway } from "@/infrastructure/distribution/http-revenue-share-distribution-gateway";
import { AxiosHttpClient } from "@/infrastructure/http/axios-http-client";
import { createBrowserWalletConnectionPort } from "@/infrastructure/wallet/create-wallet-connection-port";
import { FreighterWallet } from "@/infrastructure/wallet/freighter-wallet";
import { useCompanyDistributionSigning } from "@/state/use-company-distribution-signing";
import type { RevenueShareDistributionSnapshot } from "@vaqcrow/contracts";
import { Button } from "../button";
import { TransactionStatusList, type TransactionStatusItem } from "../transaction-status-list";
import {
  TransactionReviewModal,
  type TransactionReviewNetworkState,
  type TransactionReviewSigningState
} from "../transaction-review-modal";

/**
 * The PyME dashboard's «Revisar y firmar» action (Feature #434, WU4): it reuses
 * the shipped distribution engine (`prepare` → review → Freighter → `submit`)
 * for one distribution of the campaign, instead of forking it. The button opens
 * the review; the service derives the recipients and amounts; the person signs
 * in Freighter; the service verifies and submits. The status walks signed →
 * sent → confirmed, and `submitted` never renders as confirmed.
 *
 * All three ports are injectable for tests. In production the dashboard wires
 * the browser defaults; a test supplies deterministic doubles. The application
 * identity is supplied by the caller — the dashboard resolves it for the
 * campaign — because the my-campaigns read model does not carry it.
 */

/** The wallet the demo uses when none is supplied; module scope keeps it stable across renders. */
const defaultWallet = new FreighterWallet();

/** `null` when no backend is configured: the action then refuses to prepare and says so. */
function createDefaultGateway(): RevenueShareDistributionGateway | null {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return null;
  return new HttpRevenueShareDistributionGateway(AxiosHttpClient.create({ baseUrl }));
}

const defaultGateway = createDefaultGateway();

/** The persisted SME account read; module scope keeps the browser port stable across renders. */
const defaultConnection = createBrowserWalletConnectionPort();

/**
 * The signed → sent → terminal walk. `submitted` is the only state the service
 * reports before Horizon answers, so it renders as signed + sent (pending of
 * confirmation) and can never read as confirmed.
 */
function statusItems(snapshot: RevenueShareDistributionSnapshot): TransactionStatusItem[] {
  const signed: TransactionStatusItem = { state: "signed" };
  if (snapshot.state === "submitted") return [signed, { state: "sent" }];

  const sent: TransactionStatusItem = { state: "sent", detail: snapshot.transactionHash };
  if (snapshot.state === "confirmed") {
    return [signed, sent, { state: "confirmed", detail: snapshot.transactionHash }];
  }

  return [
    signed,
    sent,
    {
      state: "failed",
      ...(snapshot.failureReason === null ? {} : { detail: failureReasonCopy(snapshot.failureReason) })
    }
  ];
}

export interface CompanySignDistributionProps {
  readonly campaign: MyCampaign;
  /** The row this action belongs to; kept for context and future per-row state. */
  readonly distribution: MyCampaignDistribution;
  /** The campaign's application identity, resolved by the dashboard. */
  readonly applicationId: string;
  /** Injectable for tests; `undefined` uses the env-configured gateway, `null` forces "no backend". */
  readonly gateway?: RevenueShareDistributionGateway | null;
  /** Injectable so the component can be exercised with a deterministic wallet double. */
  readonly wallet?: WalletPort;
  /** Injectable so the component can be exercised with a deterministic connection double. */
  readonly connection?: WalletConnectionPort | null;
  /** Called once after a successful submit so the dashboard reloads. */
  readonly onSigned: () => void;
  /** Optional dismissal of the panel. */
  readonly onCancel?: () => void;
  /**
   * When true the review starts on mount and no trigger button renders — the
   * dashboard's own row button already fired. Defaults to false (self-contained).
   */
  readonly autoStart?: boolean;
}

export function CompanySignDistribution({
  campaign,
  distribution,
  applicationId,
  gateway = defaultGateway,
  wallet = defaultWallet,
  connection = defaultConnection,
  onSigned,
  onCancel,
  autoStart = false
}: CompanySignDistributionProps) {
  const signing = useCompanyDistributionSigning({ gateway, wallet, connection, applicationId, onSigned });
  const startedRef = useRef(false);
  const { start } = signing;

  useEffect(() => {
    if (!autoStart || startedRef.current) return;
    startedRef.current = true;
    void start(campaign);
  }, [autoStart, start, campaign]);

  const reviewError = signing.isReviewOpen && signing.reviewAttempted ? signing.failure : undefined;
  const bannerError = reviewError === undefined ? signing.failure : undefined;

  const networkProps: TransactionReviewNetworkState =
    reviewError?.kind === "wallet_network_mismatch"
      ? { isWrongNetwork: true, wrongNetworkMessage: microcopy.wrongNetwork }
      : {};
  const signingProps: TransactionReviewSigningState = signing.isSubmitting
    ? { signingStatus: "signing" }
    : reviewError === undefined
      ? { signingStatus: "idle" }
      : reviewError.kind === "wallet_rejected"
        ? { signingStatus: "signature-rejected", signingErrorMessage: reviewError.message }
        : { signingStatus: "verification-rejected", signingErrorMessage: reviewError.message };

  // The list's own button is the trigger in the dashboard (`autoStart`); after a
  // failure or a cancelled review the panel offers its own retry instead.
  const showTrigger =
    !autoStart ||
    signing.failure !== undefined ||
    (signing.prepared !== undefined && !signing.isReviewOpen && signing.snapshot === undefined);

  return (
    <section
      aria-label={`Revisar y firmar la distribución de ${campaign.name}`}
      lang="es"
      className="flex flex-col gap-4 rounded-card border border-border p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="m-0 text-[17px] font-bold">
          {distribution.period === null ? "Revisar y firmar" : `Revisar y firmar · ${distribution.period}`}
        </h3>
        {onCancel ? (
          <Button variant="ghost" onPress={onCancel}>
            Cerrar
          </Button>
        ) : null}
      </div>

      {bannerError ? (
        <p role="alert" className="m-0 text-sm text-trust-critical">
          {bannerError.message}
        </p>
      ) : null}

      {showTrigger ? (
        <div>
          <Button
            variant="secondary"
            onPress={() => void signing.start(campaign)}
            isLoading={signing.isPreparing}
            loadingLabel="Preparando…"
          >
            Revisar y firmar
          </Button>
        </div>
      ) : null}

      {signing.snapshot ? (
        <section aria-label="Estado de la distribución" className="flex flex-col gap-3">
          {signing.applied === false ? (
            <p className="m-0 text-sm">
              La distribución ya estaba registrada; se muestra el registro existente sin duplicarlo.
            </p>
          ) : null}
          <TransactionStatusList
            items={statusItems(signing.snapshot)}
            subtitle="Distribución de ingresos · Stellar Testnet"
          />
          <p className="m-0">
            <a className="underline" href={signing.snapshot.explorerUrl} rel="noreferrer noopener" target="_blank">
              Ver la transacción en el explorador
            </a>
          </p>
          <div>
            <Button variant="secondary" onPress={() => void signing.refreshStatus()}>
              Consultar estado
            </Button>
          </div>
        </section>
      ) : null}

      <TransactionReviewModal
        isOpen={signing.isReviewOpen}
        onClose={signing.closeReview}
        onSign={() => void signing.sign()}
        title="Distribución de ingresos"
        amount={signing.prepared ? formatStroopsAsXlm(totalRecipientStroops(signing.prepared.recipients)) : ""}
        assetCode="XLM"
        acknowledgementLabel="Confirmo que revisé los destinatarios y los montos"
        descriptionRows={
          signing.prepared
            ? [
                ...distributionReviewRows(campaign),
                { label: "Cuenta de origen", value: signing.publicKey ?? "", mono: true },
                ...signing.prepared.recipients.map((recipient, index) => ({
                  label: `Destinatario ${index + 1} · ${formatStroopsAsXlm(recipient.amountStroops)} XLM`,
                  value: recipient.accountId,
                  mono: true
                }))
              ]
            : []
        }
        {...networkProps}
        {...signingProps}
      />
    </section>
  );
}
