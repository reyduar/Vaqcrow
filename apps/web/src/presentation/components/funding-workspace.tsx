"use client";

import { Button, Input, Label } from "@heroui/react";
import { useId, useState } from "react";
import { failureReasonCopy } from "@/application/funding/failure-reason-copy";
import { xlmToStroops, type XlmAmountError } from "@/application/funding/xlm-amount";
import type { FundingIntentGateway } from "@/application/ports/funding-intent-gateway";
import type { WalletPort } from "@/application/ports/wallet-port";
import { microcopy } from "@/application/trust/disclosures";
import { createFundingIntentGateway } from "@/infrastructure/funding/default-gateway";
import { FreighterWallet } from "@/infrastructure/wallet/freighter-wallet";
import { useFundingIntent } from "@/state/use-funding-intent";
import { Badge } from "./badge";

/** The wallet the demo uses when none is supplied; module scope keeps it stable across renders. */
const defaultWallet = new FreighterWallet();
const defaultGateway = createFundingIntentGateway(process.env["NEXT_PUBLIC_API_BASE_URL"]);

const AMOUNT_ERROR: Readonly<Record<XlmAmountError, string>> = {
  invalid_format: "Ingresá un monto en XLM, por ejemplo 12.5.",
  too_many_decimals: "El monto admite hasta 7 decimales (1 XLM = 10.000.000 stroops).",
  not_positive: "El monto tiene que ser mayor que cero."
};

const INPUT_CLASS = "w-full";

export interface FundingWorkspaceProps {
  /** Injectable for tests; `undefined` uses the env-configured gateway, `null` forces "no backend". */
  readonly gateway?: FundingIntentGateway | null;
  /** Injectable so the component can be exercised with a deterministic wallet double. */
  readonly wallet?: WalletPort;
  /** Traceability link only (`D4`); the demo has no persisted application to attach. */
  readonly applicationId?: string | null;
}

/**
 * Funding step container. It converts the amount the person typed into stroops
 * locally, then hands the draft to `useFundingIntent`, which prepares the
 * transaction, asks the wallet to sign it with the passphrase the service
 * returned, and submits the signed envelope.
 *
 * Nothing here decides a success: the submitted view renders only what the
 * backend confirmed, and a replay is shown as a replay.
 */
export function FundingWorkspace({
  gateway = defaultGateway,
  wallet = defaultWallet,
  applicationId = null
}: FundingWorkspaceProps) {
  const idPrefix = useId();
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [amountError, setAmountError] = useState<string | undefined>();

  const { publicKey, isConnecting, connect, submit, isSubmitting, error, prepared, result, refreshStatus } =
    useFundingIntent(gateway, wallet, applicationId);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = xlmToStroops(amount);
    if (!parsed.ok) {
      setAmountError(AMOUNT_ERROR[parsed.error]);
      return;
    }

    setAmountError(undefined);
    void submit({
      destinationAccountId: destination.trim(),
      amountStroops: parsed.stroops,
      memo: memo.trim() === "" ? null : memo.trim()
    });
  };

  return (
    <section aria-label="Envío de fondeo" lang="es" className="flex max-w-xl flex-col gap-4">
      <h3 className="text-lg font-semibold">Envío de fondeo</h3>
      <p className="text-sm">
        El servicio arma la transacción y declara en qué red firmarla. Vos la revisás y la firmás en tu wallet; Vaqcrow no
        recibe tus claves ni mueve los fondos.
      </p>

      <p aria-live="polite" className="text-sm">
        {publicKey ? `Wallet conectada: ${publicKey}` : "Wallet no conectada"}
      </p>
      {publicKey ? null : (
        <Button type="button" onPress={connect} isDisabled={isConnecting}>
          {isConnecting ? "Conectando…" : "Conectar wallet"}
        </Button>
      )}

      <form onSubmit={handleSubmit} noValidate aria-label="Envío de fondeo" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${idPrefix}-destination`}>Cuenta de destino</Label>
          <Input
            id={`${idPrefix}-destination`}
            className={INPUT_CLASS}
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor={`${idPrefix}-amount`}>Monto (XLM)</Label>
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
          <span className="text-sm text-muted">Monto simulado de la demo. 1 XLM = 10.000.000 stroops.</span>
          {amountError ? (
            <span role="alert" className="text-sm text-trust-critical">
              {amountError}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor={`${idPrefix}-memo`}>Memo (opcional)</Label>
          <Input
            id={`${idPrefix}-memo`}
            className={INPUT_CLASS}
            value={memo}
            maxLength={28}
            onChange={(event) => setMemo(event.target.value)}
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-trust-critical">
            {error.message}
          </p>
        ) : null}

        <Button type="submit" isDisabled={isSubmitting || !publicKey}>
          {isSubmitting ? "Firmando y enviando…" : "Firmar y enviar"}
        </Button>
      </form>

      {prepared && !result ? (
        <p className="text-sm">
          El servicio preparó la transacción. Firmala en tu wallet para enviarla.
        </p>
      ) : null}

      {result ? (
        <section aria-label="Resultado del envío" className="flex flex-col gap-2">
          <p role="status" className="text-lg font-semibold">
            {result.applied
              ? "Envío registrado"
              : "El envío ya estaba registrado; se muestra el registro existente sin duplicarlo."}
          </p>
          <Badge variant="testnet" label={microcopy.testnetBadge} lang="es" />
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
            <dt>Estado</dt>
            <dd>{result.intent.state}</dd>
            <dt>Hash de la transacción</dt>
            <dd className="break-all">{result.intent.transactionHash}</dd>
            <dt>Explorador Testnet</dt>
            <dd>
              {/* The API supplies the link because the browser holds no opinion
                  about the network (`D1`); composing it here would mean the web
                  knowing where a Testnet hash opens. */}
              <a
                className="underline"
                href={result.intent.explorerUrl}
                rel="noreferrer noopener"
                target="_blank"
              >
                Ver la transacción en el explorador
              </a>
            </dd>
            {result.intent.failureReason === null ? null : (
              <>
                <dt>Motivo del fallo</dt>
                <dd>
                  {failureReasonCopy(result.intent.failureReason)}{" "}
                  <code className="text-xs opacity-70">{result.intent.failureReason}</code>
                </dd>
              </>
            )}
            <dt>Identificador del envío</dt>
            <dd>{result.intent.intentId}</dd>
          </dl>
          <Button type="button" variant="secondary" onPress={() => void refreshStatus()}>
            Consultar estado
          </Button>
        </section>
      ) : null}
    </section>
  );
}
