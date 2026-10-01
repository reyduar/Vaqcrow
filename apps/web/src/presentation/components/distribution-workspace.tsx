"use client";

import { useCallback, useRef, useState } from "react";
import { formatArs, formatRateBps } from "@/application/distribution/derivation-format";
import { derivationFailureMessage } from "@/application/distribution/derivation-failure-copy";
import { formatStroopsAsXlm } from "@/application/format/stroops";
import { failureReasonCopy } from "@/application/funding/failure-reason-copy";
import type {
  RevenueShareDistributionErrorKind,
  RevenueShareDistributionGateway,
  RevenueShareDistributionGatewayError
} from "@/application/ports/revenue-share-distribution-gateway";
import type { WalletPort } from "@/application/ports/wallet-port";
import { WalletError } from "@/application/ports/wallet-port";
import { microcopy } from "@/application/trust/disclosures";
import { HttpRevenueShareDistributionGateway } from "@/infrastructure/distribution/http-revenue-share-distribution-gateway";
import { AxiosHttpClient } from "@/infrastructure/http/axios-http-client";
import { FreighterWallet } from "@/infrastructure/wallet/freighter-wallet";
import { useJourneyStore } from "@/state/journey-store-provider";
import type {
  PreparedRevenueShareDistribution,
  RevenueShareDistributionSnapshot
} from "@vaqcrow/contracts";
import { Badge } from "./badge";
import { Button } from "./button";
import { DistributionDerivation } from "./distribution-derivation";
import { FundCampaignFirstNotice } from "./fund-campaign-first-notice";
import { StartWithRequestNotice } from "./start-with-request-notice";
import {
  TransactionReviewModal,
  type TransactionReviewNetworkState,
  type TransactionReviewSigningState
} from "./transaction-review-modal";
import { TransactionStatusList, type TransactionStatusItem } from "./transaction-status-list";

/** The wallet the demo uses when none is supplied; module scope keeps it stable across renders. */
const defaultWallet = new FreighterWallet();

/** `null` when no backend is configured: the workspace then refuses to prepare and says so. */
function createDefaultGateway(): RevenueShareDistributionGateway | null {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return null;
  return new HttpRevenueShareDistributionGateway(AxiosHttpClient.create({ baseUrl }));
}

const defaultGateway = createDefaultGateway();

/**
 * Why a distribution step failed, as a coarse kind the UI can act on. Backend
 * kinds come from the gateway's sanitized union; `not_connected` and the
 * `wallet_*` kinds are added here, because signing happens in this workspace
 * and a declined signature or a wallet on another network is as actionable as
 * an HTTP refusal.
 */
type DistributionFailureKind =
  | RevenueShareDistributionErrorKind
  | "not_connected"
  | "wallet_rejected"
  | "wallet_unavailable"
  | "wallet_network_mismatch"
  | "wallet_unknown";

interface DistributionFailure {
  readonly kind: DistributionFailureKind;
  readonly message: string;
}

/** Authored here and never sourced from the backend or the wallet. */
const MESSAGES: Readonly<Record<Exclude<DistributionFailureKind, "derivation_failed">, string>> = {
  validation: "El servicio rechazó los datos de la distribución. Vuelva a prepararla.",
  derivation_mismatch:
    "Los términos que se iban a firmar ya no coinciden con lo que el servicio calcula para esta campaña. No se registró nada; vuelva a preparar la distribución.",
  already_distributed:
    "Ya existe una distribución para este período de esta campaña. No se registró otra.",
  account_not_found:
    "La cuenta de origen no está fondeada en Testnet, así que no se pudo preparar la distribución. Fondee la cuenta en Testnet y vuelva a intentarlo.",
  not_found: "No se encontró la distribución en el servicio. Vuelva a prepararla.",
  xdr_rejected:
    "El servicio rechazó la transacción firmada. No se envió nada; vuelva a firmar con la información que el servicio le mostró.",
  idempotency_conflict:
    "Esa distribución ya se usó con otros datos. No se registró nada; prepare una distribución nueva.",
  conflict: "El servicio informó un conflicto y no registró la distribución. Vuelva a prepararla.",
  unavailable:
    "El servicio no está disponible en este momento. No se registró nada; puede reintentar.",
  network:
    "No se pudo confirmar el resultado: no hay conexión con el servicio. Reintentar es seguro; si la distribución ya se registró, se muestra el registro existente sin duplicarlo.",
  not_connected: "Conecte su wallet para preparar la distribución.",
  wallet_rejected:
    "Rechazó la firma en la wallet. No se envió nada y la distribución preparada sigue disponible para volver a firmar.",
  wallet_unavailable:
    "No se detectó una wallet disponible en este navegador. Instale o habilite Freighter y vuelva a intentarlo.",
  wallet_network_mismatch:
    "Su wallet está en otra red. Cámbiela a la red que declara la transacción y vuelva a firmar.",
  wallet_unknown:
    "La wallet no pudo firmar por un error inesperado. No se envió nada; puede reintentar.",
  unknown:
    "No se pudo completar la distribución por un error inesperado. No se confirmó nada; puede reintentar."
};

