import { describe, expect, it, vi } from "vitest";
import { HttpClientError } from "@/application/ports/http-client-port";
import type { HttpClientPort } from "@/application/ports/http-client-port";
import type { RevenueShareDistributionId } from "@vaqcrow/contracts";
import { HttpRevenueShareDistributionGateway } from "./http-revenue-share-distribution-gateway";

const DISTRIBUTION_ID = "123e4567-e89b-42d3-a456-4266141740ab";
const APPLICATION_ID = "87654321-4321-4abc-8def-123456789abc";
const CORRELATION_ID = "22222222-2222-4222-8222-222222222222";
const CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";
const SOURCE = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const RECIPIENT_A = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const RECIPIENT_B = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const PASSPHRASE = "passphrase-from-response";
const TRANSACTION_HASH = "d0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f";
const EXPLORER_URL = `https://stellar.expert/explorer/testnet/tx/${TRANSACTION_HASH}`;

/** A stroop count above 2^53, so the wire form cannot survive as a float. */
const LARGE_AMOUNT = "9007199254740993";
const SMALL_AMOUNT = "10000000";

/** The terms exactly as they cross the wire: recipient amounts are decimal strings. */
const wireTerms = {
  network: "testnet",
  networkPassphrase: PASSPHRASE,
  sourceAccountId: SOURCE,
  sourceSequence: "1234567891",
  memo: null,
  expiresAt: "2026-09-21T12:00:00.000Z",
  recipients: [
    { accountId: RECIPIENT_A, amountStroops: LARGE_AMOUNT },
    { accountId: RECIPIENT_B, amountStroops: SMALL_AMOUNT }
  ]
};

const wirePrepared = {
  ...wireTerms,
  distributionId: DISTRIBUTION_ID,
  xdr: "UNSIGNED-XDR",
  applicationId: APPLICATION_ID,
  // The API returns the case it derived the distribution for.
  campaignId: CAMPAIGN_ID,
  derivation: {
    ruleVersion: "RS-2026-01",
    rateBps: 450,
    period: "2026-08",
    salesArs: "3745800",
    obligationArs: "168561",
    excludedPeriods: [],
    conversion: { goalStroops: "1000000000", approvedLimitArs: "5000000", totalStroops: "33712200" },
    simulated: true
  }
};

const wireSnapshot = {
  ...wireTerms,
  distributionId: DISTRIBUTION_ID,
  state: "submitted",
  transactionHash: TRANSACTION_HASH,
  applicationId: APPLICATION_ID,
  campaignId: null,
  explorerUrl: EXPLORER_URL,
  failureReason: null,
  lastCorrelationId: CORRELATION_ID,
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:05.000Z"
};

/** The terms as the application holds them: the contract parses amounts to `bigint`. */
const parsedRecipients = [
  { accountId: RECIPIENT_A, amountStroops: 9_007_199_254_740_993n },
  { accountId: RECIPIENT_B, amountStroops: 10_000_000n }
];

const prepareCommand = {
  sourceAccountId: SOURCE,
  applicationId: APPLICATION_ID,
  campaignId: CAMPAIGN_ID,
  memo: null
};

const submitCommand = {
  distributionId: DISTRIBUTION_ID as RevenueShareDistributionId,
  signedXdr: "SIGNED-XDR",
  terms: { ...wireTerms, recipients: parsedRecipients },
  applicationId: APPLICATION_ID,
  campaignId: CAMPAIGN_ID
};

function http(body: unknown, status = 200) {
  const send = vi.fn().mockResolvedValue({ status, body });
  return { port: { send } as unknown as HttpClientPort, send };
}

function failing(error: unknown) {
  const send = vi.fn().mockRejectedValue(error);
  return { port: { send } as unknown as HttpClientPort, send };
}

