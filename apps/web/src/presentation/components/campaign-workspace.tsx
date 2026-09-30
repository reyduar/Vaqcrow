"use client";

import { useEffect, useState } from "react";
import type { CampaignVaultError } from "@/application/campaign/campaign-vault-errors";
import { formatStroopsAsXlm } from "@/application/format/stroops";
import { xlmToStroops, type XlmAmountError } from "@/application/funding/xlm-amount";
import type { CampaignGateway } from "@/application/ports/campaign-gateway";
import type { WalletPort } from "@/application/ports/wallet-port";
import { microcopy } from "@/application/trust/disclosures";
import { createCampaignGateway } from "@/infrastructure/campaign/default-gateway";
import { FreighterWallet } from "@/infrastructure/wallet/freighter-wallet";
import { useJourneyStore } from "@/state/journey-store-provider";
import { useCampaignVault } from "@/state/use-campaign-vault";
import type { CampaignState } from "@vaqcrow/contracts";
import { Badge } from "./badge";
import { Button } from "./button";
import { StartWithRequestNotice } from "./start-with-request-notice";
import { TextField } from "./text-field";
import {
  TransactionReviewModal,
  type TransactionReviewNetworkState,
  type TransactionReviewSigningState
} from "./transaction-review-modal";

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

/**
 * Maps a contribute failure to the review modal's signing state (D5 in
 * `odd/tasks/claude-design-shell-and-review-adoption.md`). `wallet_rejected`
 * is the only failure the modal calls a signature rejection; a wrong network
 * is surfaced through the network state instead (it blocks signing, so
 * `idle`); every other failure — missing wallet, refused, unavailable, … — is
 * the closest existing prop, `verification-rejected`. There is no dedicated
 * "wallet unavailable" state in the modal, so no new component state is
 * invented (`recorded gap`, not patched).
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

/** A `type="date"` value carries no time or offset; the contract requires both (`z.iso.datetime({ offset: true })`), so midnight UTC is declared explicitly. */
function toIsoDeadline(dateInput: string): string {
  return `${dateInput}T00:00:00.000Z`;
}

export interface CampaignWorkspaceProps {
  /** Injectable for tests; `undefined` uses the env-configured gateway, `null` forces "no backend". */
  readonly gateway?: CampaignGateway | null;
  /** Injectable so the component can be exercised with a deterministic wallet double. */
  readonly wallet?: WalletPort;
}

/**
 * Campaign vault container (Task #247). Without a journey application it asks
 * for the request first. Otherwise it renders one of two views depending on
 * whether the journey already knows a campaign id: the open-campaign panel (the
 * SME connects Freighter and declares a goal and deadline; the SME signs
 * nothing — the platform opens the vault) or the campaign view (state,
 * progress and the connected investor's own contribute/withdraw/refund
 * controls), always driven by `useCampaignVault`'s chain-observed snapshot,
 * never by locally invented state.
 */
