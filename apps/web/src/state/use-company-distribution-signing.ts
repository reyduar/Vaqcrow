"use client";

import { useCallback, useRef, useState } from "react";
import {
  distributionSigningFailureOfError,
  distributionSigningFailureOfKind,
  toDistributionSigningFailure,
  type DistributionSigningFailure
} from "@/application/company/distribution-signing";
import type { MyCampaign } from "@/application/ports/my-campaigns-port";
import type { RevenueShareDistributionGateway } from "@/application/ports/revenue-share-distribution-gateway";
import type { WalletConnectionPort } from "@/application/ports/wallet-connection-port";
import type { WalletPort } from "@/application/ports/wallet-port";
import type {
  PreparedRevenueShareDistribution,
  RevenueShareDistributionSnapshot
} from "@vaqcrow/contracts";

/**
 * Owns the PyME dashboard's «Revisar y firmar» attempt (Feature #434, WU4):
 * resolve the persisted SME account, prepare the distribution, sign it in
 * Freighter, submit it, and read its status back. It reuses the shipped
 * `RevenueShareDistributionGateway` port and the same signed → sent → confirmed
 * discipline the retired journey's distribution step applied — `submitted` never renders as
 * confirmed.
 *
 * The source account is the wallet the PyME linked during onboarding
 * (`WalletConnectionPort`), not a fresh `wallet.connect()`: the API derives the
 * distribution only for the campaign's own SME account, so a different account
 * could never sign it. The passphrase always comes from the prepared response,
 * never a constant this hook owns (`D1`), and the application identity is
 * supplied by the caller (the dashboard resolves it for the campaign).
 *
 * Nothing is thrown to the component: every failure is a sanitized value, and a
 * double submit is refused by an in-flight guard. A role or ownership mismatch
 * is refused by `prepare` before `wallet.signTransaction` is ever called.
 */

export interface UseCompanyDistributionSigningOptions {
  /** The shipped distribution port; `null` fails closed to `unavailable`. */
  readonly gateway: RevenueShareDistributionGateway | null;
  /** Signs the prepared envelope in Freighter. */
  readonly wallet: WalletPort;
  /** The persisted SME account; `null` fails closed to `not_connected`. */
  readonly connection: WalletConnectionPort | null;
  /** The campaign's application identity; `null` fails closed to `identity_unavailable`. */
  readonly applicationId: string | null;
  /** Called once after a successful submit so the dashboard reloads. */
  readonly onSigned?: () => void;
}

export interface CompanyDistributionSigning {
  readonly publicKey: string | undefined;
  readonly isPreparing: boolean;
  readonly isSubmitting: boolean;
  readonly prepared: PreparedRevenueShareDistribution | undefined;
  readonly snapshot: RevenueShareDistributionSnapshot | undefined;
  readonly applied: boolean | undefined;
  readonly isReviewOpen: boolean;
  readonly reviewAttempted: boolean;
  readonly failure: DistributionSigningFailure | undefined;
  readonly start: (campaign: MyCampaign) => Promise<void>;
  readonly sign: () => Promise<void>;
  readonly refreshStatus: () => Promise<void>;
  readonly closeReview: () => void;
}

export function useCompanyDistributionSigning({
  gateway,
  wallet,
  connection,
  applicationId,
  onSigned
}: UseCompanyDistributionSigningOptions): CompanyDistributionSigning {
  const inFlightRef = useRef(false);
  const [publicKey, setPublicKey] = useState<string | undefined>();
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prepared, setPrepared] = useState<PreparedRevenueShareDistribution | undefined>();
  const [snapshot, setSnapshot] = useState<RevenueShareDistributionSnapshot | undefined>();
  const [applied, setApplied] = useState<boolean | undefined>();
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewAttempted, setReviewAttempted] = useState(false);
  const [failure, setFailure] = useState<DistributionSigningFailure | undefined>();

  const start = useCallback(
    async (campaign: MyCampaign) => {
      if (inFlightRef.current) return;
      setFailure(undefined);
      setReviewAttempted(false);

      if (!gateway) {
        setFailure(distributionSigningFailureOfKind("unavailable"));
        return;
      }
      if (applicationId === null) {
        setFailure(distributionSigningFailureOfKind("identity_unavailable"));
        return;
      }
      if (!connection) {
        setFailure(distributionSigningFailureOfKind("not_connected"));
        return;
      }

      inFlightRef.current = true;
      setIsPreparing(true);
      try {
        const state = await connection.getConnection();
        if (!state.ok || state.publicKey === null) {
          setFailure(distributionSigningFailureOfKind("not_connected"));
          return;
        }
        setPublicKey(state.publicKey);

        // Who is paid and how much is derived by the service from the campaign
        // and the SME's sales; the web declares only the case.
        const result = await gateway.prepare({
          sourceAccountId: state.publicKey,
          applicationId,
          campaignId: campaign.campaignId,
          memo: null
        });

        if (result.ok) {
          setPrepared(result.value);
          setSnapshot(undefined);
          setApplied(undefined);
          setIsReviewOpen(true);
        } else {
          setFailure(distributionSigningFailureOfError(result.error));
        }
      } catch (caught) {
        setFailure(toDistributionSigningFailure(caught));
      } finally {
        inFlightRef.current = false;
        setIsPreparing(false);
      }
    },
    [gateway, connection, applicationId]
  );

  const sign = useCallback(async () => {
    if (!prepared) return;
    setReviewAttempted(true);

    if (!gateway) {
      setFailure(distributionSigningFailureOfKind("unavailable"));
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
        onSigned?.();
      } else {
        setFailure(distributionSigningFailureOfError(result.error));
      }
    } catch (caught) {
      setFailure(toDistributionSigningFailure(caught));
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  }, [gateway, wallet, prepared, onSigned]);

  const refreshStatus = useCallback(async () => {
    if (!gateway || !snapshot) return;
    setFailure(undefined);
    const result = await gateway.getStatus(snapshot.distributionId);
    if (result.ok) setSnapshot(result.value);
    else setFailure(distributionSigningFailureOfError(result.error));
  }, [gateway, snapshot]);

  const closeReview = useCallback(() => {
    setIsReviewOpen(false);
    setReviewAttempted(false);
    setFailure(undefined);
  }, []);

  return {
    publicKey,
    isPreparing,
    isSubmitting,
    prepared,
    snapshot,
    applied,
    isReviewOpen,
    reviewAttempted,
    failure,
    start,
    sign,
    refreshStatus,
    closeReview
  };
}
