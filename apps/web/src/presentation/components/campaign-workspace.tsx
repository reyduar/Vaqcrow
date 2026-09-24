"use client";

import { Button, Input, Label } from "@heroui/react";
import { useId, useState } from "react";
import { DEMO_APPLICATION_ID } from "@/application/fixtures/demo-application";
import { xlmToStroops, type XlmAmountError } from "@/application/funding/xlm-amount";
import type { CampaignGateway } from "@/application/ports/campaign-gateway";
import type { WalletPort } from "@/application/ports/wallet-port";
import { microcopy } from "@/application/trust/disclosures";
import { createCampaignGateway } from "@/infrastructure/campaign/default-gateway";
import { FreighterWallet } from "@/infrastructure/wallet/freighter-wallet";
import { useCampaignVault } from "@/state/use-campaign-vault";
import type { CampaignState } from "@vaqcrow/contracts";
import { Badge } from "./badge";

/** The wallet and gateway the demo uses when none is supplied; module scope keeps them stable across renders. */
const defaultWallet = new FreighterWallet();
const defaultGateway = createCampaignGateway(process.env["NEXT_PUBLIC_API_BASE_URL"]);

const AMOUNT_ERROR: Readonly<Record<XlmAmountError, string>> = {
  invalid_format: "Ingresá un monto en XLM, por ejemplo 12.5.",
  too_many_decimals: "El monto admite hasta 7 decimales (1 XLM = 10.000.000 stroops).",
  not_positive: "El monto tiene que ser mayor que cero."
};

const STATE_LABEL: Readonly<Record<CampaignState, string>> = {
  funding: "Fondeo abierto",
  settled: "Meta alcanzada",
  refunding: "Reembolso disponible"
};

const STATE_TONE: Readonly<Record<CampaignState, "info" | "neutral" | "caution">> = {
  funding: "info",
  settled: "neutral",
  refunding: "caution"
};

const INPUT_CLASS = "w-full";

/** Whole XLM plus up to 7 decimal digits, trailing zeros trimmed. Display only; it never crosses the wire. */
function formatStroopsAsXlm(stroops: bigint): string {
  const whole = stroops / 10_000_000n;
  const fraction = (stroops % 10_000_000n).toString().padStart(7, "0").replace(/0+$/, "");
  return fraction.length > 0 ? `${whole}.${fraction}` : whole.toString();
}

/** A `type="date"` value carries no time or offset; the contract requires both (`z.iso.datetime({ offset: true })`), so midnight UTC is declared explicitly. */
function toIsoDeadline(dateInput: string): string {
  return `${dateInput}T00:00:00.000Z`;
}

export interface CampaignWorkspaceProps {
  /** Injectable for tests; `undefined` uses the env-configured gateway, `null` forces "no backend". */
  readonly gateway?: CampaignGateway | null;
  /** Injectable so the component can be exercised with a deterministic wallet double. */
  readonly wallet?: WalletPort;
  /** The application the vault opens for; defaults to the demo's single fixed application (`D7`). */
  readonly applicationId?: string;
  /** `null` renders the open-campaign panel; a value renders the campaign view. The page keeps this in `?campaign=`. */
  readonly campaignId?: string | null;
  /** Called once the vault is open, so the page can move the id into the URL and re-render as the campaign view. */
  readonly onCampaignOpened?: (campaignId: string) => void;
}

/**
 * Campaign vault container (Task #247). Renders one of two views depending
 * on whether a campaign id is already known: the open-campaign panel (the
 * SME connects Freighter and declares a goal and deadline; the SME signs
 * nothing — the platform opens the vault) or the campaign view (state,
 * progress and the connected investor's own contribute/withdraw/refund
 * controls), always driven by `useCampaignVault`'s chain-observed snapshot,
 * never by locally invented state.
 */