describe("HttpRevenueShareDistributionGateway.prepare", () => {
  it("posts the case (source, application, campaign, memo) and never any recipient or amount", async () => {
    const { port, send } = http({ distribution: wirePrepared });

    await new HttpRevenueShareDistributionGateway(port).prepare(prepareCommand);

    expect(send).toHaveBeenCalledWith({
      method: "POST",
      path: "/revenue-share-distributions",
      body: {
        sourceAccountId: SOURCE,
        applicationId: APPLICATION_ID,
        campaignId: CAMPAIGN_ID,
        memo: null
      }
    });
  });

  it("returns the derivation breakdown the service computed", async () => {
    const { port } = http({ distribution: wirePrepared });

    const result = await new HttpRevenueShareDistributionGateway(port).prepare(prepareCommand);

    if (!result.ok) throw new Error("expected success");
    expect(result.value.campaignId).toBe(CAMPAIGN_ID);
    expect(result.value.derivation).toEqual(wirePrepared.derivation);
  });

  it.each([
    [404, "campaign_not_found"],
    [404, "application_not_found"],
    [409, "application_mismatch"],
    [409, "source_not_sme"],
    [409, "campaign_not_settled"],
    [409, "decision_not_approved"],
    [409, "contributions_incomplete"],
    [422, "no_eligible_period"],
    [422, "invalid_sales_data"],
    [422, "no_contributors"],
    [422, "obligation_rounds_to_zero"]
  ])("maps a %i derivation_failed / %s refusal to its own typed reason", async (status, reason) => {
    const { port } = failing(new HttpClientError("http", status, undefined, "derivation_failed", reason));

    const result = await new HttpRevenueShareDistributionGateway(port).prepare(prepareCommand);

    expect(result).toEqual({ ok: false, error: { kind: "derivation_failed", reason } });
  });

  it("maps a derivation_failed with a reason it does not know to unknown, never to a guess", async () => {
    const { port } = failing(new HttpClientError("http", 409, undefined, "derivation_failed", "brand_new"));

    const result = await new HttpRevenueShareDistributionGateway(port).prepare(prepareCommand);

    expect(result).toEqual({ ok: false, error: { kind: "unknown" } });
  });

  it("maps an already distributed period (409) distinctly from another conflict", async () => {
    const { port } = failing(new HttpClientError("http", 409, undefined, "already_distributed"));

    const result = await new HttpRevenueShareDistributionGateway(port).prepare(prepareCommand);

    expect(result).toEqual({ ok: false, error: { kind: "already_distributed" } });
  });

  it("returns the contract-validated prepared distribution with bigint amounts and the response passphrase", async () => {
    const { port } = http({ distribution: wirePrepared });

    const result = await new HttpRevenueShareDistributionGateway(port).prepare(prepareCommand);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.distributionId).toBe(DISTRIBUTION_ID);
    expect(result.value.networkPassphrase).toBe(PASSPHRASE);
    expect(result.value.xdr).toBe("UNSIGNED-XDR");
    expect(result.value.recipients).toEqual(parsedRecipients);
  });

  it("maps a refused body to a sanitized validation error and leaks nothing", async () => {
    const { port } = failing(new HttpClientError("http", 400, undefined, "invalid_request"));

    const result = await new HttpRevenueShareDistributionGateway(port).prepare(prepareCommand);

    expect(result).toEqual({ ok: false, error: { kind: "validation" } });
    if (result.ok) throw new Error("expected failure");
    expect(Object.keys(result.error)).toEqual(["kind"]);
    expect(JSON.stringify(result)).not.toContain("invalid_request");
  });

  it("maps an unfunded source account (404 account_not_found) distinctly from an unknown record", async () => {
    const account = failing(new HttpClientError("http", 404, undefined, "account_not_found"));
    const unknown = failing(new HttpClientError("http", 404, undefined, "not_found"));

    const first = await new HttpRevenueShareDistributionGateway(account.port).prepare(prepareCommand);
    const second = await new HttpRevenueShareDistributionGateway(unknown.port).prepare(prepareCommand);

    expect(first).toEqual({ ok: false, error: { kind: "account_not_found" } });
    expect(second).toEqual({ ok: false, error: { kind: "not_found" } });
  });

  it("maps an unavailable service (503) and a lost connection without confusing them", async () => {
    const down = failing(new HttpClientError("http", 503));
    const offline = failing(new HttpClientError("network"));

    const first = await new HttpRevenueShareDistributionGateway(down.port).prepare(prepareCommand);
    const second = await new HttpRevenueShareDistributionGateway(offline.port).prepare(prepareCommand);

    expect(first).toEqual({ ok: false, error: { kind: "unavailable" } });
    expect(second).toEqual({ ok: false, error: { kind: "network" } });
  });

  it.each([
    ["a missing distribution", {}],
    ["extra keys", { distribution: wirePrepared, extra: 1 }],
    ["a JSON number amount", { distribution: { ...wirePrepared, recipients: [{ accountId: RECIPIENT_A, amountStroops: 10_000_000 }] } }],
    ["a non-object body", []]
  ])("returns unknown for a malformed response: %s", async (_name, body) => {
    const { port } = http(body);

    const result = await new HttpRevenueShareDistributionGateway(port).prepare(prepareCommand);

    expect(result).toEqual({ ok: false, error: { kind: "unknown" } });
  });
});

