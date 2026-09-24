"use client";

import { parseOpenCampaignCommand, parsePrepareContractInvocationCommand } from "@vaqcrow/contracts";
import type {
  CampaignSnapshot,
  ContractOperation,
  OpenCampaignCommand,
  PrepareContractInvocationCommand,
  SubmitContractInvocationCommand
} from "@vaqcrow/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  campaignVaultErrorOfKind,
  toCampaignVaultError,
  type CampaignVaultError
} from "@/application/campaign/campaign-vault-errors";
import type { CampaignGateway } from "@/application/ports/campaign-gateway";
import type { WalletPort } from "@/application/ports/wallet-port";

/** What the open-campaign panel hands the hook; `smeAccountId` is always the connected wallet, never form input. */
export interface OpenCampaignDraft {
  readonly applicationId: string;
  readonly goalStroops: string;
  readonly deadline: string;
}

export interface UseCampaignVaultOptions {
  /** Delay between transaction-status polls; production default is 1.5s, tests pass 0. */
  readonly pollIntervalMs?: number;
  /** Bounded poll: how many times `getTransaction` is asked before giving up. */
  readonly maxPollAttempts?: number;
}

const DEFAULT_POLL_INTERVAL_MS = 1500;
const DEFAULT_MAX_POLL_ATTEMPTS = 10;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Owns one campaign vault: reading the chain-observed snapshot, opening the
 * vault, and running one contract-invocation attempt at a time (prepare →
 * Freighter sign → submit → bounded poll → refresh).
 *
 * The campaign is always read from the API, never assembled from local
 * state — the chain is the only authority for money (`D6`), and this hook
 * only orchestrates the read. `inFlightRef` is shared by `openCampaign` and
 * every invocation, the same in-flight discipline `useFundingIntent` applies
 * to `submit`, so a double click cannot fire two wallet prompts.
 */
