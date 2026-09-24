import { LIVE_API_BASE_URL } from "./live-targets";

/**
 * Minimal, typed client for the parts of the real `/campaigns` HTTP surface
 * (`apps/api/src/infrastructure/http/routes/campaign.route.ts`) this suite's
 * own setup needs directly, outside the browser.
 *
 * Only scenario `d` (refund) uses `openCampaignDirect`: the "Abrir bóveda"
 * form's `<input type="date">` (`campaign-workspace.tsx`'s `toIsoDeadline`)
 * can only ever declare a deadline at UTC midnight on some date — it has no
 * way to express "~20–30 seconds from now", which that scenario needs to
 * keep the live run fast. Scenarios `a`–`c` open their vault through the
 * real page instead (`support/freighter-live-emulator.ts` + the workspace's
 * own "Abrir bóveda" button), the same way the PR-gated
 * `apps/web/e2e/campaign-vault.spec.ts` itself only drives the open-vault
 * *panel* for its own opening tests and pre-seeds the refund fixture
 * directly for its own refund test.
 */

export interface OpenedCampaign {
  readonly campaignId: string;
  readonly state: string;
  readonly contractAddress: string;
  readonly smeAccountId: string;
  readonly goalStroops: string;
  readonly totalStroops: string;
  readonly deadline: string;
}

interface OpenCampaignResponseBody {
  readonly campaign: OpenedCampaign;
}

export async function openCampaignDirect(input: {
  readonly applicationId: string;
  readonly smeAccountId: string;
  readonly goalStroops: bigint;
  readonly deadlineIso: string;
}): Promise<OpenedCampaign> {
  const response = await fetch(`${LIVE_API_BASE_URL}/campaigns`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      applicationId: input.applicationId,
      smeAccountId: input.smeAccountId,
      goalStroops: input.goalStroops.toString(),
      deadline: input.deadlineIso
    })
  });

  if (!response.ok) {
    throw new Error(`POST /campaigns failed: ${String(response.status)} ${await response.text()}`);
  }

  const body = (await response.json()) as OpenCampaignResponseBody;
  return body.campaign;
}

/** Reads the chain-observed snapshot directly, the same GET the web's `useCampaignVault` polls — used here only to read back `smeAccountId` (never rendered in the DOM, `campaign-workspace.tsx`'s `<dl>` has no row for it). */
export async function getCampaign(campaignId: string): Promise<OpenedCampaign> {
  const response = await fetch(`${LIVE_API_BASE_URL}/campaigns/${campaignId}`);
  if (!response.ok) {
    throw new Error(`GET /campaigns/${campaignId} failed: ${String(response.status)} ${await response.text()}`);
  }
  const body = (await response.json()) as OpenCampaignResponseBody;
  return body.campaign;
}
