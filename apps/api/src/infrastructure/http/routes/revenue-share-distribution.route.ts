import {
  parseCorrelationId,
  parsePrepareRevenueShareDistributionCommand,
  parseRevenueShareDistributionId,
  parseSubmitRevenueShareDistributionCommand
} from "@vaqcrow/contracts";
import type {
  CorrelationId,
  PrepareRevenueShareDistributionCommand,
  PreparedRevenueShareDistribution,
  RevenueShareDistributionId,
  RevenueShareDistributionSnapshot
} from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import type { LedgerPort } from "../../../application/ports/ledger-port.js";
import type { RevenueShareDistributionRepositoryPort } from "../../../application/ports/revenue-share-distribution-repository-port.js";
import type { RevenueShareDistributionXdrPort } from "../../../application/ports/revenue-share-distribution-xdr-port.js";
import type {
  DeriveRevenueShareDistributionErrorCode,
  DeriveRevenueShareDistributionResult
} from "../../../application/use-cases/derive-revenue-share-distribution.js";
import { getRevenueShareDistribution } from "../../../application/use-cases/get-revenue-share-distribution.js";
import { prepareRevenueShareDistribution } from "../../../application/use-cases/prepare-revenue-share-distribution.js";
import { submitRevenueShareDistribution } from "../../../application/use-cases/submit-revenue-share-distribution.js";

/**
 * The HTTP surface for a revenue-share distribution: derive and build it, submit the signed
 * envelope, report its status.
 *
 * The route owns three things the use cases deliberately do not: the exact body
 * key set (a body that drifted from the contract is refused before any parsing
 * work), the status-code mapping, and the wire encoding of money. A stroop
 * amount is a `bigint` in the application and a decimal string on the wire —
 * never a JSON number, which is a double and would lose precision above 2^53.
 * Every recipient amount is encoded, because a distribution's money facts are a
 * list rather than a single pair.
 */

const PREPARE_BODY_KEYS = new Set(["sourceAccountId", "applicationId", "campaignId", "memo"]);

const SUBMIT_BODY_KEYS = new Set(["signedXdr", "terms", "applicationId", "campaignId"]);

export interface RevenueShareDistributionRouteDependencies {
  readonly ledger: LedgerPort;
  readonly xdr: RevenueShareDistributionXdrPort;
  /**
   * The route submits, reports and refuses a repeated campaign and period, so it
   * depends on those operations only.
   * The confirmation/polling surface belongs to a later slice, not to this route.
   */
  readonly repository: Pick<RevenueShareDistributionRepositoryPort, "submit" | "findById" | "findActiveByCampaignPeriod">;
  readonly network: { readonly network: string; readonly networkPassphrase: string };
  readonly generateDistributionId: () => RevenueShareDistributionId;
  /**
   * The base a transaction link is built from, normalised by configuration.
   *
   * It arrives here rather than in the web because the browser holds no opinion
   * about the network (`D1`): it is told where a hash opens instead of deciding.
   */
  readonly explorerBaseUrl: string;
  /**
   * Derives who is paid and how much from the case (T5a). Bound once at the
   * composition root to `deriveRevenueShareDistribution`, so prepare and submit
   * share one derivation.
   */
  readonly derive: (input: {
    readonly applicationId: PrepareRevenueShareDistributionCommand["applicationId"];
    readonly campaignId: string;
    readonly sourceAccountId: string;
    readonly correlationId: CorrelationId;
  }) => Promise<DeriveRevenueShareDistributionResult>;
}

/**
 * The status each derivation failure maps to. The reason is a closed vocabulary
 * with no internal detail, so it is returned as-is: the caller can act on it.
 */