export function useCampaignVault(
  gateway: CampaignGateway | null,
  wallet: WalletPort,
  campaignId: string | null,
  options: UseCampaignVaultOptions = {}
) {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxPollAttempts = options.maxPollAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;

  const inFlightRef = useRef(false);
  const connectingRef = useRef(false);

  const [publicKey, setPublicKey] = useState<string | undefined>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [campaign, setCampaign] = useState<CampaignSnapshot | undefined>();
  // The key of the last (campaign, viewer) pair whose snapshot arrived, so the
  // initial load state is derived instead of set synchronously in an effect.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingOperation, setPendingOperation] = useState<ContractOperation | undefined>();
  const [error, setError] = useState<CampaignVaultError | undefined>();

  const connect = useCallback(async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setIsConnecting(true);
    setError(undefined);
    try {
      const account = await wallet.connect();
      setPublicKey(account.publicKey);
    } catch (caught) {
      setError(toCampaignVaultError(caught));
    } finally {
      connectingRef.current = false;
      setIsConnecting(false);
    }
  }, [wallet]);

  const campaignKey = gateway && campaignId ? `${campaignId}|${publicKey ?? ""}` : null;

  // Explicit refresh (after a confirmed transaction): event-driven, so it may
  // flag the refresh synchronously.
  const loadCampaign = useCallback(async () => {
    if (!gateway || !campaignId) return;
    setIsRefreshing(true);
    try {
      setCampaign(await gateway.getCampaign(campaignId, publicKey));
    } catch (caught) {
      setError(toCampaignVaultError(caught));
    } finally {
      setLoadedKey(campaignKey);
      setIsRefreshing(false);
    }
  }, [gateway, campaignId, publicKey, campaignKey]);

  // Initial and viewer-change load: state is only written once the snapshot
  // (or the failure) arrives, and a stale response is dropped on cleanup.
  useEffect(() => {
    if (!gateway || !campaignId) return;
    let cancelled = false;
    gateway.getCampaign(campaignId, publicKey).then(
      (snapshot) => {
        if (cancelled) return;
        setCampaign(snapshot);
        setLoadedKey(campaignKey);
      },
      (caught: unknown) => {
        if (cancelled) return;
        setError(toCampaignVaultError(caught));
        setLoadedKey(campaignKey);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [gateway, campaignId, publicKey, campaignKey]);

  const isLoadingCampaign = (campaignKey !== null && loadedKey !== campaignKey) || isRefreshing;

  const openCampaign = useCallback(
    async (draft: OpenCampaignDraft): Promise<string | undefined> => {
      if (inFlightRef.current) return undefined;
      setError(undefined);

      if (!gateway) {
        setError(campaignVaultErrorOfKind("unavailable"));
        return undefined;
      }
      if (!publicKey) {
        setError(campaignVaultErrorOfKind("not_connected"));
        return undefined;
      }

      inFlightRef.current = true;
      setIsOpening(true);
      try {
        let command: OpenCampaignCommand;
        try {
          command = parseOpenCampaignCommand({
            applicationId: draft.applicationId,
            smeAccountId: publicKey,
            goalStroops: draft.goalStroops,
            deadline: draft.deadline
          });
        } catch {
          setError(campaignVaultErrorOfKind("validation"));
          return undefined;
        }

        const opened = await gateway.openCampaign(command);
        setCampaign(opened.campaign);
        return opened.campaign.campaignId;
      } catch (caught) {
        setError(toCampaignVaultError(caught));
        return undefined;
      } finally {
        inFlightRef.current = false;
        setIsOpening(false);
      }
    },
    [gateway, publicKey]
  );

  const pollTransaction = useCallback(
    async (id: string, transactionHash: string) => {
      if (!gateway) return;
      for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
        const status = await gateway.getTransaction(id, transactionHash);

        if (status.status === "success") {
          if (status.campaign) setCampaign(status.campaign);
          else await loadCampaign();
          return;
        }

        if (status.status === "failed") {
          setError(campaignVaultErrorOfKind("refused"));
          return;
        }

        if (attempt < maxPollAttempts - 1) await delay(pollIntervalMs);
      }
      // Bounded poll exhausted: the transaction may still settle later, but
      // this attempt reports it rather than waiting forever.
      setError(campaignVaultErrorOfKind("unavailable"));
    },
    [gateway, maxPollAttempts, pollIntervalMs, loadCampaign]
  );

  const runInvocation = useCallback(
    async (
      operation: ContractOperation,
      facts: { investorAccountId: string; sourceAccountId: string | null; amountStroops: string | null }
    ) => {
      if (inFlightRef.current) return;
      setError(undefined);

      if (!gateway || !campaignId) {
        setError(campaignVaultErrorOfKind("unavailable"));
        return;
      }
      if (!publicKey) {
        setError(campaignVaultErrorOfKind("not_connected"));
        return;
      }

      inFlightRef.current = true;
      setIsSubmitting(true);
      setPendingOperation(operation);
      try {
        let command: PrepareContractInvocationCommand;
        try {
          command = parsePrepareContractInvocationCommand({
            operation,
            investorAccountId: facts.investorAccountId,
            sourceAccountId: facts.sourceAccountId,
            amountStroops: facts.amountStroops
          });
        } catch {
          setError(campaignVaultErrorOfKind("validation"));
          return;
        }

        const invocation = await gateway.prepareInvocation(campaignId, command);
        const signedXdr = await wallet.signTransaction(invocation.xdr, invocation.networkPassphrase);

        const submitCommand = { ...command, signedXdr } satisfies SubmitContractInvocationCommand;
        const submission = await gateway.submitInvocation(campaignId, submitCommand);

        await pollTransaction(campaignId, submission.transactionHash);
      } catch (caught) {
        setError(toCampaignVaultError(caught));
      } finally {
        inFlightRef.current = false;
        setIsSubmitting(false);
        setPendingOperation(undefined);
      }
    },
    [gateway, wallet, campaignId, publicKey, pollTransaction]
  );

  const contribute = useCallback(
    (amountStroops: string) =>
      runInvocation("contribute", { investorAccountId: publicKey ?? "", sourceAccountId: null, amountStroops }),
    [publicKey, runInvocation]
  );

  const withdraw = useCallback(
    () => runInvocation("withdraw", { investorAccountId: publicKey ?? "", sourceAccountId: null, amountStroops: null }),
    [publicKey, runInvocation]
  );

  /**
   * Triggers a refund. `investorAccountId` is whose contribution comes back
   * — the connected wallet's own address by default, or another investor's
   * registered address, permissionlessly (`D7`/acceptance criteria). The
   * connected wallet always signs as `sourceAccountId`: it pays the fee and
   * triggers the call, but the payout destination stays whatever the
   * contract has on record for `investorAccountId` — triggering a refund can
   * never redirect where the funds land.
   */
  const refund = useCallback(
    (targetInvestorAccountId?: string) => {
      const trimmed = targetInvestorAccountId?.trim();
      return runInvocation("refund", {
        investorAccountId: trimmed || (publicKey ?? ""),
        sourceAccountId: publicKey ?? null,
        amountStroops: null
      });
    },
    [publicKey, runInvocation]
  );

  return {
    publicKey,
    isConnecting,
    connect,
    campaign,
    isLoadingCampaign,
    loadCampaign,
    openCampaign,
    isOpening,
    contribute,
    withdraw,
    refund,
    isSubmitting,
    pendingOperation,
    error
  };
}
