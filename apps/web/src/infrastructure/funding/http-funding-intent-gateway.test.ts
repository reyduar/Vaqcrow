import { describe, expect, it, vi } from "vitest";
import type { HttpClientPort } from "@/application/ports/http-client-port";
import type {
  FundingIntentId,
  PrepareFundingIntentCommand,
  SubmitFundingIntentCommand
} from "@vaqcrow/contracts";
import { HttpFundingIntentGateway } from "./http-funding-intent-gateway";

const INTENT_ID = "11111111-1111-4111-8111-111111111111" as FundingIntentId;
const CORRELATION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PASSPHRASE = "passphrase-from-response";
const SOURCE = "GSOURCEACCOUNT";
const DEST = "GDESTINATIONACCOUNT";

const terms = {
  network: "TESTNET",
  networkPassphrase: PASSPHRASE,
  sourceAccountId: SOURCE,
  sourceSequence: "12",
  destinationAccountId: DEST,
  amountStroops: "15000000",
  memo: null,
  expiresAt: "2026-09-21T12:15:00.000Z"
} as const;

const prepared = { ...terms, intentId: INTENT_ID, xdr: "UNSIGNED-XDR", applicationId: null };
const snapshot = {
  ...terms,
  intentId: INTENT_ID,
  state: "submitted",
  transactionHash: "TRANSACTION-HASH",
  applicationId: null,
  lastCorrelationId: CORRELATION_ID,
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:00.000Z"
};

const prepareCommand = {
  sourceAccountId: SOURCE,
  destinationAccountId: DEST,
  amountStroops: 15000000n,
  memo: null,
  applicationId: null
} as unknown as PrepareFundingIntentCommand;

const submitCommand = {
  signedXdr: "SIGNED-XDR",
  intent: { ...terms, amountStroops: 15000000n },
  applicationId: null
} as unknown as SubmitFundingIntentCommand;

function http(body: unknown, status = 200) {
  const send = vi.fn().mockResolvedValue({ status, body });
  return { port: { send } as unknown as HttpClientPort, send };
}

describe("HttpFundingIntentGateway.prepare", () => {
  it("posts the exact five body keys with the amount as a decimal string", async () => {
    const { port, send } = http({ intent: prepared });

    await new HttpFundingIntentGateway(port).prepare(prepareCommand);

    expect(send).toHaveBeenCalledWith({
      method: "POST",
      path: "/funding-intents",
      body: {
        sourceAccountId: SOURCE,
        destinationAccountId: DEST,
        amountStroops: "15000000",
        memo: null,
        applicationId: null
      }
    });
  });

  it("returns the contract-validated prepared intent with a bigint amount", async () => {
    const { port } = http({ intent: prepared });

    const result = await new HttpFundingIntentGateway(port).prepare(prepareCommand);

    expect(result.intentId).toBe(INTENT_ID);
    expect(result.networkPassphrase).toBe(PASSPHRASE);
    expect(result.amountStroops).toBe(15000000n);
    expect(result.xdr).toBe("UNSIGNED-XDR");
  });

  it.each([
    ["a missing intent", {}],
    ["extra keys", { intent: prepared, extra: 1 }],
    ["a drifted intent", { intent: { ...prepared, amountStroops: "0" } }],
    ["a non-object body", []]
  ])("throws on a malformed response: %s", async (_name, body) => {
    const { port } = http(body);

    await expect(new HttpFundingIntentGateway(port).prepare(prepareCommand)).rejects.toThrow();
  });
});

describe("HttpFundingIntentGateway.submit", () => {
  it("posts the signed XDR and the declared terms, encoding the amount as text", async () => {
    const { port, send } = http({ applied: true, intent: snapshot }, 202);

    await new HttpFundingIntentGateway(port).submit(INTENT_ID, submitCommand);

    expect(send).toHaveBeenCalledWith({
      method: "POST",
      path: `/funding-intents/${INTENT_ID}/submission`,
      body: {
        signedXdr: "SIGNED-XDR",
        intent: terms,
        applicationId: null
      }
    });
  });

  it("distinguishes a first submission (202 applied) from an exact replay (200)", async () => {
    const first = http({ applied: true, intent: snapshot }, 202);
    const replay = http({ applied: false, intent: snapshot }, 200);

    // The two responses are the same shape and differ only in `applied`; the
    // adapter must not collapse the distinction into a boolean status flag.
    await expect(new HttpFundingIntentGateway(first.port).submit(INTENT_ID, submitCommand)).resolves.toMatchObject({
      applied: true,
      intent: { intentId: INTENT_ID, amountStroops: 15000000n }
    });
    await expect(new HttpFundingIntentGateway(replay.port).submit(INTENT_ID, submitCommand)).resolves.toMatchObject({
      applied: false,
      intent: { intentId: INTENT_ID, amountStroops: 15000000n }
    });
  });

  it.each([
    ["a missing applied flag", { intent: snapshot }],
    ["a non-boolean applied flag", { applied: "yes", intent: snapshot }],
    // `confirmed` is a valid state since #25; the drift has to be a value the
    // demo genuinely cannot produce, not merely one it could not before.
    ["a drifted snapshot", { applied: true, intent: { ...snapshot, state: "manual_review" } }],
    ["extra keys", { applied: true, intent: snapshot, extra: 1 }]
  ])("throws on a malformed response: %s", async (_name, body) => {
    const { port } = http(body, 202);

    await expect(new HttpFundingIntentGateway(port).submit(INTENT_ID, submitCommand)).rejects.toThrow();
  });
});

describe("HttpFundingIntentGateway.get", () => {
  it("reads the intent back and parses the reported snapshot", async () => {
    const { port, send } = http({ intent: snapshot });

    const result = await new HttpFundingIntentGateway(port).get(INTENT_ID);

    expect(send).toHaveBeenCalledWith({ method: "GET", path: `/funding-intents/${INTENT_ID}` });
    expect(result.state).toBe("submitted");
    expect(result.transactionHash).toBe("TRANSACTION-HASH");
    expect(result.amountStroops).toBe(15000000n);
  });

  it("throws on an envelope that drifted", async () => {
    const { port } = http({ intent: snapshot, extra: 1 });

    await expect(new HttpFundingIntentGateway(port).get(INTENT_ID)).rejects.toThrow();
  });
});
