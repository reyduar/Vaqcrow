import {
  parseCampaignSnapshot,
  parseContractInvocation,
  parseContractInvocationSubmission,
  parseContractInvocationTransactionStatus
} from "@vaqcrow/contracts";
import type {
  CampaignSnapshot,
  ContractInvocation,
  ContractInvocationSubmission,
  ContractInvocationTransactionStatus,
  OpenCampaignCommand,
  PrepareContractInvocationCommand,
  SubmitContractInvocationCommand
} from "@vaqcrow/contracts";
import type { HttpClientPort } from "@/application/ports/http-client-port";
import type { CampaignGateway, OpenedCampaign } from "@/application/ports/campaign-gateway";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The `{ campaign }` envelope `openCampaign`, `getCampaign` and a succeeded `getTransaction` all carry. */
function unwrapCampaign(body: unknown): unknown {
  if (!isPlainObject(body) || !("campaign" in body)) throw new TypeError("Invalid campaign envelope");
  const { campaign, ...extra } = body;
  if (Object.keys(extra).length > 0) throw new TypeError("Invalid campaign envelope");
  return campaign;
}

/** The `{ contractInvocation }` envelope `prepareInvocation` answers with. */
function unwrapInvocation(body: unknown): unknown {
  if (!isPlainObject(body) || !("contractInvocation" in body)) {
    throw new TypeError("Invalid contract invocation envelope");
  }
  const { contractInvocation, ...extra } = body;
  if (Object.keys(extra).length > 0) throw new TypeError("Invalid contract invocation envelope");
  return contractInvocation;
}

/** Encodes the fields shared by prepare and submit for the wire; money as a decimal string, `null` stays `null`. */
function toWireInvocationFacts(command: PrepareContractInvocationCommand): Record<string, unknown> {
  return {
    operation: command.operation,
    investorAccountId: command.investorAccountId,
    sourceAccountId: command.sourceAccountId,
    amountStroops: command.amountStroops === null ? null : command.amountStroops.toString()
  };
}

/**
 * `POST /campaigns` (201 first open / 200 replay), `GET /campaigns/:id`
 * (chain-reconciled snapshot), `POST /campaigns/:id/invocations` (prepare),
 * `POST /campaigns/:id/invocations/submission` (submit) and
 * `GET /campaigns/:id/transactions/:hash` (poll).
 *
 * Every response is parsed through the `@vaqcrow/contracts` schemas, so an
 * envelope that drifted from the contract is a thrown `TypeError` rather than
 * a half-trusted object — the same discipline `HttpFundingIntentGateway`
 * applies.
 */
export class HttpCampaignGateway implements CampaignGateway {
  constructor(private readonly http: HttpClientPort) {}

  async openCampaign(command: OpenCampaignCommand): Promise<OpenedCampaign> {
    const response = await this.http.send<unknown>({
      method: "POST",
      path: "/campaigns",
      body: {
        applicationId: command.applicationId,
        smeAccountId: command.smeAccountId,
        goalStroops: command.goalStroops.toString(),
        deadline: command.deadline
      }
    });

    return {
      // 201: a campaign was just opened. 200: an exact replay of an already-open vault.
      applied: response.status === 201,
      campaign: parseCampaignSnapshot(unwrapCampaign(response.body))
    };
  }

  async getCampaign(campaignId: string, investorAccountId?: string): Promise<CampaignSnapshot> {
    const query = investorAccountId === undefined ? "" : `?investor=${encodeURIComponent(investorAccountId)}`;
    const response = await this.http.send<unknown>({
      method: "GET",
      path: `/campaigns/${encodeURIComponent(campaignId)}${query}`
    });

    return parseCampaignSnapshot(unwrapCampaign(response.body));
  }

  async prepareInvocation(
    campaignId: string,
    command: PrepareContractInvocationCommand
  ): Promise<ContractInvocation> {
    const response = await this.http.send<unknown>({
      method: "POST",
      path: `/campaigns/${encodeURIComponent(campaignId)}/invocations`,
      body: toWireInvocationFacts(command)
    });

    return parseContractInvocation(unwrapInvocation(response.body));
  }

  async submitInvocation(
    campaignId: string,
    command: SubmitContractInvocationCommand
  ): Promise<ContractInvocationSubmission> {
    const response = await this.http.send<unknown>({
      method: "POST",
      path: `/campaigns/${encodeURIComponent(campaignId)}/invocations/submission`,
      body: { ...toWireInvocationFacts(command), signedXdr: command.signedXdr }
    });

    return parseContractInvocationSubmission(response.body);
  }

  async getTransaction(campaignId: string, transactionHash: string): Promise<ContractInvocationTransactionStatus> {
    const response = await this.http.send<unknown>({
      method: "GET",
      path: `/campaigns/${encodeURIComponent(campaignId)}/transactions/${encodeURIComponent(transactionHash)}`
    });

    return parseContractInvocationTransactionStatus(response.body);
  }
}