export function CampaignWorkspace({
  gateway = defaultGateway,
  wallet = defaultWallet,
  applicationId = DEMO_APPLICATION_ID,
  campaignId = null,
  onCampaignOpened
}: CampaignWorkspaceProps) {
  const idPrefix = useId();
  const {
    publicKey,
    isConnecting,
    connect,
    campaign,
    openCampaign,
    isOpening,
    contribute,
    withdraw,
    refund,
    isSubmitting,
    pendingOperation,
    error
  } = useCampaignVault(gateway, wallet, campaignId);

  const [goal, setGoal] = useState("");
  const [deadline, setDeadline] = useState("");
  const [goalError, setGoalError] = useState<string | undefined>();
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | undefined>();
  const [refundTarget, setRefundTarget] = useState("");

  const walletStatus = (
    <p aria-live="polite" className="text-sm">
      {publicKey ? `Wallet conectada: ${publicKey}` : "Wallet no conectada"}
    </p>
  );

  const connectButton = publicKey ? null : (
    <Button type="button" onPress={connect} isDisabled={isConnecting}>
      {isConnecting ? "Conectando…" : "Conectar wallet"}
    </Button>
  );

  const errorBanner = error ? (
    <p role="alert" className="text-sm text-trust-critical">
      {error.message}
    </p>
  ) : null;

  if (!campaignId) {
    const handleOpen = (event: React.FormEvent) => {
      event.preventDefault();
      const parsedGoal = xlmToStroops(goal);
      if (!parsedGoal.ok) {
        setGoalError(AMOUNT_ERROR[parsedGoal.error]);
        return;
      }
      setGoalError(undefined);
      void openCampaign({
        applicationId,
        goalStroops: parsedGoal.stroops,
        deadline: toIsoDeadline(deadline)
      }).then((opened) => {
        if (opened) onCampaignOpened?.(opened);
      });
    };

    return (
      <section aria-label="Abrir bóveda de campaña" lang="es" className="flex max-w-xl flex-col gap-4">
        <h3 className="text-lg font-semibold">Abrir bóveda de campaña</h3>
        <p className="text-sm">
          Vaqcrow crea la cuenta de la PyME a partir de la clave pública que declarás acá y abre la bóveda del
          contrato sobre esa cuenta. La PyME no firma nada en este paso: sólo conecta su wallet para declarar la
          clave que ya tiene.
        </p>

        {walletStatus}
        {connectButton}

        <form onSubmit={handleOpen} noValidate aria-label="Abrir bóveda de campaña" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${idPrefix}-goal`}>Meta (XLM)</Label>
            <Input
              id={`${idPrefix}-goal`}
              className={INPUT_CLASS}
              inputMode="decimal"
              value={goal}
              aria-invalid={goalError ? "true" : undefined}
              onChange={(event) => {
                setGoal(event.target.value);
                setGoalError(undefined);
              }}
            />
            {goalError ? (
              <span role="alert" className="text-sm text-trust-critical">
                {goalError}
              </span>
            ) : null}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor={`${idPrefix}-deadline`}>Fecha límite</Label>
            <Input
              id={`${idPrefix}-deadline`}
              type="date"
              className={INPUT_CLASS}
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </div>

          {errorBanner}

          <Button type="submit" isDisabled={isOpening || !publicKey}>
            {isOpening ? "Abriendo bóveda…" : "Abrir bóveda"}
          </Button>
        </form>
      </section>
    );
  }

  if (!campaign) {
    return (
      <section aria-label="Bóveda de campaña" lang="es" className="flex flex-col gap-4">
        {walletStatus}
        {connectButton}
        <p aria-live="polite">Cargando la campaña…</p>
        {errorBanner}
      </section>
    );
  }

  const canContribute = campaign.state === "funding";
  const canWithdraw = campaign.state === "funding";
  const canRefund = campaign.state === "refunding";

  const handleContribute = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = xlmToStroops(amount);
    if (!parsed.ok) {
      setAmountError(AMOUNT_ERROR[parsed.error]);
      return;
    }
    setAmountError(undefined);
    void contribute(parsed.stroops);
  };

  const handleRefund = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = refundTarget.trim();
    void refund(trimmed === "" ? undefined : trimmed);
  };

  return (
    <section aria-label="Bóveda de campaña" lang="es" className="flex max-w-xl flex-col gap-4">
      <h3 className="text-lg font-semibold">Bóveda de campaña</h3>
      <div className="flex gap-2">
        <Badge variant="testnet" label={microcopy.testnetBadge} lang="es" />
        <Badge
          variant="transaction"
          label={STATE_LABEL[campaign.state]}
          tone={STATE_TONE[campaign.state]}
          lang="es"
        />
      </div>

      {walletStatus}
      {connectButton}

      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
        <dt>Meta</dt>
        <dd>{formatStroopsAsXlm(campaign.goalStroops)} XLM</dd>
        <dt>Total aportado</dt>
        <dd>{formatStroopsAsXlm(campaign.totalStroops)} XLM</dd>
        <dt>Fecha límite</dt>
        <dd>{campaign.deadline}</dd>
        {campaign.investorContributionStroops === undefined || campaign.investorContributionStroops === null ? null : (
          <>
            <dt>Tu aporte</dt>
            <dd>{formatStroopsAsXlm(campaign.investorContributionStroops)} XLM</dd>
          </>
        )}
        {campaign.explorerUrl ? (
          <>
            <dt>Explorador Testnet</dt>
            <dd>
              <a className="underline" href={campaign.explorerUrl} rel="noreferrer noopener" target="_blank">
                Ver el contrato en el explorador
              </a>
            </dd>
          </>
        ) : null}
      </dl>

      {errorBanner}

      {canContribute ? (
        <form
          onSubmit={handleContribute}
          noValidate
          aria-label="Aportar a la campaña"
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${idPrefix}-amount`}>Monto a aportar (XLM)</Label>
            <Input
              id={`${idPrefix}-amount`}
              className={INPUT_CLASS}
              inputMode="decimal"
              value={amount}
              aria-invalid={amountError ? "true" : undefined}
              onChange={(event) => {
                setAmount(event.target.value);
                setAmountError(undefined);
              }}
            />
            {amountError ? (
              <span role="alert" className="text-sm text-trust-critical">
                {amountError}
              </span>
            ) : null}
          </div>
          <Button type="submit" isDisabled={isSubmitting || !publicKey}>
            {isSubmitting && pendingOperation === "contribute" ? "Firmando y enviando…" : "Aportar"}
          </Button>
        </form>
      ) : (
        <p className="text-sm">
          La bóveda ya no acepta aportes: el contrato rechaza cualquier aporte fuera del estado de fondeo.
        </p>
      )}

      {canWithdraw ? (
        <Button
          type="button"
          variant="secondary"
          isDisabled={isSubmitting || !publicKey}
          onPress={() => void withdraw()}
        >
          {isSubmitting && pendingOperation === "withdraw" ? "Retirando…" : "Retirar mi aporte"}
        </Button>
      ) : null}

      {canRefund ? (
        <form onSubmit={handleRefund} noValidate aria-label="Reembolsar aporte" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${idPrefix}-refund-target`}>Cuenta a reembolsar (opcional)</Label>
            <Input
              id={`${idPrefix}-refund-target`}
              className={INPUT_CLASS}
              value={refundTarget}
              onChange={(event) => setRefundTarget(event.target.value)}
            />
            <span className="text-sm text-muted">
              Dejalo vacío para reembolsar tu propio aporte. El destino lo fija el contrato: activar el reembolso de
              otra cuenta no puede redirigir sus fondos, sólo dispararlo.
            </span>
          </div>
          <Button type="submit" isDisabled={isSubmitting || !publicKey}>
            {isSubmitting && pendingOperation === "refund" ? "Reembolsando…" : "Reembolsar"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