function derivationFailureStatus(
  reason: Exclude<DeriveRevenueShareDistributionErrorCode, "unavailable">
): 404 | 409 | 422 {
  switch (reason) {
    case "campaign_not_found":
    case "application_not_found":
      return 404;
    case "application_mismatch":
    case "source_not_sme":
    case "campaign_not_settled":
    case "decision_not_approved":
    case "contributions_incomplete":
      return 409;
    case "no_eligible_period":
    case "invalid_sales_data":
    case "no_contributors":
    case "obligation_rounds_to_zero":
      return 422;
  }
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

/**
 * Encodes a distribution for the wire: every recipient's stroop amount becomes a
 * decimal string. `bigint` is not JSON-serializable, and a plain `JSON.stringify`
 * would refuse the value outright rather than round it.
 */
function toWire<
  T extends { recipients: readonly { accountId: string; amountStroops: bigint }[] }
>(value: T): Omit<T, "recipients"> & { recipients: { accountId: string; amountStroops: string }[] } {
  return {
    ...value,
    recipients: value.recipients.map((recipient) => ({
      accountId: recipient.accountId,
      amountStroops: recipient.amountStroops.toString()
    }))
  };
}

export function registerRevenueShareDistributionRoute(
  app: FastifyInstance,
  dependencies: RevenueShareDistributionRouteDependencies
): void {
  app.post<{ Body: unknown }>("/revenue-share-distributions", async (request, reply) => {
    if (!hasExactBodyKeys(request.body, PREPARE_BODY_KEYS)) {
      return reply.code(400).send({ code: "invalid_request" });
    }

    let command;
    try {
      command = parsePrepareRevenueShareDistributionCommand({
        sourceAccountId: request.body["sourceAccountId"],
        applicationId: request.body["applicationId"],
        campaignId: request.body["campaignId"],
        memo: request.body["memo"]
      });
    } catch {
      return reply.code(400).send({ code: "invalid_request" });
    }

    const result = await prepareRevenueShareDistribution(dependencies, {
      command,
      correlationId: parseCorrelationId(request.id)
    });

    if (result.ok) {
      // 200, not 201: nothing is created. The prepare step is stateless (D2),
      // so the response is a computation, not a new resource.
      return reply.code(200).send({ distribution: toWire<PreparedRevenueShareDistribution>(result.value) });
    }

    switch (result.error.code) {
      case "account_not_found":
        return reply.code(404).send({ code: "account_not_found" });
      case "derivation_failed":
        return reply
          .code(derivationFailureStatus(result.error.reason))
          .send({ code: "derivation_failed", reason: result.error.reason });
      case "already_distributed":
        // 409: the campaign's period was already distributed (submitted or
        // confirmed); a failed distribution does not count, so a retry is open.
        return reply.code(409).send({ code: "already_distributed" });
      case "invalid_input":
        return reply.code(400).send({ code: "invalid_request" });
      case "unavailable":
        return reply.code(503).send({ code: "unavailable" });
    }
  });

  app.post<{ Params: { distributionId: string }; Body: unknown }>(
    "/revenue-share-distributions/:distributionId/submission",
    async (request, reply) => {
      if (!hasExactBodyKeys(request.body, SUBMIT_BODY_KEYS)) {
        return reply.code(400).send({ code: "invalid_request" });
      }

      let distributionId: RevenueShareDistributionId;
      let command;
      try {
        distributionId = parseRevenueShareDistributionId(request.params.distributionId);
        command = parseSubmitRevenueShareDistributionCommand({
          signedXdr: request.body["signedXdr"],
          terms: request.body["terms"],
          applicationId: request.body["applicationId"],
          campaignId: request.body["campaignId"]
        });
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      const result = await submitRevenueShareDistribution(dependencies, {
        distributionId,
        command,
        correlationId: parseCorrelationId(request.id)
      });

      if (result.ok) {
        // DEMO.md §7: answer `202 Accepted` for a first submission; an exact
        // replay already applied is reported as 200.
        return reply
          .code(result.value.applied ? 202 : 200)
          .send({
            applied: result.value.applied,
            distribution: toWire<RevenueShareDistributionSnapshot>(result.value.distribution)
          });
      }

      switch (result.error.code) {
        case "xdr_rejected":
          // 422, not 400: the body is well-formed and the request is
          // semantically refused — a signed envelope that does not match the
          // terms it declares. That is a different failure from the 400 a
          // malformed body gets, and the caller can act on the difference.
          //
          // The port's `reason` is deliberately not echoed. It names the field
          // that failed, which would describe the envelope back to whoever
          // tampered with it; it exists for logs and tests only.
          return reply.code(422).send({ code: "xdr_rejected" });
        case "derivation_mismatch":
          // 422 like `xdr_rejected`: the body is well-formed and semantically
          // refused, because the declared recipients or amounts are not what the
          // case derives. Nothing is echoed: the derivation is not described
          // back to whoever declared a different split.
          return reply.code(422).send({ code: "derivation_mismatch" });
        case "derivation_failed":
          return reply
            .code(derivationFailureStatus(result.error.reason))
            .send({ code: "derivation_failed", reason: result.error.reason });
        case "idempotency_conflict":
          return reply.code(409).send({ code: "idempotency_conflict" });
        case "already_distributed":
          return reply.code(409).send({ code: "already_distributed" });
        case "unavailable":
          return reply.code(503).send({ code: "unavailable" });
      }
    }
  );

  app.get<{ Params: { distributionId: string } }>(
    "/revenue-share-distributions/:distributionId",
    async (request, reply) => {
      let distributionId: RevenueShareDistributionId;
      try {
        distributionId = parseRevenueShareDistributionId(request.params.distributionId);
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      const result = await getRevenueShareDistribution(
        {
          repository: dependencies.repository,
          explorerBaseUrl: dependencies.explorerBaseUrl
        },
        distributionId
      );

      if (result.ok) {
        return reply
          .code(200)
          .send({ distribution: toWire<RevenueShareDistributionSnapshot>(result.value) });
      }

      switch (result.error.code) {
        case "not_found":
          return reply.code(404).send({ code: "not_found" });
        case "unavailable":
          return reply.code(503).send({ code: "unavailable" });
      }
    }
  );
}
