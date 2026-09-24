import {
  parseCorrelationId,
  parseOpenCampaignCommand,
  parsePrepareContractInvocationCommand,
  parseStellarAccountId,
  parseSubmitContractInvocationCommand
} from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import type { ApplicationReviewRepositoryPort } from "../../../application/ports/application-review-repository-port.js";
import type { CampaignFactoryPort } from "../../../application/ports/campaign-factory-port.js";
import { toChainCampaignSnapshot } from "../../../application/ports/campaign-vault-chain-port.js";
import type {
  CampaignVaultChainPort,
  VaultChainStateName
} from "../../../application/ports/campaign-vault-chain-port.js";
import type { CampaignVaultInvocationPort } from "../../../application/ports/campaign-vault-invocation-port.js";
import type {
  CampaignContributionRecord,
  CampaignRecord,
  CampaignRepositoryPort,
  CampaignState,
  ReconciliationStatus
} from "../../../application/ports/campaign-repository-port.js";
import type { StellarAccountPort } from "../../../application/ports/stellar-account-port.js";
import { openCampaign } from "../../../application/use-cases/open-campaign.js";
import { reconcileCampaign } from "../../../application/use-cases/reconcile-campaign.js";

/**
 * The HTTP surface of the campaign vault journey: open it after approval,
 * read its chain-observed state, prepare and submit the signed invocations
 * that call it, and poll a submitted invocation's own transaction.
 *
 * The route owns exactly what `funding-intent.route.ts` owns for the classic
 * flow: the exact body key set, the status-code mapping, and the wire
 * encoding of money — a stroop amount is a `bigint` in the application and a
 * decimal string on the wire. The chain is the only authority for money
 * (`D6`): every read here reconciles the mirror from a fresh chain read
 * before answering, and a chain that cannot be reached is reported as
 * `503`, never silently answered from the mirror.
 *
 * The one rule every invocation handler enforces (see
 * `odd/tasks/campaign-vault-web-journey.md`, U3 note): `contribute` and
 * `withdraw` always carry `sourceAccountId === investorAccountId` — the
 * investor always signs their own money — while `refund` is permissionless
 * and either forwards the caller's declared source or omits it entirely, so
 * any self-signed source is accepted.
 */

const OPEN_BODY_KEYS = new Set(["applicationId", "smeAccountId", "goalStroops", "deadline"]);

const INVOCATION_PREPARE_BODY_KEYS = new Set([
  "operation",
  "investorAccountId",
  "sourceAccountId",
  "amountStroops"
]);

const INVOCATION_SUBMISSION_BODY_KEYS = new Set([
  "operation",
  "investorAccountId",
  "sourceAccountId",
  "amountStroops",
  "signedXdr"
]);

export interface CampaignRouteDependencies {
  readonly applicationReviews: ApplicationReviewRepositoryPort;
  readonly campaigns: CampaignRepositoryPort;
  readonly accounts: StellarAccountPort;
  readonly factory: CampaignFactoryPort;
  readonly chain: CampaignVaultChainPort;
  readonly invocations: CampaignVaultInvocationPort;
  readonly network: string;
  readonly networkPassphrase: string;
  /** The vault's payment asset (native XLM SAC in this demo). Config-level, not per-application. */
  readonly tokenContractId: string;
  /**
   * The base a contract link is built from, without a trailing slash.
   * `undefined` exactly when `StellarConfig.explorerUrl` is (the `local`
   * network has no canonical explorer) — the response simply omits
   * `explorerUrl` rather than link to the wrong network.
   */
  readonly explorerBaseUrl?: string | undefined;
  /** Injected for the same reason `FundingIntentRouteDependencies.generateIntentId` is: deterministic in tests, `crypto.randomUUID` in production. */
  readonly generateInvocationId: () => string;
}

function hasExactBodyKeys(
  input: unknown,
  allowed: ReadonlySet<string>
): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }

  const keys = Object.keys(input);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

/** The mirror's own vocabulary, translated back to the contract's — the inverse of `mapVaultStateToCampaignState`. */
function toContractStateName(state: CampaignState): VaultChainStateName {
  switch (state) {
    case "open":
      return "funding";
    case "settled":
      return "settled";
    case "refundable":
      return "refunding";
  }
}

