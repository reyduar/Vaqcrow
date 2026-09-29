"use client";

import { useEffect, useState } from "react";
import {
  buildEvidenceTimeline,
  type EvidenceSource,
  type EvidenceSources
} from "@/application/evidence/evidence-timeline";
import { DEMO_APPLICATION_ID } from "@/application/fixtures/demo-application";
import type { CampaignGateway } from "@/application/ports/campaign-gateway";
import type { HumanDecisionGateway } from "@/application/ports/human-decision-gateway";
import type { RevenueShareDistributionGateway } from "@/application/ports/revenue-share-distribution-gateway";
import { createCampaignGateway } from "@/infrastructure/campaign/default-gateway";
import { HttpHumanDecisionGateway } from "@/infrastructure/decision/http-human-decision-gateway";
import { HttpRevenueShareDistributionGateway } from "@/infrastructure/distribution/http-revenue-share-distribution-gateway";
import { AxiosHttpClient } from "@/infrastructure/http/axios-http-client";
import type {
  CampaignSnapshot,
  HumanDecisionRecord,
  RevenueShareDistributionId,
  RevenueShareDistributionSnapshot
} from "@vaqcrow/contracts";
import { EvidenceTimeline } from "./evidence-timeline";

/**
 * The demo's env-configured gateways, held at module scope so they stay stable
 * across renders. `null` when no backend is configured: every read is then
 * "unavailable" — a declared inability to read, never an invented absence.
 */
function createHumanDecisionGateway(): HumanDecisionGateway | null {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return null;
  return new HttpHumanDecisionGateway(AxiosHttpClient.create({ baseUrl }));
}

function createDistributionGateway(): RevenueShareDistributionGateway | null {
  const baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"]?.trim();
  if (!baseUrl) return null;
  return new HttpRevenueShareDistributionGateway(AxiosHttpClient.create({ baseUrl }));
}

const defaultHumanDecisionGateway = createHumanDecisionGateway();
const defaultCampaignGateway = createCampaignGateway(process.env["NEXT_PUBLIC_API_BASE_URL"]);
const defaultDistributionGateway = createDistributionGateway();

export interface EvidenceWorkspaceProps {
  /** The campaign id the page read from `?campaign=`; absent means it was not run in this session. */
  readonly campaignId?: string | null;
  /** The distribution id the page read from `?distribution=`; absent means it was not run in this session. */
  readonly distributionId?: string | null;
  /** Injectable for tests; `undefined` uses the env-configured gateway, `null` forces "cannot read". */
  readonly humanDecisionGateway?: HumanDecisionGateway | null;
  readonly campaignGateway?: CampaignGateway | null;
  readonly distributionGateway?: RevenueShareDistributionGateway | null;
}

/**
 * Evidence step container (Feature #29 / Task #92, T92-04). Reads the three
 * persisted sources the dashboard correlates — the latest human decision, the
 * campaign vault named in the URL, the distribution named in the URL — and
 * projects them through the pure `buildEvidenceTimeline` before rendering.
 *
 * A missing base URL, a missing id or a rejected read is data, never an
 * exception: every failure becomes an `unavailable`/`absent` source so nothing
 * breaks the render, and an observed source is the only thing that yields
 * facts, hashes or a calculation. Nothing here signs, submits or moves money.
 */
export function EvidenceWorkspace({
  campaignId = null,
  distributionId = null,
  humanDecisionGateway = defaultHumanDecisionGateway,
  campaignGateway = defaultCampaignGateway,
  distributionGateway = defaultDistributionGateway
}: EvidenceWorkspaceProps) {
  const [sources, setSources] = useState<EvidenceSources | undefined>();

  useEffect(() => {
    let cancelled = false;

    const readDecision = async (): Promise<EvidenceSource<HumanDecisionRecord>> => {
      if (!humanDecisionGateway) return { kind: "unavailable" };
      try {
        const value = await humanDecisionGateway.readLatest(DEMO_APPLICATION_ID);
        // `null` is the API's truthful `not_found`: no decision recorded yet.
        return value === null ? { kind: "absent" } : { kind: "observed", value };
      } catch {
        // A broken or unreachable backend is never an absence.
        return { kind: "unavailable" };
      }
    };

    const readCampaign = async (): Promise<EvidenceSource<CampaignSnapshot>> => {
      if (!campaignId) return { kind: "absent" };
      if (!campaignGateway) return { kind: "unavailable" };
      try {
        return { kind: "observed", value: await campaignGateway.getCampaign(campaignId) };
      } catch {
        return { kind: "unavailable" };
      }
    };

    const readDistribution = async (): Promise<EvidenceSource<RevenueShareDistributionSnapshot>> => {
      if (!distributionId) return { kind: "absent" };
      if (!distributionGateway) return { kind: "unavailable" };
      try {
        const result = await distributionGateway.getStatus(
          distributionId as RevenueShareDistributionId
        );
        if (result.ok) return { kind: "observed", value: result.value };
        // The API's `not_found` is a declared absence; every other failure kind
        // is "could not read", never an empty success.
        return result.error.kind === "not_found" ? { kind: "absent" } : { kind: "unavailable" };
      } catch {
        return { kind: "unavailable" };
      }
    };

    void (async () => {
      const [decision, campaign, distribution] = await Promise.all([
        readDecision(),
        readCampaign(),
        readDistribution()
      ]);
      if (cancelled) return;
      setSources({ applicationId: DEMO_APPLICATION_ID, decision, campaign, distribution });
    })();

    return () => {
      cancelled = true;
    };
  }, [campaignId, distributionId, humanDecisionGateway, campaignGateway, distributionGateway]);

  if (!sources) {
    return (
      <p aria-live="polite" lang="es" className="text-sm">
        Cargando la evidencia…
      </p>
    );
  }

  return <EvidenceTimeline entries={buildEvidenceTimeline(sources)} />;
}