function failureOfKind(kind: Exclude<DistributionFailureKind, "derivation_failed">): DistributionFailure {
  return { kind, message: MESSAGES[kind] };
}

/** A refused derivation names its reason; every other gateway failure is a coarse kind. */
function failureOfError(error: RevenueShareDistributionGatewayError): DistributionFailure {
  if (error.kind === "derivation_failed") {
    return { kind: "derivation_failed", message: derivationFailureMessage(error.reason) };
  }
  return failureOfKind(error.kind);
}

const WALLET_KIND: Readonly<Record<WalletError["kind"], Exclude<DistributionFailureKind, "derivation_failed">>> = {
  rejected: "wallet_rejected",
  unavailable: "wallet_unavailable",
  network_mismatch: "wallet_network_mismatch",
  unknown: "wallet_unknown"
};

function toFailure(caught: unknown): DistributionFailure {
  if (caught instanceof WalletError) return failureOfKind(WALLET_KIND[caught.kind]);
  return failureOfKind("unknown");
}

/**
 * Sums the amounts the **service returned** so the review can show the total.
 * This is display aggregation of the API's own numbers, not the obligation
 * calculation: the API built the envelope and remains its only authority.
 */
function totalStroops(recipients: readonly { amountStroops: bigint }[]): bigint {
  return recipients.reduce((sum, recipient) => sum + recipient.amountStroops, 0n);
}

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
      ...(snapshot.failureReason === null
        ? {}
        : { detail: failureReasonCopy(snapshot.failureReason) })
    }
  ];
}

export interface DistributionWorkspaceProps {
  /** Injectable for tests; `undefined` uses the env-configured gateway, `null` forces "no backend". */
  readonly gateway?: RevenueShareDistributionGateway | null;
  /** Injectable so the component can be exercised with a deterministic wallet double. */
  readonly wallet?: WalletPort;
}

/**
 * Distribution step container. It acts on the journey's application (without
 * one it asks for the request first) and records the distribution it prepares
 * in the journey. Without a funded campaign it asks for one first. The
 * connected account is the source; the recipients and amounts are derived by the
 * service from the campaign and the SME's sales, and shown (labeled simulated)
 * before signing. The service builds the transaction, the person reviews the
 * derivation and signs it in Freighter, and the service verifies and submits it.
 *
 * Nothing is signed until the person explicitly confirms inside the review
 * modal, and the passphrase always comes from the prepared response — never a
 * constant this component owns. A rejected signature or an unavailable service
 * never renders as a success, and `submitted` never renders as `confirmed`.
 */
