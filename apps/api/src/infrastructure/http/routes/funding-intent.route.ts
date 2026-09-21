import {
  parseCorrelationId,
  parseFundingIntentId,
  parsePrepareFundingIntentCommand,
  parseSubmitFundingIntentCommand
} from "@vaqcrow/contracts";
import type {
  FundingIntentId,
  FundingIntentSnapshot,
  PreparedFundingIntent
} from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import type { FundingIntentXdrPort } from "../../../application/ports/funding-intent-xdr-port.js";
import type { FundingIntentRepositoryPort } from "../../../application/ports/funding-intent-repository-port.js";
import type { LedgerPort } from "../../../application/ports/ledger-port.js";
import { getFundingIntent } from "../../../application/use-cases/get-funding-intent.js";
import { prepareFundingIntent } from "../../../application/use-cases/prepare-funding-intent.js";
import { submitFundingIntent } from "../../../application/use-cases/submit-funding-intent.js";

/**
 * The HTTP surface for a funding intent: build it, submit the signed envelope,
 * report its status.
 *
 * The route owns three things the use cases deliberately do not: the exact body
 * key set (a body that drifted from the contract is refused before any parsing
 * work), the status-code mapping, and the wire encoding of money. A stroop
 * amount is a `bigint` in the application and a decimal string on the wire —
 * never a JSON number, which is a double and would lose precision above 2^53.
 */

const PREPARE_BODY_KEYS = new Set([
  "sourceAccountId",
  "destinationAccountId",
  "amountStroops",
  "memo",
  "applicationId"
]);

const SUBMIT_BODY_KEYS = new Set(["signedXdr", "intent", "applicationId"]);

export interface FundingIntentRouteDependencies {
  readonly ledger: LedgerPort;
  readonly xdr: FundingIntentXdrPort;
  /**
   * The route submits and reports, so it depends on those two operations only.
   * The confirmation surface #25 adds belongs to the poll, not to this route.
   */
  readonly repository: Pick<FundingIntentRepositoryPort, "submit" | "findById">;
  readonly network: { readonly network: string; readonly networkPassphrase: string };
  readonly generateIntentId: () => FundingIntentId;
  /**
   * The base a transaction link is built from, normalised by configuration.
   *
   * It arrives here rather than in the web because the browser holds no opinion
   * about the network (`D1`): it is told where a hash opens instead of deciding.
   */
  readonly explorerBaseUrl: string;
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

/** Encodes a stroop amount for the wire: `bigint` is not JSON-serializable. */
function toWire<T extends { amountStroops: bigint }>(
  value: T
): Omit<T, "amountStroops"> & { amountStroops: string } {
  return { ...value, amountStroops: value.amountStroops.toString() };
}

export function registerFundingIntentRoute(
  app: FastifyInstance,
  dependencies: FundingIntentRouteDependencies
): void {
  app.post<{ Body: unknown }>("/funding-intents", async (request, reply) => {
    if (!hasExactBodyKeys(request.body, PREPARE_BODY_KEYS)) {
      return reply.code(400).send({ code: "invalid_request" });
    }

    let command;
    try {
      command = parsePrepareFundingIntentCommand({
        sourceAccountId: request.body["sourceAccountId"],
        destinationAccountId: request.body["destinationAccountId"],
        amountStroops: request.body["amountStroops"],
        memo: request.body["memo"],
        applicationId: request.body["applicationId"]
      });
    } catch {
      return reply.code(400).send({ code: "invalid_request" });
    }

    const result = await prepareFundingIntent(dependencies, {
      command,
      correlationId: parseCorrelationId(request.id)
    });

    if (result.ok) {
      // 200, not 201: nothing is created. The prepare step is stateless (D2),
      // so the response is a computation, not a new resource.
      return reply.code(200).send({ intent: toWire<PreparedFundingIntent>(result.value) });
    }

    switch (result.error.code) {
      case "account_not_found":
        return reply.code(404).send({ code: "account_not_found" });
      case "invalid_input":
        return reply.code(400).send({ code: "invalid_request" });
      case "unavailable":
        return reply.code(503).send({ code: "unavailable" });
    }
  });

  app.post<{ Params: { intentId: string }; Body: unknown }>(
    "/funding-intents/:intentId/submission",
    async (request, reply) => {
      if (!hasExactBodyKeys(request.body, SUBMIT_BODY_KEYS)) {
        return reply.code(400).send({ code: "invalid_request" });
      }

      let intentId: FundingIntentId;
      let command;
      try {
        intentId = parseFundingIntentId(request.params.intentId);
        command = parseSubmitFundingIntentCommand({
          signedXdr: request.body["signedXdr"],
          intent: request.body["intent"],
          applicationId: request.body["applicationId"]
        });
      } catch {
        return reply.code(400).send({ code: "invalid_request" });
      }

      const result = await submitFundingIntent(dependencies, {
        intentId,
        command,
        correlationId: parseCorrelationId(request.id)
      });

      if (result.ok) {
        // DEMO.md §7: answer `202 Accepted` for a first submission and show
        // `submitted`; an exact replay already applied is reported as 200.
        return reply
          .code(result.value.applied ? 202 : 200)
          .send({ applied: result.value.applied, intent: toWire<FundingIntentSnapshot>(result.value.intent) });
      }

      switch (result.error.code) {
        case "xdr_rejected":
          // 422, not 400: the body is well-formed and the request is
          // semantically refused — a signed envelope that does not match the
          // intent it declares. That is a different failure from the 400 a
          // malformed body gets, and the caller can act on the difference.
          //
          // The port's `reason` is deliberately not echoed. It names the field
          // that failed, which would describe the envelope back to whoever
          // tampered with it; it exists for logs and tests only.
          return reply.code(422).send({ code: "xdr_rejected" });
        case "idempotency_conflict":
          return reply.code(409).send({ code: "idempotency_conflict" });
        case "unavailable":
          return reply.code(503).send({ code: "unavailable" });
      }
    }
  );

  app.get<{ Params: { intentId: string } }>("/funding-intents/:intentId", async (request, reply) => {
    let intentId: FundingIntentId;
    try {
      intentId = parseFundingIntentId(request.params.intentId);
    } catch {
      return reply.code(400).send({ code: "invalid_request" });
    }

    const result = await getFundingIntent(
      {
        repository: dependencies.repository,
        explorerBaseUrl: dependencies.explorerBaseUrl
      },
      intentId
    );

    if (result.ok) {
      return reply.code(200).send({ intent: toWire<FundingIntentSnapshot>(result.value) });
    }

    switch (result.error.code) {
      case "not_found":
        return reply.code(404).send({ code: "not_found" });
      case "unavailable":
        return reply.code(503).send({ code: "unavailable" });
    }
  });
}