describe("HttpRevenueShareDistributionGateway.submit", () => {
  it("posts the signed envelope to the submission path with the terms encoded as text", async () => {
    const { port, send } = http({ applied: true, distribution: wireSnapshot }, 202);

    await new HttpRevenueShareDistributionGateway(port).submit(submitCommand);

    expect(send).toHaveBeenCalledWith({
      method: "POST",
      path: `/revenue-share-distributions/${DISTRIBUTION_ID}/submission`,
      body: {
        signedXdr: "SIGNED-XDR",
        terms: wireTerms,
        applicationId: APPLICATION_ID,
        campaignId: CAMPAIGN_ID
      }
    });
  });

  it("distinguishes a first submission (202 applied) from an exact replay (200)", async () => {
    const first = http({ applied: true, distribution: wireSnapshot }, 202);
    const replay = http({ applied: false, distribution: wireSnapshot }, 200);

    const submitted = await new HttpRevenueShareDistributionGateway(first.port).submit(submitCommand);
    const replayed = await new HttpRevenueShareDistributionGateway(replay.port).submit(submitCommand);

    expect(submitted.ok && submitted.value.applied).toBe(true);
    expect(replayed.ok && replayed.value.applied).toBe(false);
    expect(replayed.ok && replayed.value.distribution.state).toBe("submitted");
  });

  it("maps a rejected signed envelope (422 xdr_rejected) without leaking the port's reason", async () => {
    const { port } = failing(new HttpClientError("http", 422));

    const result = await new HttpRevenueShareDistributionGateway(port).submit(submitCommand);

    expect(result).toEqual({ ok: false, error: { kind: "xdr_rejected" } });
    if (result.ok) throw new Error("expected failure");
    expect(Object.keys(result.error)).toEqual(["kind"]);
  });

  it("maps a re-derivation that no longer matches the signed terms (422 derivation_mismatch)", async () => {
    const { port } = failing(new HttpClientError("http", 422, undefined, "derivation_mismatch"));

    const result = await new HttpRevenueShareDistributionGateway(port).submit(submitCommand);

    expect(result).toEqual({ ok: false, error: { kind: "derivation_mismatch" } });
  });

  it("maps a derivation refusal and an already distributed period at submit too", async () => {
    const refused = failing(new HttpClientError("http", 409, undefined, "derivation_failed", "source_not_sme"));
    const repeated = failing(new HttpClientError("http", 409, undefined, "already_distributed"));

    const first = await new HttpRevenueShareDistributionGateway(refused.port).submit(submitCommand);
    const second = await new HttpRevenueShareDistributionGateway(repeated.port).submit(submitCommand);

    expect(first).toEqual({ ok: false, error: { kind: "derivation_failed", reason: "source_not_sme" } });
    expect(second).toEqual({ ok: false, error: { kind: "already_distributed" } });
  });

  it("posts the case the terms were derived for next to the signed envelope", async () => {
    const { port, send } = http({ applied: true, distribution: wireSnapshot }, 202);

    await new HttpRevenueShareDistributionGateway(port).submit(submitCommand);

    expect(send.mock.calls[0]?.[0].body).toMatchObject({ applicationId: APPLICATION_ID, campaignId: CAMPAIGN_ID });
  });

  it("maps an idempotency conflict (409) distinctly from another conflict", async () => {
    const conflict = failing(new HttpClientError("http", 409, undefined, "idempotency_conflict"));
    const other = failing(new HttpClientError("http", 409, undefined, "vault_mismatch"));

    const first = await new HttpRevenueShareDistributionGateway(conflict.port).submit(submitCommand);
    const second = await new HttpRevenueShareDistributionGateway(other.port).submit(submitCommand);

    expect(first).toEqual({ ok: false, error: { kind: "idempotency_conflict" } });
    expect(second).toEqual({ ok: false, error: { kind: "conflict" } });
  });

  it.each([
    ["a missing applied flag", { distribution: wireSnapshot }],
    ["a non-boolean applied flag", { applied: "yes", distribution: wireSnapshot }],
    ["a drifted snapshot", { applied: true, distribution: { ...wireSnapshot, state: "manual_review" } }],
    ["a JSON number amount", { applied: true, distribution: { ...wireSnapshot, recipients: [{ accountId: RECIPIENT_A, amountStroops: 10_000_000 }] } }],
    ["extra keys", { applied: true, distribution: wireSnapshot, extra: 1 }]
  ])("returns unknown for a malformed response: %s", async (_name, body) => {
    const { port } = http(body, 202);

    const result = await new HttpRevenueShareDistributionGateway(port).submit(submitCommand);

    expect(result).toEqual({ ok: false, error: { kind: "unknown" } });
  });
});