export function DistributionWorkspace({
  gateway = defaultGateway,
  wallet = defaultWallet
}: DistributionWorkspaceProps) {
  const applicationId = useJourneyStore((state) => state.applicationId);
  const campaignId = useJourneyStore((state) => state.campaignId);
  const distributionId = useJourneyStore((state) => state.distributionId);
  const recordDistribution = useJourneyStore((state) => state.recordDistribution);
  // The journey holds a distribution only under a campaign. Preparing and
  // submitting do not need one (the API takes the application), so without a
  // campaign the distribution simply is not recorded, instead of throwing.
  const onDistributionIdentified = useCallback(
    (id: string) => {
      if (campaignId !== null) recordDistribution(id);
    },
    [campaignId, recordDistribution]
  );
  const inFlightRef = useRef(false);
  const connectingRef = useRef(false);
  const [publicKey, setPublicKey] = useState<string | undefined>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prepared, setPrepared] = useState<PreparedRevenueShareDistribution | undefined>();
  const [snapshot, setSnapshot] = useState<RevenueShareDistributionSnapshot | undefined>();
  const [applied, setApplied] = useState<boolean | undefined>();
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewAttempted, setReviewAttempted] = useState(false);
  const [failure, setFailure] = useState<DistributionFailure | undefined>();

  const connect = useCallback(async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setIsConnecting(true);
    setFailure(undefined);
    try {
      const account = await wallet.connect();
      setPublicKey(account.publicKey);
    } catch (caught) {
      setFailure(toFailure(caught));
    } finally {
      connectingRef.current = false;
      setIsConnecting(false);
    }
  }, [wallet]);

  const prepare = useCallback(async () => {
    if (inFlightRef.current) return;
    setFailure(undefined);
    setReviewAttempted(false);

    if (!gateway) {
      setFailure(failureOfKind("unavailable"));
      return;
    }
    if (!publicKey) {
      setFailure(failureOfKind("not_connected"));
      return;
    }
    if (applicationId === null || campaignId === null) return;

    inFlightRef.current = true;
    setIsPreparing(true);
    try {
      // Who is paid and how much is derived by the service from the campaign and
      // the SME's sales; the web declares only the case.
      const result = await gateway.prepare({
        sourceAccountId: publicKey,
        applicationId,
        campaignId,
        memo: null
      });

      if (result.ok) {
        setPrepared(result.value);
        setSnapshot(undefined);
        setApplied(undefined);
        setIsReviewOpen(true);
        // The prepared answer is the first thing that names the distribution; the
        // page uses this to put the id in the URL so the hash survives navigation.
        onDistributionIdentified(result.value.distributionId);
      } else {
        setFailure(failureOfError(result.error));
      }
    } catch {
      setFailure(failureOfKind("unknown"));
    } finally {
      inFlightRef.current = false;
      setIsPreparing(false);
    }
  }, [gateway, publicKey, applicationId, campaignId, onDistributionIdentified]);

  const sign = useCallback(async () => {
    if (!prepared) return;
    setReviewAttempted(true);

    if (!gateway) {
      setFailure(failureOfKind("unavailable"));
      return;
    }
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setIsSubmitting(true);
    setFailure(undefined);
    try {
      const signedXdr = await wallet.signTransaction(prepared.xdr, prepared.networkPassphrase);
      const result = await gateway.submit({
        distributionId: prepared.distributionId,
        signedXdr,
        terms: {
          network: prepared.network,
          networkPassphrase: prepared.networkPassphrase,
          sourceAccountId: prepared.sourceAccountId,
          sourceSequence: prepared.sourceSequence,
          memo: prepared.memo,
          expiresAt: prepared.expiresAt,
          recipients: prepared.recipients
        },
        applicationId: prepared.applicationId,
        campaignId: prepared.campaignId
      });

      if (result.ok) {
        setSnapshot(result.value.distribution);
        setApplied(result.value.applied);
        setIsReviewOpen(false);
        setReviewAttempted(false);
        // The submit answer carries the same id the prepare did; re-declaring it
        // keeps the URL correct even if the prepared answer was never seen.
        onDistributionIdentified(result.value.distribution.distributionId);
      } else {
        setFailure(failureOfError(result.error));
      }
    } catch (caught) {
      setFailure(toFailure(caught));
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, [gateway, wallet, prepared, onDistributionIdentified]);

  const refreshStatus = useCallback(async () => {
    if (!gateway || !snapshot) return;
    setFailure(undefined);
    const result = await gateway.getStatus(snapshot.distributionId);
    if (result.ok) setSnapshot(result.value);
    else setFailure(failureOfError(result.error));
  }, [gateway, snapshot]);

  const closeReview = () => {
    setIsReviewOpen(false);
    setReviewAttempted(false);
    setFailure(undefined);
  };

  const reviewError = isReviewOpen && reviewAttempted ? failure : undefined;
  const bannerError = reviewError === undefined ? failure : undefined;

  const networkProps: TransactionReviewNetworkState =
    reviewError?.kind === "wallet_network_mismatch"
      ? { isWrongNetwork: true, wrongNetworkMessage: microcopy.wrongNetwork }
      : {};
  const signingProps: TransactionReviewSigningState = isSubmitting
    ? { signingStatus: "signing" }
    : reviewError === undefined
      ? { signingStatus: "idle" }
      : reviewError.kind === "wallet_rejected"
        ? { signingStatus: "signature-rejected", signingErrorMessage: reviewError.message }
        : { signingStatus: "verification-rejected", signingErrorMessage: reviewError.message };

  if (applicationId === null) return <StartWithRequestNotice action="preparar la distribución" />;
  if (campaignId === null) return <FundCampaignFirstNotice action="preparar la distribución" />;

  return (
    <section aria-label="Distribución de ingresos" lang="es" className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-card border border-border p-6">
        <h3 className="m-0 text-lg font-bold">Distribución de ingresos</h3>
        <div className="flex flex-wrap gap-2">
          <Badge variant="testnet" label={microcopy.testnetBadge} lang="es" />
          <Badge variant="simulado" label="SIMULADO" lang="es" />
        </div>
        <p className="m-0 text-sm">
          El servicio calcula la distribución a partir de la campaña y de las ventas simuladas de la
          PyME, arma la transacción y declara en qué red debe firmarse. Revise el cálculo y fírmela en
          su wallet; Vaqcrow nunca recibe sus claves ni mueve los fondos.
        </p>

        {/* The id the page read from `?distribution=`, shown so a reload keeps the
            reference visible; nothing is read back from it in this unit. */}
        {distributionId ? (
          <p className="m-0 text-sm">
            Referencia de la distribución:{" "}
            <span className="font-mono text-xs break-all">{distributionId}</span>
          </p>
        ) : null}

        <p aria-live="polite" className="m-0 text-sm">
          {publicKey ? `Wallet conectada: ${publicKey}` : "Wallet no conectada"}
        </p>
        {publicKey ? null : (
          <Button type="button" onPress={() => void connect()} isDisabled={isConnecting}>
            {isConnecting ? "Conectando…" : "Conectar wallet"}
          </Button>
        )}
      </div>

      {prepared ? (
        <DistributionDerivation derivation={prepared.derivation} recipients={prepared.recipients} />
      ) : null}

      {bannerError ? (
        <p role="alert" className="m-0 text-sm text-trust-critical">
          {bannerError.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="button" onPress={() => void prepare()} isDisabled={isPreparing || isSubmitting}>
          {isPreparing ? "Preparando…" : "Preparar distribución"}
        </Button>

        {prepared && !isReviewOpen ? (
          <Button
            type="button"
            variant="secondary"
            onPress={() => {
              setReviewAttempted(false);
              setFailure(undefined);
              setIsReviewOpen(true);
            }}
          >
            Revisar y firmar
          </Button>
        ) : null}
      </div>

      {snapshot ? (
        <section
          aria-label="Estado de la distribución"
          className="flex flex-col gap-3 rounded-card border border-border p-6"
        >
          {applied === false ? (
            <p className="m-0 text-sm">
              La distribución ya estaba registrada; se muestra el registro existente sin
              duplicarlo.
            </p>
          ) : null}
          <TransactionStatusList
            items={statusItems(snapshot)}
            subtitle="Distribución de ingresos · Stellar Testnet"
          />
          <p className="m-0">
            {/* The API supplies the link because the browser holds no opinion about
                the network (`D1`); composing it here would mean the web knowing where
                a Testnet hash opens. */}
            <a
              className="underline"
              href={snapshot.explorerUrl}
              rel="noreferrer noopener"
              target="_blank"
            >
              Ver la transacción en el explorador
            </a>
          </p>
          <Button type="button" variant="secondary" onPress={() => void refreshStatus()}>
            Consultar estado
          </Button>
        </section>
      ) : null}

      <TransactionReviewModal
        isOpen={isReviewOpen}
        onClose={closeReview}
        onSign={() => void sign()}
        title="Distribución de ingresos"
        amount={prepared ? formatStroopsAsXlm(totalStroops(prepared.recipients)) : ""}
        assetCode="XLM"
        acknowledgementLabel="Confirmo que revisé los destinatarios y los montos"
        descriptionRows={
          prepared
            ? [
                {
                  label: "Versión de la regla (SIMULADO)",
                  value: prepared.derivation.ruleVersion
                },
                { label: "Período (SIMULADO)", value: prepared.derivation.period },
                { label: "Ventas informadas (SIMULADO)", value: formatArs(prepared.derivation.salesArs) },
                { label: "Tasa", value: formatRateBps(prepared.derivation.rateBps) },
                { label: "Obligación (SIMULADO)", value: formatArs(prepared.derivation.obligationArs) },
                { label: "Cuenta de origen", value: publicKey ?? "", mono: true },
                ...prepared.recipients.map((recipient, index) => ({
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