interface CampaignSnapshotWireInput {
  readonly campaignId: string;
  readonly applicationId: string;
  readonly contractAddress: string;
  readonly network: string;
  readonly state: VaultChainStateName;
  readonly goalStroops: bigint;
  readonly totalStroops: bigint;
  readonly deadline: string;
  readonly smeAccountId: string;
  readonly investorContributionStroops?: bigint | undefined;
  readonly reconciliationStatus: ReconciliationStatus;
  readonly explorerUrl?: string | undefined;
}

/** Encodes a chain-observed snapshot for the wire, matching `campaignSnapshotSchema`: money as decimal strings, an omitted key rather than `undefined`. */
function toCampaignSnapshotWire(value: CampaignSnapshotWireInput): Record<string, unknown> {
  return {
    campaignId: value.campaignId,
    applicationId: value.applicationId,
    contractAddress: value.contractAddress,
    network: value.network,
    state: value.state,
    goalStroops: value.goalStroops.toString(),
    totalStroops: value.totalStroops.toString(),
    deadline: value.deadline,
    smeAccountId: value.smeAccountId,
    ...(value.investorContributionStroops === undefined
      ? {}
      : { investorContributionStroops: value.investorContributionStroops.toString() }),
    reconciliationStatus: value.reconciliationStatus,
    ...(value.explorerUrl === undefined ? {} : { explorerUrl: value.explorerUrl })
  };
}

/** What `openCampaign` just created or replayed, encoded the same way a chain-read snapshot is. */
function toOpenedCampaignWire(record: CampaignRecord): Record<string, unknown> {
  return toCampaignSnapshotWire({
    campaignId: record.campaignId,
    applicationId: record.applicationId,
    contractAddress: record.contractAddress,
    network: record.network,
    state: toContractStateName(record.state),
    goalStroops: record.goalStroops,
    totalStroops: record.totalStroops,
    deadline: record.deadline,
    smeAccountId: record.smeAccountId,
    reconciliationStatus: record.reconciliationStatus
  });
}

function explorerUrlFor(dependencies: CampaignRouteDependencies, contractAddress: string): string | undefined {
  return dependencies.explorerBaseUrl === undefined
    ? undefined
    : `${dependencies.explorerBaseUrl}/contract/${contractAddress}`;
}