describe("HttpRevenueShareDistributionGateway.getStatus", () => {
  it("reads the distribution back and parses the reported snapshot", async () => {
    const { port, send } = http({ distribution: wireSnapshot });

    const result = await new HttpRevenueShareDistributionGateway(port).getStatus(
      DISTRIBUTION_ID as RevenueShareDistributionId
    );

    expect(send).toHaveBeenCalledWith({
      method: "GET",
      path: `/revenue-share-distributions/${DISTRIBUTION_ID}`
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(result.value.state).toBe("submitted");
    expect(result.value.transactionHash).toBe(TRANSACTION_HASH);
    expect(result.value.recipients).toEqual(parsedRecipients);
  });

  it("parses the explorer URL the service supplied rather than composing one", async () => {
    const { port } = http({ distribution: wireSnapshot });

    const result = await new HttpRevenueShareDistributionGateway(port).getStatus(
      DISTRIBUTION_ID as RevenueShareDistributionId
    );

    expect(result.ok && result.value.explorerUrl).toBe(EXPLORER_URL);
  });

  it("maps an unknown distribution (404) and an unavailable store (503)", async () => {
    const missing = failing(new HttpClientError("http", 404, undefined, "not_found"));
    const down = failing(new HttpClientError("http", 503));

    const first = await new HttpRevenueShareDistributionGateway(missing.port).getStatus(
      DISTRIBUTION_ID as RevenueShareDistributionId
    );
    const second = await new HttpRevenueShareDistributionGateway(down.port).getStatus(
      DISTRIBUTION_ID as RevenueShareDistributionId
    );

    expect(first).toEqual({ ok: false, error: { kind: "not_found" } });
    expect(second).toEqual({ ok: false, error: { kind: "unavailable" } });
  });

  it("returns unknown for an envelope that drifted", async () => {
    const { port } = http({ distribution: wireSnapshot, extra: 1 });

    const result = await new HttpRevenueShareDistributionGateway(port).getStatus(
      DISTRIBUTION_ID as RevenueShareDistributionId
    );

    expect(result).toEqual({ ok: false, error: { kind: "unknown" } });
  });
});
