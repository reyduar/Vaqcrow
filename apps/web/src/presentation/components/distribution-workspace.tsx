"use client";

import { useCallback, useRef, useState } from "react";
import {
  demoDistributionRecipients,
  SIMULADO_DISTRIBUTION_LABEL
} from "@/application/distribution/demo-distribution-recipients";
import { DEMO_APPLICATION_ID } from "@/application/fixtures/demo-application";
import { formatStroopsAsXlm } from "@/application/format/stroops";
import { failureReasonCopy } from "@/application/funding/failure-reason-copy";
import type {
  RevenueShareDistributionErrorKind,
  RevenueShareDistributionGateway
} from "@/application/ports/revenue-share-distribution-gateway";
import type { WalletPort } from "@/application/ports/wallet-port";
import { WalletError } from "@/application/ports/wallet-port";
import { microcopy } from "@/application/trust/disclosures";
import { HttpRevenueShareDistributionGateway } from "@/infrastructure/distribution/http-revenue-share-distribution-gateway";
import { AxiosHttpClient } from "@/infrastructure/http/axios-http-client";
import { FreighterWallet } from "@/infrastructure/wallet/freighter-wallet";
import type {
  PreparedRevenueShareDistribution,
  RevenueShareDistributionSnapshot
} from "@vaqcrow/contracts";
import { Badge } from "./badge";
import { Button } from "./button";
import { SyntheticValue } from "./synthetic-value";
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
const MESSAGES: Readonly<Record<DistributionFailureKind, string>> = {
  validation:
    "El servicio rechazó los datos de la distribución. Revise los destinatarios y vuelva a prepararla.",
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

function failureOfKind(kind: DistributionFailureKind): DistributionFailure {
  return { kind, message: MESSAGES[kind] };
}

const WALLET_KIND: Readonly<Record<WalletError["kind"], DistributionFailureKind>> = {
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
  /** Traceability link only (`D4`); defaults to the demo's single fixed application. */
  readonly applicationId?: string | null;
}

/**
 * Distribution step container. The connected account is the source; the
 * recipients are the frozen synthetic demo fixture. The service builds the
 * transaction, the person reviews the recipients and amounts and signs it in
 * Freighter, and the service verifies and submits it.
 *
 * Nothing is signed until the person explicitly confirms inside the review
 * modal, and the passphrase always comes from the prepared response — never a
 * constant this component owns. A rejected signature or an unavailable service
 * never renders as a success, and `submitted` never renders as `confirmed`.
 */
export function DistributionWorkspace({
  gateway = defaultGateway,
  wallet = defaultWallet,
  applicationId = DEMO_APPLICATION_ID
}: DistributionWorkspaceProps) {
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

    inFlightRef.current = true;
    setIsPreparing(true);
    try {
      const result = await gateway.prepare({
        sourceAccountId: publicKey,
        recipients: demoDistributionRecipients.recipients.map((recipient) => ({
          accountId: recipient.accountId,
          amountStroops: recipient.amountStroops
        })),
        memo: null,
        applicationId
      });

      if (result.ok) {
        setPrepared(result.value);
        setSnapshot(undefined);
        setApplied(undefined);
        setIsReviewOpen(true);
      } else {
        setFailure(failureOfKind(result.error.kind));
      }
    } catch {
      setFailure(failureOfKind("unknown"));
    } finally {
      inFlightRef.current = false;
      setIsPreparing(false);
    }
  }, [gateway, publicKey, applicationId]);

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
        applicationId: prepared.applicationId
      });

      if (result.ok) {
        setSnapshot(result.value.distribution);
        setApplied(result.value.applied);
        setIsReviewOpen(false);
        setReviewAttempted(false);
      } else {
        setFailure(failureOfKind(result.error.kind));
      }
    } catch (caught) {
      setFailure(toFailure(caught));
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, [gateway, wallet, prepared]);

  const refreshStatus = useCallback(async () => {
    if (!gateway || !snapshot) return;
    setFailure(undefined);
    const result = await gateway.getStatus(snapshot.distributionId);
    if (result.ok) setSnapshot(result.value);
    else setFailure(failureOfKind(result.error.kind));
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

  return (
    <section aria-label="Distribución de ingresos" lang="es" className="flex max-w-xl flex-col gap-4">
      <h3 className="text-lg font-semibold">Distribución de ingresos</h3>
      <div className="flex flex-wrap gap-2">
        <Badge variant="testnet" label={microcopy.testnetBadge} lang="es" />
        <Badge variant="simulado" label={SIMULADO_DISTRIBUTION_LABEL} lang="es" />
      </div>
      <p className="text-sm">
        El servicio arma la transacción de distribución y declara en qué red debe firmarse. Revise
        la transacción y fírmela en su wallet; Vaqcrow nunca recibe sus claves ni mueve los fondos.
      </p>

      <p aria-live="polite" className="text-sm">
        {publicKey ? `Wallet conectada: ${publicKey}` : "Wallet no conectada"}
      </p>
      {publicKey ? null : (
        <Button type="button" onPress={() => void connect()} isDisabled={isConnecting}>
          {isConnecting ? "Conectando…" : "Conectar wallet"}
        </Button>
      )}

      <section aria-label="Destinatarios de la distribución" className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold">
          Destinatarios <span className="text-muted">· datos simulados de la demo</span>
        </h4>
        <ul className="flex list-none flex-col gap-1 p-0 text-sm">
          {demoDistributionRecipients.recipients.map((recipient, index) => (
            <li key={recipient.accountId} className="flex flex-wrap items-center gap-2">
              <SyntheticValue
                label={`Destinatario ${index + 1}`}
                value={`${formatStroopsAsXlm(recipient.amountStroops)} XLM`}
                simuladoLabel={SIMULADO_DISTRIBUTION_LABEL}
              />
              <span className="font-mono text-xs break-all">{recipient.accountId}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm">
          Versión de la regla{" "}
          <span className="font-mono">{demoDistributionRecipients.ruleVersion}</span>{" "}
          <Badge variant="simulado" label={SIMULADO_DISTRIBUTION_LABEL} lang="es" />
        </p>
      </section>

      {bannerError ? (
        <p role="alert" className="text-sm text-trust-critical">
          {bannerError.message}
        </p>
      ) : null}

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

      {snapshot ? (
        <section aria-label="Estado de la distribución" className="flex flex-col gap-3">
          {applied === false ? (
            <p className="text-sm">
              La distribución ya estaba registrada; se muestra el registro existente sin
              duplicarlo.
            </p>
          ) : null}
          <TransactionStatusList
            items={statusItems(snapshot)}
            subtitle="Distribución de ingresos · Stellar Testnet"
          />
          <p>
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
                  label: `Versión de la regla (${SIMULADO_DISTRIBUTION_LABEL})`,
                  value: demoDistributionRecipients.ruleVersion
                },
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