export function registerCampaignRoute(app: FastifyInstance, dependencies: CampaignRouteDependencies): void {
  app.post<{ Body: unknown }>("/campaigns", async (request, reply) => {
    if (!hasExactBodyKeys(request.body, OPEN_BODY_KEYS)) {
      return reply.code(400).send({ code: "invalid_request" });
    }

    let command;
    try {
      command = parseOpenCampaignCommand({
        applicationId: request.body["applicationId"],
        smeAccountId: request.body["smeAccountId"],
        goalStroops: request.body["goalStroops"],
        deadline: request.body["deadline"]
      });
    } catch {
      return reply.code(400).send({ code: "invalid_request" });
    }

    const result = await openCampaign(
      {
        applicationReviews: dependencies.applicationReviews,
        campaigns: dependencies.campaigns,
        accounts: dependencies.accounts,
        factory: dependencies.factory,
        chain: dependencies.chain,
        network: dependencies.network,
        tokenContractId: dependencies.tokenContractId
      },
      {
        command: {
          applicationId: command.applicationId,
          smeAccountId: command.smeAccountId,
          goalStroops: command.goalStroops,
          deadline: new Date(command.deadline)
        },
        correlationId: parseCorrelationId(request.id)
      }
    );

    if (result.ok) {
      // 201, not 200: the campaign is a resource just created, unlike a
      // funding intent's stateless prepare step. A replay reports 200 since
      // nothing new was created that time.
      return reply.code(result.value.applied ? 201 : 200).send({ campaign: toOpenedCampaignWire(result.value.campaign) });
    }

    switch (result.error.code) {
      case "application_not_found":
        return reply.code(404).send({ code: "application_not_found" });
      case "application_not_approved":
        return reply.code(409).send({ code: "application_not_approved" });
      case "sme_account_unavailable":
        return reply.code(422).send({ code: "sme_account_unavailable" });
      case "vault_state_mismatch":
        return reply.code(422).send({ code: "vault_state_mismatch" });
      case "unavailable":
        return reply.code(503).send({ code: "unavailable" });
    }
  });

  app.get<{ Params: { campaignId: string }; Querystring: { investor?: string } }>(
    "/campaigns/:campaignId",
    async (request, reply) => {
      const mirror = await dependencies.campaigns.findById(request.params.campaignId);

      if (!mirror.ok) {
        return mirror.error.code === "not_found"
          ? reply.code(404).send({ code: "not_found" })
          : reply.code(503).send({ code: "unavailable" });
      }

      let investorAccountId: string | undefined;

      if (request.query.investor !== undefined) {
        try {
          investorAccountId = parseStellarAccountId(request.query.investor);
        } catch {
          return reply.code(400).send({ code: "invalid_request" });
        }
      }

      const chainState = await dependencies.chain.readCampaign(mirror.value.contractAddress);

      if (!chainState.ok) {
        // Never serve the mirror as if it were chain truth (D6).
        return reply.code(503).send({ code: "unavailable" });
      }

      let investorContributionStroops: bigint | undefined;
      const contributions: Omit<CampaignContributionRecord, "campaignId">[] = [];

      if (investorAccountId !== undefined) {
        const contribution = await dependencies.chain.readContribution(mirror.value.contractAddress, investorAccountId);

        if (!contribution.ok) {
          return reply.code(503).send({ code: "unavailable" });
        }

        investorContributionStroops = contribution.value;
        contributions.push({
          investorAccountId,
          amountStroops: contribution.value,
          lastObservedAt: chainState.value.observedAt.toISOString()
        });
      }

      const reconciled = await reconcileCampaign(dependencies.campaigns, {
        campaignId: mirror.value.campaignId,
        snapshot: toChainCampaignSnapshot(chainState.value, contributions),
        correlationId: parseCorrelationId(request.id)
      });

      if (!reconciled.ok) {
        return reply.code(503).send({ code: "unavailable" });
      }

      return reply.code(200).send({
        campaign: toCampaignSnapshotWire({
          campaignId: reconciled.value.campaign.campaignId,
          applicationId: reconciled.value.campaign.applicationId,
          contractAddress: reconciled.value.campaign.contractAddress,
          network: reconciled.value.campaign.network,
          state: chainState.value.state,
          goalStroops: chainState.value.goalStroops,
          totalStroops: chainState.value.totalStroops,
          deadline: reconciled.value.campaign.deadline,
          smeAccountId: reconciled.value.campaign.smeAccountId,
          investorContributionStroops,
          reconciliationStatus: reconciled.value.campaign.reconciliationStatus,
          explorerUrl: explorerUrlFor(dependencies, reconciled.value.campaign.contractAddress)
        })
      });
    }
  );

  app.post<{ Params: { campaignId: string }; Body: unknown }>(
    "/campaigns/:campaignId/invocations",
    async (request, reply) => {
      if (!hasExactBodyKeys(request.body, INVOCATION_PREPARE_BODY_KEYS)) {
        return reply.code(400).send({ code: "invalid_request" });
      }

      let command;
      try {
        command = parsePrepareContractInvocationCommand({
          operation: request.body["operation"],
          investorAccountId: request.body["investorAccountId"],
          sourceAccountId: request.body["sourceAccountId"],
          amountStroops: request.body["amountStroops"]
        });
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      const mirror = await dependencies.campaigns.findById(request.params.campaignId);

      if (!mirror.ok) {
        return mirror.error.code === "not_found"
          ? reply.code(404).send({ code: "not_found" })
          : reply.code(503).send({ code: "unavailable" });
      }

      if (command.operation === "contribute") {
        const chainState = await dependencies.chain.readCampaign(mirror.value.contractAddress);

        if (!chainState.ok) {
          return reply.code(503).send({ code: "unavailable" });
        }

        // The UI stops offering contributions once the vault leaves `funding`,
        // but the chain is the final authority: a contribution attempted
        // against a settled or refunding vault is refused here too.
        if (chainState.value.state !== "funding") {
          return reply.code(409).send({ code: "campaign_not_funding" });
        }
      }

      // `contribute`/`withdraw` always sign as the investor; `refund` forwards
      // the caller's declared source, or the investor when none was given.
      const sourceAccountId =
        command.operation === "refund"
          ? (command.sourceAccountId ?? command.investorAccountId)
          : command.investorAccountId;

      const prepared = await dependencies.invocations.prepare({
        contractAddress: mirror.value.contractAddress,
        operation: command.operation,
        sourceAccountId,
        investorAccountId: command.investorAccountId,
        ...(command.amountStroops === null ? {} : { amountStroops: command.amountStroops })
      });

      if (!prepared.ok) {
        return prepared.error.code === "invalid_input"
          ? reply.code(400).send({ code: "invalid_request" })
          : reply.code(503).send({ code: "unavailable" });
      }

      return reply.code(200).send({
        contractInvocation: {
          invocationId: dependencies.generateInvocationId(),
          operation: command.operation,
          xdr: prepared.value.xdr,
          networkPassphrase: prepared.value.networkPassphrase,
          expiresAt: prepared.value.expiresAt
        }
      });
    }
  );

  app.post<{ Params: { campaignId: string }; Body: unknown }>(
    "/campaigns/:campaignId/invocations/submission",
    async (request, reply) => {
      if (!hasExactBodyKeys(request.body, INVOCATION_SUBMISSION_BODY_KEYS)) {
        return reply.code(400).send({ code: "invalid_request" });
      }

      let command;
      try {
        command = parseSubmitContractInvocationCommand({
          operation: request.body["operation"],
          investorAccountId: request.body["investorAccountId"],
          sourceAccountId: request.body["sourceAccountId"],
          amountStroops: request.body["amountStroops"],
          signedXdr: request.body["signedXdr"]
        });
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      const mirror = await dependencies.campaigns.findById(request.params.campaignId);

      if (!mirror.ok) {
        return mirror.error.code === "not_found"
          ? reply.code(404).send({ code: "not_found" })
          : reply.code(503).send({ code: "unavailable" });
      }

      // Contribute/withdraw always re-verify against the investor's own
      // account; refund omits `sourceAccountId` entirely so any self-signed
      // source is accepted (the contract itself is permissionless about it).
      const verification = dependencies.invocations.verify({
        signedXdr: command.signedXdr,
        networkPassphrase: dependencies.networkPassphrase,
        contractAddress: mirror.value.contractAddress,
        operation: command.operation,
        investorAccountId: command.investorAccountId,
        ...(command.amountStroops === null ? {} : { amountStroops: command.amountStroops }),
        ...(command.operation === "refund" ? {} : { sourceAccountId: command.investorAccountId })
      });

      if (!verification.ok) {
        // Only the refusal's own code is returned, never its `reason` — the
        // same discipline `funding-intent.route.ts` applies to `xdr_rejected`.
        return reply.code(422).send({ code: verification.refusal.code });
      }

      const submission = await dependencies.invocations.submit(command.signedXdr);

      if (!submission.ok) {
        return reply.code(503).send({ code: "unavailable" });
      }

      if (submission.value.status === "rejected") {
        return reply.code(422).send({ code: "rejected" });
      }

      return reply.code(202).send({ transactionHash: submission.value.hash, status: "accepted" });
    }
  );

  app.get<{ Params: { campaignId: string; hash: string } }>(
    "/campaigns/:campaignId/transactions/:hash",
    async (request, reply) => {
      const outcome = await dependencies.invocations.findResult(request.params.hash);

      if (!outcome.ok) {
        return reply.code(503).send({ code: "unavailable" });
      }

      if (outcome.value.status !== "success") {
        return reply.code(200).send({ transactionHash: request.params.hash, status: outcome.value.status });
      }

      const mirror = await dependencies.campaigns.findById(request.params.campaignId);

      if (!mirror.ok) {
        return mirror.error.code === "not_found"
          ? reply.code(404).send({ code: "not_found" })
          : reply.code(503).send({ code: "unavailable" });
      }

      const chainState = await dependencies.chain.readCampaign(mirror.value.contractAddress);

      if (!chainState.ok) {
        return reply.code(503).send({ code: "unavailable" });
      }

      const reconciled = await reconcileCampaign(dependencies.campaigns, {
        campaignId: mirror.value.campaignId,
        snapshot: toChainCampaignSnapshot(chainState.value, []),
        correlationId: parseCorrelationId(request.id)
      });

      if (!reconciled.ok) {
        return reply.code(503).send({ code: "unavailable" });
      }

      return reply.code(200).send({
        transactionHash: request.params.hash,
        status: "success",
        campaign: toCampaignSnapshotWire({
          campaignId: reconciled.value.campaign.campaignId,
          applicationId: reconciled.value.campaign.applicationId,
          contractAddress: reconciled.value.campaign.contractAddress,
          network: reconciled.value.campaign.network,
          state: chainState.value.state,
          goalStroops: chainState.value.goalStroops,
          totalStroops: chainState.value.totalStroops,
          deadline: reconciled.value.campaign.deadline,
          smeAccountId: reconciled.value.campaign.smeAccountId,
          reconciliationStatus: reconciled.value.campaign.reconciliationStatus,
          explorerUrl: explorerUrlFor(dependencies, reconciled.value.campaign.contractAddress)
        })
      });
    }
  );
}
