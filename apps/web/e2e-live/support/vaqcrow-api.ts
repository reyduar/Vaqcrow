import { LIVE_API_BASE_URL } from "./live-targets";

/**
 * Bearer-authenticated client for the real docker-profile API, used by the
 * admin-review live rehearsal only where the role-based UI has no control
 * for a step (the FX rate, running the advisory assessment, an investor's
 * contribution) or to read back what the UI does not render (the vault's
 * contract address and on-chain goal). Every call goes through the same
 * route policy, validation and adapters the browser would hit.
 */

export interface ApiResponse<T = unknown> {
  readonly status: number;
  readonly body: T;
}

async function call<T>(token: string, method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
  const response = await fetch(`${LIVE_API_BASE_URL}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : null;
  } catch {
    // Non-JSON bodies are kept as text for the assertion message.
  }
  return { status: response.status, body: parsed as T };
}

export interface WireRate {
  readonly version: number;
  readonly effectiveAt: string;
  readonly source: string;
  readonly usdToArs: string;
  readonly stroopsPerUsd: string;
}

/** `RATE_SCALE` of `apps/api/src/application/use-cases/campaign-guardrails.ts`, duplicated literally (e2e never imports `src/`). */
export const RATE_SCALE = 1_000_000n;

/**
 * Returns the active ARS/USD rate, creating version 1 when the table is empty.
 * A rehearsal-chosen demo rate: 1 USD = ARS 1.000 (`usdToArs` scaled by
 * `RATE_SCALE`) and 1 USD = 1 XLM on the local network (`stroopsPerUsd`).
 */
export async function ensureActiveRate(adminToken: string): Promise<{ readonly rate: WireRate; readonly created: boolean }> {
  const current = await call<{ rate?: WireRate }>(adminToken, "GET", "/admin/rates/current");
  if (current.status === 200 && current.body.rate) return { rate: current.body.rate, created: false };
  if (current.status !== 404) {
    throw new Error(`GET /admin/rates/current returned ${String(current.status)} ${JSON.stringify(current.body)}`);
  }

  const created = await call<{ rate?: WireRate }>(adminToken, "POST", "/admin/rates", {
    version: 1,
    effectiveAt: new Date(Date.now() - 60_000).toISOString(),
    source: "manual",
    usdToArs: (1000n * RATE_SCALE).toString(),
    stroopsPerUsd: "10000000"
  });
  if (created.status !== 201 || !created.body.rate) {
    throw new Error(`POST /admin/rates returned ${String(created.status)} ${JSON.stringify(created.body)}`);
  }
  return { rate: created.body.rate, created: true };
}

/** Same integer arithmetic as `goalArsToStroops` (`deploy-approved-campaign.ts`), duplicated for an independent check. */
export function expectedGoalStroops(goalArs: bigint, rate: WireRate): bigint {
  const usdToArs = BigInt(rate.usdToArs);
  const stroopsPerUsd = BigInt(rate.stroopsPerUsd);
  const goalUsdScaled = (goalArs * RATE_SCALE * RATE_SCALE) / usdToArs;
  return (goalUsdScaled * stroopsPerUsd) / RATE_SCALE;
}

export interface WireDeployment {
  readonly applicationId: string;
  readonly state: string;
  readonly attempts: number;
  readonly campaignId?: string;
  readonly lastError?: string;
  readonly retryable: boolean;
}

export function getDeployment(adminToken: string, applicationId: string): Promise<ApiResponse<{ deployment?: WireDeployment }>> {
  return call(adminToken, "GET", `/application-reviews/${applicationId}/deployment`);
}

export interface WireCampaign {
  readonly campaignId: string;
  readonly applicationId: string;
  readonly contractAddress: string;
  readonly network: string;
  readonly state: string;
  readonly goalStroops: string;
  readonly totalStroops: string;
  readonly deadline: string;
  readonly smeAccountId: string;
  readonly investorContributionStroops?: string;
}

export async function getCampaign(token: string, campaignId: string, investor?: string): Promise<WireCampaign> {
  const query = investor ? `?investor=${encodeURIComponent(investor)}` : "";
  const response = await call<{ campaign?: WireCampaign }>(token, "GET", `/campaigns/${campaignId}${query}`);
  if (response.status !== 200 || !response.body.campaign) {
    throw new Error(`GET /campaigns/${campaignId} returned ${String(response.status)} ${JSON.stringify(response.body)}`);
  }
  return response.body.campaign;
}

export interface PreparedInvocation {
  readonly xdr: string;
  readonly networkPassphrase: string;
}

/** `POST /campaigns/:id/invocations` for a contribution; resolves the raw response so a refusal can be asserted. */
export function prepareContribution(
  token: string,
  campaignId: string,
  investorAccountId: string,
  amountStroops: bigint
): Promise<ApiResponse<{ contractInvocation?: PreparedInvocation; code?: string }>> {
  return call(token, "POST", `/campaigns/${campaignId}/invocations`, {
    operation: "contribute",
    investorAccountId,
    sourceAccountId: null,
    amountStroops: amountStroops.toString()
  });
}

export function submitContribution(
  token: string,
  campaignId: string,
  investorAccountId: string,
  amountStroops: bigint,
  signedXdr: string
): Promise<ApiResponse<{ transactionHash?: string; status?: string; code?: string }>> {
  return call(token, "POST", `/campaigns/${campaignId}/invocations/submission`, {
    operation: "contribute",
    investorAccountId,
    sourceAccountId: null,
    amountStroops: amountStroops.toString(),
    signedXdr
  });
}

export function transactionStatus(
  token: string,
  campaignId: string,
  hash: string
): Promise<ApiResponse<{ status?: string }>> {
  return call(token, "GET", `/campaigns/${campaignId}/transactions/${hash}`);
}
