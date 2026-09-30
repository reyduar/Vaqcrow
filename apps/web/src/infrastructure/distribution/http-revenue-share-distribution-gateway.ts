import {
  parsePreparedRevenueShareDistribution,
  parseRevenueShareDistributionSnapshot
} from "@vaqcrow/contracts";
import type {
  PreparedRevenueShareDistribution,
  RevenueShareDistributionId,
  RevenueShareDistributionSnapshot,
  RevenueShareDistributionTerms
} from "@vaqcrow/contracts";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { HttpClientPort } from "@/application/ports/http-client-port";
import { DERIVATION_FAILURE_REASONS } from "@/application/ports/revenue-share-distribution-gateway";
import type {
  PrepareRevenueShareDistributionRequest,
  RevenueShareDistributionGateway,
  RevenueShareDistributionGatewayError,
  RevenueShareDistributionResult,
  SubmitRevenueShareDistributionRequest,
  SubmittedRevenueShareDistribution
} from "@/application/ports/revenue-share-distribution-gateway";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The `{ distribution }` envelope. Prepare and get answer with it, and the
 * submission envelope is `{ applied, distribution }` — so the same unwrap
 * applies once the sibling `applied` key has been accounted for.
 */
function unwrapDistribution(body: unknown): unknown {
  if (!isPlainObject(body)) throw new TypeError("Invalid revenue-share distribution envelope");
  const { distribution, ...extra } = body;
  if (Object.keys(extra).length > 0) {
    throw new TypeError("Invalid revenue-share distribution envelope");
  }
  return distribution;
}

/** The `{ applied, distribution }` envelope the submission endpoint answers with. */
function parseSubmissionEnvelope(body: unknown): SubmittedRevenueShareDistribution {
  if (!isPlainObject(body)) {
    throw new TypeError("Invalid revenue-share distribution submission envelope");
  }
  const { applied, distribution, ...extra } = body;
  if (Object.keys(extra).length > 0 || typeof applied !== "boolean") {
    throw new TypeError("Invalid revenue-share distribution submission envelope");
  }
  return { applied, distribution: parseRevenueShareDistributionSnapshot(distribution) };
}

/**
 * Encodes terms for the wire. A stroop amount is a `bigint` in the application
 * and a **decimal string** on the wire — a JSON number is a double and loses
 * precision above 2^53, so it never carries money. Every recipient amount is
 * encoded, because a distribution's money facts are a list rather than a pair.
 */
function toWireTerms(terms: RevenueShareDistributionTerms): Record<string, unknown> {
  return {
    ...terms,
    recipients: terms.recipients.map((recipient) => ({
      accountId: recipient.accountId,
      amountStroops: recipient.amountStroops.toString()
    }))
  };
}

/**
 * Classifies a failure into the port's coarse kind.
 *
 * An `HttpClientError` names the HTTP outcome; anything else — a drift that
 * made a contract parse throw, an unexpected exception — is `unknown`, which is
 * honest about what the web actually knows. No branch ever copies a backend
 * message, body or header into the result.
 */
function toError(caught: unknown): RevenueShareDistributionGatewayError {
  if (!(caught instanceof HttpClientError)) return { kind: "unknown" };
  if (caught.kind === "network") return { kind: "network" };

  // The typed derivation outcomes are named by `{ code }` whatever the status.
  if (caught.errorCode === "derivation_failed") {
    const reason = DERIVATION_FAILURE_REASONS.find((known) => known === caught.errorReason);
    return reason === undefined ? { kind: "unknown" } : { kind: "derivation_failed", reason };
  }
  if (caught.errorCode === "derivation_mismatch") return { kind: "derivation_mismatch" };
  if (caught.errorCode === "already_distributed") return { kind: "already_distributed" };

  switch (caught.status) {
    case 400:
      return { kind: "validation" };
    case 404:
      return { kind: caught.errorCode === "account_not_found" ? "account_not_found" : "not_found" };
    case 409:
      return {
        kind: caught.errorCode === "idempotency_conflict" ? "idempotency_conflict" : "conflict"
      };
    case 422:
      return { kind: "xdr_rejected" };
    case 503:
      return { kind: "unavailable" };
    default:
      return { kind: "unknown" };
  }
}

/**
 * `POST /revenue-share-distributions` (200 — stateless, nothing is created),
 * `POST /revenue-share-distributions/:distributionId/submission` (202 applied,
 * 200 replay) and `GET /revenue-share-distributions/:distributionId` (200).
 *
 * Every response is parsed through the `@vaqcrow/contracts` schemas, so an
 * envelope that drifted from the contract never becomes a half-trusted object;
 * it becomes `{ ok: false, kind: "unknown" }`. The status code is not what
 * distinguishes a first submission from a replay — `applied` is — but the
 * adapter keeps the response's own body authoritative for it.
 */
export class HttpRevenueShareDistributionGateway implements RevenueShareDistributionGateway {
  constructor(private readonly http: HttpClientPort) {}

  async prepare(
    command: PrepareRevenueShareDistributionRequest
  ): Promise<RevenueShareDistributionResult<PreparedRevenueShareDistribution>> {
    try {
      const response = await this.http.send<unknown>({
        method: "POST",
        path: "/revenue-share-distributions",
        body: {
          sourceAccountId: command.sourceAccountId,
          applicationId: command.applicationId,
          campaignId: command.campaignId,
          memo: command.memo
        }
      });

      return { ok: true, value: parsePreparedRevenueShareDistribution(unwrapDistribution(response.body)) };
    } catch (caught) {
      return { ok: false, error: toError(caught) };
    }
  }

  async submit(
    command: SubmitRevenueShareDistributionRequest
  ): Promise<RevenueShareDistributionResult<SubmittedRevenueShareDistribution>> {
    try {
      const response = await this.http.send<unknown>({
        method: "POST",
        path: `/revenue-share-distributions/${encodeURIComponent(command.distributionId)}/submission`,
        body: {
          signedXdr: command.signedXdr,
          terms: toWireTerms(command.terms),
          applicationId: command.applicationId,
          campaignId: command.campaignId
        }
      });

      return { ok: true, value: parseSubmissionEnvelope(response.body) };
    } catch (caught) {
      return { ok: false, error: toError(caught) };
    }
  }

  async getStatus(
    distributionId: RevenueShareDistributionId
  ): Promise<RevenueShareDistributionResult<RevenueShareDistributionSnapshot>> {
    try {
      const response = await this.http.send<unknown>({
        method: "GET",
        path: `/revenue-share-distributions/${encodeURIComponent(distributionId)}`
      });

      return { ok: true, value: parseRevenueShareDistributionSnapshot(unwrapDistribution(response.body)) };
    } catch (caught) {
      return { ok: false, error: toError(caught) };
    }
  }
}