export function CampaignWorkspace({
  gateway = defaultGateway,
  wallet = defaultWallet
}: CampaignWorkspaceProps) {
  // The journey owns both ids: the application the vault opens for, and the
  // campaign once it is open (recorded below, or hydrated from the URL).
  const applicationId = useJourneyStore((state) => state.applicationId);
  const campaignId = useJourneyStore((state) => state.campaignId);
  const recordCampaign = useJourneyStore((state) => state.recordCampaign);
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

  // `Date.now()` is impure and may not be called during render (React's own
  // purity rule) — `now` is tracked as state instead, refreshed on a timer
  // while the campaign is still open. This is also what makes the deadline
  // gate below reactive in production: nobody has to reload the page for
  // the refund button to appear once the deadline actually passes.
  const [now, setNow] = useState(() => Date.now());
  const campaignState = campaign?.state;
  useEffect(() => {
    if (campaignState !== "funding") return;
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, [campaignState]);

  // The pending "Aportar" review (slice 2 of #323): "Aportar" no longer signs
  // inline — it opens `TransactionReviewModal` with the real intent, and only
  // "Firmar en Freighter" runs `contribute`. `errorBaseline` scopes the
  // review's error to failures produced *during* this review (D8), so a stale
  // error from a previous operation never shows inside a fresh one. `stroops`
  // is the decimal-integer string `xlmToStroops` returns and `contribute`
  // takes — money never passes through a `number`.
  const [review, setReview] = useState<{
    readonly amount: string;
    readonly stroops: string;
    readonly errorBaseline: CampaignVaultError | undefined;
    readonly attempted: boolean;
  } | null>(null);

  const reviewError = review && review.errorBaseline !== error ? error : undefined;
  // One error owner at a time (D5): while the review shows its own error, the
  // workspace banner must not repeat it. Every other operation's error still
  // reaches the banner.
  const bannerError = reviewError !== undefined ? undefined : error;
  const isReviewSigning = isSubmitting && pendingOperation === "contribute";

  // Close on success: once a signing attempt finished with no error of its
  // own, the updated campaign view is what the person should see. A failure
  // keeps the review open so the person can retry; a signature is never shown
  // as confirmed. Adjusting state during render (React's own escape hatch for
  // state derived from a just-finished operation) closes it in the same commit
  // instead of cascading an extra render from an effect.
  if (review?.attempted && !isReviewSigning && !reviewError) setReview(null);

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

  const renderErrorBanner = (banner: CampaignVaultError | undefined) =>
    banner ? (
      <p role="alert" className="text-sm text-trust-critical">
        {banner.message}
      </p>
    ) : null;

  if (applicationId === null) return <StartWithRequestNotice action="abrir la campaña" />;

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
        if (opened) recordCampaign(opened);
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
          <TextField
            label="Meta (XLM)"
            inputMode="decimal"
            value={goal}
            {...(goalError ? { error: goalError } : {})}
            onChange={(value) => {
              setGoal(value);
              setGoalError(undefined);
            }}
          />

          <TextField label="Fecha límite" type="date" value={deadline} onChange={setDeadline} />

          {renderErrorBanner(error)}

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
        {renderErrorBanner(error)}
      </section>
    );
  }

  const canContribute = campaign.state === "funding";
  const canWithdraw = campaign.state === "funding";
  // The contract enters `Refunding` only on the *first* `refund`/`sweep` call
  // after the deadline — there is no on-chain scheduler, so nothing flips the
  // chain-observed `state` on its own (`contracts/campaign-vault/src/lib.rs`,
  // `ensure_refundable`). Gating the form on `state === "refunding"` alone
  // would make that first, permissionless call unreachable from the web
  // forever: nobody would ever see a refund button to press. Once the
  // deadline has passed, the contract accepts `refund` from any signer even
  // while it still reports `funding` (found and fixed under #248/T4).
  const canRefund = campaign.state === "refunding" || (campaign.state === "funding" && now >= Date.parse(campaign.deadline));

  const handleContribute = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = xlmToStroops(amount);
    if (!parsed.ok) {
      setAmountError(AMOUNT_ERROR[parsed.error]);
      return;
    }
    setAmountError(undefined);
    // Opening the review is the only thing "Aportar" does: the wallet is not
    // touched until "Firmar en Freighter" (`claude-design-brief.md:218`).
    setReview({ amount, stroops: parsed.stroops, errorBaseline: error, attempted: false });
  };

  // "Firmar en Freighter" inside the review runs the existing contribute flow.
  const handleSign = () => {
    if (!review) return;
    setReview({ ...review, attempted: true });
    void contribute(review.stroops);
  };

  const networkProps: TransactionReviewNetworkState =
    reviewError?.kind === "wallet_network_mismatch"
      ? { isWrongNetwork: true, wrongNetworkMessage: microcopy.wrongNetwork }
      : {};
  const signingProps = reviewSigningState(isReviewSigning, reviewError);

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

      {renderErrorBanner(bannerError)}

      {canContribute ? (
        <form
          onSubmit={handleContribute}
          noValidate
          aria-label="Aportar a la campaña"
          className="flex flex-col gap-3"
        >
          <TextField
            label="Monto a aportar (XLM)"
            inputMode="decimal"
            value={amount}
            {...(amountError ? { error: amountError } : {})}
            onChange={(value) => {
              setAmount(value);
              setAmountError(undefined);
            }}
          />
          <Button type="submit" isDisabled={isSubmitting || !publicKey}>
            {isSubmitting && pendingOperation === "contribute" ? "Firmando y enviando…" : "Aportar"}
          </Button>
        </form>
      ) : (
        <p className="text-sm">
          La bóveda ya no acepta aportes: el contrato rechaza cualquier aporte fuera del estado de fondeo.
        </p>
      )}

      <TransactionReviewModal
        isOpen={review !== null}
        onClose={() => setReview(null)}
        onSign={handleSign}
        title="Aportar a la campaña"
        amount={review?.amount ?? ""}
        assetCode="XLM"
        descriptionRows={[
          { label: "Contrato de la bóveda", value: campaign.contractAddress, mono: true },
          { label: "Función", value: "contribute" },
          { label: "Cuenta de origen", value: publicKey ?? "", mono: true }
        ]}
        {...networkProps}
        {...signingProps}
      />

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
          <TextField
            label="Cuenta a reembolsar (opcional)"
            value={refundTarget}
            helperText="Dejalo vacío para reembolsar tu propio aporte. El destino lo fija el contrato: activar el reembolso de otra cuenta no puede redirigir sus fondos, sólo dispararlo."
            onChange={setRefundTarget}
          />
          <Button type="submit" isDisabled={isSubmitting || !publicKey}>
            {isSubmitting && pendingOperation === "refund" ? "Reembolsando…" : "Reembolsar"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
