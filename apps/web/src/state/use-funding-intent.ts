"use client";

import { parsePrepareFundingIntentCommand } from "@vaqcrow/contracts";
import type { FundingIntentSnapshot, PreparedFundingIntent, SubmitFundingIntentCommand } from "@vaqcrow/contracts";
import { useCallback, useRef, useState } from "react";
import { fundingErrorOfKind, toFundingSubmitError, type FundingSubmitError } from "@/application/funding/funding-intent-errors";
import type { FundingIntentGateway, SubmittedFundingIntent } from "@/application/ports/funding-intent-gateway";
import type { WalletPort } from "@/application/ports/wallet-port";

/** What the form hands the hook; the amount is already a stroops decimal string. */
export interface FundingIntentDraft {
  readonly destinationAccountId: string;
  readonly amountStroops: string;
  readonly memo: string | null;
}

interface Attempt {
  readonly fingerprint: string;
  readonly prepared: PreparedFundingIntent;
  /** Kept after a submit failure so a retry does not prompt the wallet again. */
  signedXdr?: string;
}

function draftFingerprint(sourceAccountId: string, draft: FundingIntentDraft): string {
  return JSON.stringify([sourceAccountId, draft.destinationAccountId, draft.amountStroops, draft.memo]);
}

/**
 * Owns one funding attempt: prepare, sign, submit, and read back.
 *
 * This is the only place that calls `WalletPort.signTransaction`, and it always
 * passes the passphrase the prepare response returned (`D1`) — never a constant
 * the web owns, so the browser cannot disagree with the backend about which
 * network a signature means.
 *
 * Nothing is thrown to the component: every failure is a sanitized value. The
 * prepared intent survives a declined signature, a wallet on another network or
 * a lost response, so the person can retry without preparing again; only the
 * failures that invalidate it (a refused body, an unknown account, an
 * idempotency conflict) force a fresh prepare. A double submit is refused by an
 * in-flight guard, and a `200` replay is reported as a replay, not swallowed.
 */
export function useFundingIntent(
  gateway: FundingIntentGateway | null,
  wallet: WalletPort,
  applicationId: string | null
) {
  const attemptRef = useRef<Attempt | undefined>(undefined);
  const inFlightRef = useRef(false);
  const connectingRef = useRef(false);
  const [publicKey, setPublicKey] = useState<string | undefined>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<FundingSubmitError | undefined>();
  const [prepared, setPrepared] = useState<PreparedFundingIntent | undefined>();
  const [result, setResult] = useState<SubmittedFundingIntent | undefined>();
  const [status, setStatus] = useState<FundingIntentSnapshot | undefined>();

  const connect = useCallback(async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setIsConnecting(true);
    setError(undefined);
    try {
      const account = await wallet.connect();
      setPublicKey(account.publicKey);
    } catch (caught) {
      setError(toFundingSubmitError(caught));
    } finally {
      connectingRef.current = false;
      setIsConnecting(false);
    }
  }, [wallet]);

  const submit = useCallback(
    async (draft: FundingIntentDraft) => {
      if (inFlightRef.current) return;
      setError(undefined);

      if (!gateway) {
        setError(fundingErrorOfKind("unavailable"));
        return;
      }

      if (!publicKey) {
        setError(fundingErrorOfKind("not_connected"));
        return;
      }

      inFlightRef.current = true;
      setIsSubmitting(true);
      try {
        const fingerprint = draftFingerprint(publicKey, draft);
        const existing = attemptRef.current;
        let attempt: Attempt;

        if (existing && existing.fingerprint === fingerprint) {
          // Same draft: the prepared intent is reused, so a retry after a
          // declined signature costs no extra round trip.
          attempt = existing;
        } else {
          attemptRef.current = undefined;
          setPrepared(undefined);
          setResult(undefined);
          setStatus(undefined);

          let command;
          try {
            command = parsePrepareFundingIntentCommand({
              sourceAccountId: publicKey,
              destinationAccountId: draft.destinationAccountId,
              amountStroops: draft.amountStroops,
              memo: draft.memo,
              applicationId
            });
          } catch {
            setError(fundingErrorOfKind("validation"));
            return;
          }

          const preparedIntent = await gateway.prepare(command);
          attempt = { fingerprint, prepared: preparedIntent };
          attemptRef.current = attempt;
          setPrepared(preparedIntent);
        }

        let signedXdr = attempt.signedXdr;
        if (signedXdr === undefined) {
          signedXdr = await wallet.signTransaction(attempt.prepared.xdr, attempt.prepared.networkPassphrase);
          attempt.signedXdr = signedXdr;
        }

        const command = {
          signedXdr,
          intent: {
            network: attempt.prepared.network,
            networkPassphrase: attempt.prepared.networkPassphrase,
            sourceAccountId: attempt.prepared.sourceAccountId,
            sourceSequence: attempt.prepared.sourceSequence,
            destinationAccountId: attempt.prepared.destinationAccountId,
            amountStroops: attempt.prepared.amountStroops,
            memo: attempt.prepared.memo,
            expiresAt: attempt.prepared.expiresAt
          },
          applicationId: attempt.prepared.applicationId
        } satisfies SubmitFundingIntentCommand;

        const submitted = await gateway.submit(attempt.prepared.intentId, command);
        setResult(submitted);
        setStatus(submitted.intent);
      } catch (caught) {
        const mapped = toFundingSubmitError(caught);
        if (!mapped.recoverable) {
          attemptRef.current = undefined;
          setPrepared(undefined);
        } else if (mapped.kind === "xdr_rejected" && attemptRef.current) {
          // The service refused the envelope; ask for a fresh signature rather
          // than replaying the one it just rejected.
          delete attemptRef.current.signedXdr;
        }
        setError(mapped);
      } finally {
        inFlightRef.current = false;
        setIsSubmitting(false);
      }
    },
    [gateway, wallet, publicKey, applicationId]
  );

  const refreshStatus = useCallback(async () => {
    if (!gateway) {
      setError(fundingErrorOfKind("unavailable"));
      return;
    }

    const intentId = result?.intent.intentId ?? prepared?.intentId;
    if (!intentId) return;

    try {
      setStatus(await gateway.get(intentId));
    } catch (caught) {
      setError(toFundingSubmitError(caught));
    }
  }, [gateway, result, prepared]);

  return {
    publicKey,
    isConnecting,
    connect,
    submit,
    isSubmitting,
    error,
    prepared,
    result,
    status,
    refreshStatus
  };
}
