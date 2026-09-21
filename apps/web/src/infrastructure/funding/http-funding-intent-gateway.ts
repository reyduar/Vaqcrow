import { parseFundingIntentSnapshot, parsePreparedFundingIntent } from "@vaqcrow/contracts";
import type {
  FundingIntentId,
  FundingIntentSnapshot,
  FundingIntentTerms,
  PrepareFundingIntentCommand,
  PreparedFundingIntent,
  SubmitFundingIntentCommand
} from "@vaqcrow/contracts";
import type { HttpClientPort } from "@/application/ports/http-client-port";
import type { FundingIntentGateway, SubmittedFundingIntent } from "@/application/ports/funding-intent-gateway";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Encodes terms for the wire. A stroop amount is a `bigint` in the
 * application and a **decimal string** on the wire — a JSON number is a double
 * and loses precision above 2^53, so it never carries money.
 */
function toWireTerms(terms: FundingIntentTerms): Record<string, unknown> {
  return { ...terms, amountStroops: terms.amountStroops.toString() };
}

/** The `{ intent }` envelope `prepare` and `get` both answer with. */
function unwrapIntent(body: unknown): unknown {
  if (!isPlainObject(body)) throw new TypeError("Invalid funding intent envelope");
  const { intent, ...extra } = body;
  if (Object.keys(extra).length > 0) throw new TypeError("Invalid funding intent envelope");
  return intent;
}

/** The `{ applied, intent }` envelope the submission endpoint answers with. */
function parseSubmissionEnvelope(body: unknown): SubmittedFundingIntent {
  if (!isPlainObject(body)) throw new TypeError("Invalid funding intent submission envelope");
  const { applied, intent, ...extra } = body;
  if (Object.keys(extra).length > 0 || typeof applied !== "boolean") {
    throw new TypeError("Invalid funding intent submission envelope");
  }
  return { applied, intent: parseFundingIntentSnapshot(intent) };
}

/**
 * `POST /funding-intents` (200 — stateless, nothing is created),
 * `POST /funding-intents/:intentId/submission` (202 applied, 200 replay) and
 * `GET /funding-intents/:intentId` (200).
 *
 * Every response is parsed through the `@vaqcrow/contracts` schemas, so an
 * envelope that drifted from the contract is a thrown `TypeError` rather than
 * a half-trusted object. The status code is not what distinguishes a first
 * submission from a replay — `applied` is — but the adapter keeps the
 * response's own body authoritative for it.
 */
export class HttpFundingIntentGateway implements FundingIntentGateway {
  constructor(private readonly http: HttpClientPort) {}

  async prepare(command: PrepareFundingIntentCommand): Promise<PreparedFundingIntent> {
    const response = await this.http.send<unknown>({
      method: "POST",
      path: "/funding-intents",
      body: {
        sourceAccountId: command.sourceAccountId,
        destinationAccountId: command.destinationAccountId,
        amountStroops: command.amountStroops.toString(),
        memo: command.memo,
        applicationId: command.applicationId
      }
    });

    return parsePreparedFundingIntent(unwrapIntent(response.body));
  }

  async submit(
    intentId: FundingIntentId,
    command: SubmitFundingIntentCommand
  ): Promise<SubmittedFundingIntent> {
    const response = await this.http.send<unknown>({
      method: "POST",
      path: `/funding-intents/${encodeURIComponent(intentId)}/submission`,
      body: {
        signedXdr: command.signedXdr,
        intent: toWireTerms(command.intent),
        applicationId: command.applicationId
      }
    });

    return parseSubmissionEnvelope(response.body);
  }

  async get(intentId: FundingIntentId): Promise<FundingIntentSnapshot> {
    const response = await this.http.send<unknown>({
      method: "GET",
      path: `/funding-intents/${encodeURIComponent(intentId)}`
    });

    return parseFundingIntentSnapshot(unwrapIntent(response.body));
  }
}
