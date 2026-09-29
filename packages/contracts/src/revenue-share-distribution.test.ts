import { describe, expect, expectTypeOf, it } from "vitest";
import {
  distributionRecipientSchema,
  parseDistributionRecipient,
  parsePrepareRevenueShareDistributionCommand,
  parsePreparedRevenueShareDistribution,
  parseRevenueShareDistributionId,
  parseRevenueShareDistributionSnapshot,
  parseRevenueShareDistributionState,
  parseRevenueShareDistributionTerms,
  parseSubmitRevenueShareDistributionCommand,
  prepareRevenueShareDistributionCommandSchema,
  preparedRevenueShareDistributionSchema,
  revenueShareDistributionIdSchema,
  revenueShareDistributionSnapshotSchema,
  revenueShareDistributionStateSchema,
  revenueShareDistributionTermsSchema,
  submitRevenueShareDistributionCommandSchema
} from "./index.js";
import type { DistributionRecipient, RevenueShareDistributionId } from "./index.js";

const VALID_DISTRIBUTION_ID = "123e4567-e89b-42d3-a456-426614174000";
const VALID_APPLICATION_ID = "87654321-4321-4abc-8def-123456789abc";
const VALID_CORRELATION_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_ACCOUNT_ID = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const RECIPIENT_ACCOUNT_ID = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const RECIPIENT_ACCOUNT_ID_TWO = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

const recipientOne: {
  accountId: string;
  amountStroops: string;
} = {
  accountId: RECIPIENT_ACCOUNT_ID,
  amountStroops: "10000000"
};

const recipientTwo: {
  accountId: string;
  amountStroops: string;
} = {
  accountId: RECIPIENT_ACCOUNT_ID_TWO,
  amountStroops: "25000000"
};

const validRecipients = [recipientOne, recipientTwo];

const validTerms: {
  network: string;
  networkPassphrase: string;
  sourceAccountId: string;
  sourceSequence: string;
  memo: string | null;
  expiresAt: string;
  recipients: { accountId: string; amountStroops: string }[];
} = {
  network: "testnet",
  networkPassphrase: NETWORK_PASSPHRASE,
  sourceAccountId: SOURCE_ACCOUNT_ID,
  sourceSequence: "1234567890",
  memo: null,
  expiresAt: "2026-09-21T12:00:00.000Z",
  recipients: validRecipients
};

const validPrepareCommand: {
  sourceAccountId: string;
  recipients: { accountId: string; amountStroops: string }[];
  memo: string | null;
  applicationId: string | null;
} = {
  sourceAccountId: SOURCE_ACCOUNT_ID,
  recipients: validRecipients,
  memo: null,
  applicationId: null
};

const validPreparedDistribution = {
  distributionId: VALID_DISTRIBUTION_ID,
  xdr: "AAAAAgAAAABfakeUnsignedEnvelope",
  applicationId: null as string | null,
  ...validTerms
};

const validSubmitCommand = {
  signedXdr: "AAAAAgAAAABfakeSignedEnvelope",
  terms: validTerms,
  applicationId: null as string | null
};

const validSnapshot = {
  distributionId: VALID_DISTRIBUTION_ID,
  ...validTerms,
  state: "submitted",
  transactionHash: "d0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f",
  applicationId: null as string | null,
  // Derived by the API from the hash it already persists, never stored.
  explorerUrl: "https://stellar.expert/explorer/testnet/tx/d0a1b2c3",
  // Absent unless the distribution failed, which the schema enforces in both
  // directions rather than leaving to the reader.
  failureReason: null as string | null,
  lastCorrelationId: VALID_CORRELATION_ID,
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:05.000Z"
};

describe("revenueShareDistributionIdSchema", () => {
  it("parses a UUIDv4 into a branded identifier", () => {
    const parsed = parseRevenueShareDistributionId(VALID_DISTRIBUTION_ID);

    expect(parsed).toBe(VALID_DISTRIBUTION_ID);
    expectTypeOf(parsed).toEqualTypeOf<RevenueShareDistributionId>();
  });

  it.each([
    ["a UUIDv1", "123e4567-e89b-12d3-a456-426614174000"],
    ["a non-UUID string", "not-a-uuid"],
    ["a number", 1],
    ["null", null]
  ])("rejects %s", (_description, value) => {
    expect(revenueShareDistributionIdSchema.safeParse(value).success).toBe(false);
  });
});

describe("distributionRecipientSchema", () => {
  it("parses a recipient and yields a bigint amount", () => {
    const parsed = parseDistributionRecipient(recipientOne);

    expect(parsed.accountId).toBe(RECIPIENT_ACCOUNT_ID);
    expect(parsed.amountStroops).toBe(10_000_000n);
    expectTypeOf(parsed.amountStroops).toEqualTypeOf<bigint>();
    expectTypeOf(parsed).toEqualTypeOf<DistributionRecipient>();
  });

  it.each(Object.keys(recipientOne))("rejects a recipient missing %s", (key) => {
    const input: Record<string, unknown> = { ...recipientOne };
    delete input[key];

    expect(distributionRecipientSchema.safeParse(input).success).toBe(false);
  });

  it("rejects a recipient carrying an unknown extra key", () => {
    // A recipient is exactly an (accountId, amountStroops) pair — the two facts
    // one payment encodes. A contributor id is not an envelope fact, so the
    // strict object refuses it instead of silently dropping it.
    expect(
      distributionRecipientSchema.safeParse({ ...recipientOne, contributorId: "contributor-1" }).success
    ).toBe(false);
    expect(
      distributionRecipientSchema.safeParse({ ...recipientOne, extra: "unexpected" }).success
    ).toBe(false);
  });

  it.each([
    ["a contract address", "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"],
    ["an address one character short", "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWH"],
    ["an address with lowercase characters", "gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"],
    ["an empty account", ""],
    ["a JSON number amount", { amountStroops: 10_000_000 }],
    ["a zero amount", { amountStroops: "0" }]
  ])("rejects %s", (_description, override) => {
    const input =
      typeof override === "string"
        ? { ...recipientOne, accountId: override }
        : { ...recipientOne, ...override };

    expect(distributionRecipientSchema.safeParse(input).success).toBe(false);
  });
});

describe("revenueShareDistributionStateSchema", () => {
  it("accepts exactly the three states the demo can produce", () => {
    expect(revenueShareDistributionStateSchema.options).toEqual(["submitted", "confirmed", "failed"]);
    expect(parseRevenueShareDistributionState("submitted")).toBe("submitted");
    expect(parseRevenueShareDistributionState("confirmed")).toBe("confirmed");
    expect(parseRevenueShareDistributionState("failed")).toBe("failed");
  });

  it.each([
    ["a near-miss casing", "Submitted"],
    ["a production-roadmap state", "awaiting_signature"],
    ["an unrelated value", "pending"],
    ["a numeric value", 1],
    ["a null value", null]
  ])("rejects %s", (_description, value) => {
    expect(revenueShareDistributionStateSchema.safeParse(value).success).toBe(false);
  });
});

describe("revenueShareDistributionTermsSchema", () => {
  it("parses the declared terms and yields bigint amounts", () => {
    const parsed = parseRevenueShareDistributionTerms(validTerms);

    expect(parsed.network).toBe("testnet");
    expect(parsed.networkPassphrase).toBe(NETWORK_PASSPHRASE);
    expect(parsed.sourceSequence).toBe("1234567890");
    expect(parsed.memo).toBeNull();
    expect(parsed.recipients).toHaveLength(2);
    expect(parsed.recipients[0]?.amountStroops).toBe(10_000_000n);
    expect(parsed.recipients[1]?.amountStroops).toBe(25_000_000n);
  });

  it("preserves an amount beyond Number.MAX_SAFE_INTEGER exactly", () => {
    const parsed = parseRevenueShareDistributionTerms({
      ...validTerms,
      recipients: [{ ...recipientOne, amountStroops: "9223372036854775807" }]
    });

    expect(parsed.recipients[0]?.amountStroops).toBe(9_223_372_036_854_775_807n);
  });

  it("trims a present memo", () => {
    const parsed = parseRevenueShareDistributionTerms({ ...validTerms, memo: "  payout  " });

    expect(parsed.memo).toBe("payout");
  });

  it("accepts a 28-byte memo and a zero sequence", () => {
    const parsed = parseRevenueShareDistributionTerms({
      ...validTerms,
      memo: "m".repeat(28),
      sourceSequence: "0"
    });

    expect(parsed.memo).toHaveLength(28);
    expect(parsed.sourceSequence).toBe("0");
  });

  it("counts a memo's cap in UTF-8 bytes, not characters", () => {
    // "ñ" is two bytes, so fourteen fill the 28-byte cap exactly...
    expect(parseRevenueShareDistributionTerms({ ...validTerms, memo: "ñ".repeat(14) }).memo).toBe(
      "ñ".repeat(14)
    );

    // ...and fifteen exceed it, even though fifteen is well under 28 characters.
    expect(revenueShareDistributionTermsSchema.safeParse({ ...validTerms, memo: "ñ".repeat(15) }).success).toBe(
      false
    );

    // An astral character is four bytes, not the two its UTF-16 length implies.
    expect(revenueShareDistributionTermsSchema.safeParse({ ...validTerms, memo: "🙂".repeat(7) }).success).toBe(
      true
    );
    expect(revenueShareDistributionTermsSchema.safeParse({ ...validTerms, memo: "🙂".repeat(8) }).success).toBe(
      false
    );
  });

  it.each(Object.keys(validTerms))("rejects terms missing %s", (key) => {
    const input: Record<string, unknown> = { ...validTerms };
    delete input[key];

    expect(revenueShareDistributionTermsSchema.safeParse(input).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      revenueShareDistributionTermsSchema.safeParse({ ...validTerms, extra: "unexpected" }).success
    ).toBe(false);
  });

  it("rejects an empty recipient list", () => {
    expect(revenueShareDistributionTermsSchema.safeParse({ ...validTerms, recipients: [] }).success).toBe(
      false
    );
  });

  it("rejects a duplicate recipient account", () => {
    const result = revenueShareDistributionTermsSchema.safeParse({
      ...validTerms,
      recipients: [recipientOne, { ...recipientTwo, accountId: RECIPIENT_ACCOUNT_ID }]
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["a memo over 28 bytes", { memo: "m".repeat(29) }],
    ["a JSON number amount", { recipients: [{ ...recipientOne, amountStroops: 10_000_000 }] }],
    ["a zero amount", { recipients: [{ ...recipientOne, amountStroops: "0" }] }],
    ["an empty network", { network: "   " }],
    ["an empty passphrase", { networkPassphrase: "" }],
    ["an empty source account", { sourceAccountId: "" }],
    ["a bad recipient account", { recipients: [{ ...recipientOne, accountId: "not-an-address" }] }],
    ["a negative sequence", { sourceSequence: "-1" }],
    ["a fractional sequence", { sourceSequence: "1.5" }],
    ["a sequence beyond uint64", { sourceSequence: "18446744073709551616" }],
    ["a datetime without an offset", { expiresAt: "2026-09-21T12:00:00" }],
    ["a malformed datetime", { expiresAt: "September 21, 2026" }]
  ])("rejects %s", (_description, override) => {
    expect(revenueShareDistributionTermsSchema.safeParse({ ...validTerms, ...override }).success).toBe(false);
  });
});

describe("prepareRevenueShareDistributionCommandSchema", () => {
  it("parses a valid command and yields bigint amounts", () => {
    const parsed = parsePrepareRevenueShareDistributionCommand(validPrepareCommand);

    expect(parsed.sourceAccountId).toBe(SOURCE_ACCOUNT_ID);
    expect(parsed.recipients[0]?.amountStroops).toBe(10_000_000n);
    expectTypeOf(parsed.recipients[0]?.amountStroops).toEqualTypeOf<bigint | undefined>();
    expect(parsed.memo).toBeNull();
    expect(parsed.applicationId).toBeNull();
  });

  it("accepts a present memo and a present application link", () => {
    const parsed = parsePrepareRevenueShareDistributionCommand({
      ...validPrepareCommand,
      memo: "payout",
      applicationId: VALID_APPLICATION_ID
    });

    expect(parsed.memo).toBe("payout");
    expect(parsed.applicationId).toBe(VALID_APPLICATION_ID);
  });

  it.each(Object.keys(validPrepareCommand))("rejects a command missing %s", (key) => {
    const input: Record<string, unknown> = { ...validPrepareCommand };
    delete input[key];

    expect(prepareRevenueShareDistributionCommandSchema.safeParse(input).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      prepareRevenueShareDistributionCommandSchema.safeParse({
        ...validPrepareCommand,
        extra: "unexpected"
      }).success
    ).toBe(false);
  });

  it("rejects a command whose recipient is the source account", () => {
    const result = prepareRevenueShareDistributionCommandSchema.safeParse({
      ...validPrepareCommand,
      recipients: [{ ...recipientOne, accountId: SOURCE_ACCOUNT_ID }]
    });

    expect(result.success).toBe(false);
  });

  it("compares the trimmed source account, not the raw input", () => {
    const result = prepareRevenueShareDistributionCommandSchema.safeParse({
      ...validPrepareCommand,
      sourceAccountId: `  ${RECIPIENT_ACCOUNT_ID}  `
    });

    expect(result.success).toBe(false);
  });

  it("rejects a duplicate recipient account", () => {
    const result = prepareRevenueShareDistributionCommandSchema.safeParse({
      ...validPrepareCommand,
      recipients: [recipientOne, { ...recipientTwo, accountId: RECIPIENT_ACCOUNT_ID }]
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["an empty recipient list", { recipients: [] }],
    ["a JSON number amount", { recipients: [{ ...recipientOne, amountStroops: 10_000_000 }] }],
    ["a zero amount", { recipients: [{ ...recipientOne, amountStroops: "0" }] }],
    ["a memo over 28 bytes", { memo: "m".repeat(29) }],
    ["a malformed application ID", { applicationId: "not-a-uuid" }],
    ["an empty source account", { sourceAccountId: "" }]
  ])("rejects %s", (_description, override) => {
    expect(
      prepareRevenueShareDistributionCommandSchema.safeParse({ ...validPrepareCommand, ...override }).success
    ).toBe(false);
  });
});

describe("preparedRevenueShareDistributionSchema", () => {
  it("parses the prepared distribution: the terms plus the id and the XDR", () => {
    const parsed = parsePreparedRevenueShareDistribution(validPreparedDistribution);

    expect(parsed.distributionId).toBe(VALID_DISTRIBUTION_ID);
    expect(parsed.xdr).toBe(validPreparedDistribution.xdr);
    expect(parsed.recipients[0]?.amountStroops).toBe(10_000_000n);
    expect(parsed.applicationId).toBeNull();
  });

  it("carries a declared application link alongside the terms", () => {
    const parsed = parsePreparedRevenueShareDistribution({
      ...validPreparedDistribution,
      applicationId: VALID_APPLICATION_ID
    });

    expect(parsed.applicationId).toBe(VALID_APPLICATION_ID);
    // The link is declared metadata, not a term: it is not in the envelope and
    // so it is deliberately absent from the terms object.
    expect(revenueShareDistributionTermsSchema.safeParse({ ...validTerms, applicationId: null }).success).toBe(
      false
    );
  });

  it.each(["distributionId", "xdr", "applicationId", ...Object.keys(validTerms)])(
    "rejects a prepared distribution missing %s",
    (key) => {
      const input: Record<string, unknown> = { ...validPreparedDistribution };
      delete input[key];

      expect(preparedRevenueShareDistributionSchema.safeParse(input).success).toBe(false);
    }
  );

  it("inherits the terms' duplicate-recipient refusal", () => {
    const result = preparedRevenueShareDistributionSchema.safeParse({
      ...validPreparedDistribution,
      recipients: [recipientOne, { ...recipientTwo, accountId: RECIPIENT_ACCOUNT_ID }]
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["a malformed distribution ID", { distributionId: "not-a-uuid" }],
    ["an empty XDR", { xdr: "" }],
    ["a malformed application ID", { applicationId: "not-a-uuid" }],
    ["a malformed terms object", { recipients: [] }]
  ])("rejects %s", (_description, override) => {
    expect(preparedRevenueShareDistributionSchema.safeParse({ ...validPreparedDistribution, ...override }).success).toBe(
      false
    );
  });

  it("rejects unknown keys", () => {
    expect(
      preparedRevenueShareDistributionSchema.safeParse({ ...validPreparedDistribution, extra: "unexpected" })
        .success
    ).toBe(false);
  });
});

describe("submitRevenueShareDistributionCommandSchema", () => {
  it("parses a valid submit command", () => {
    const parsed = parseSubmitRevenueShareDistributionCommand(validSubmitCommand);

    expect(parsed.signedXdr).toBe(validSubmitCommand.signedXdr);
    expect(parsed.terms.recipients[1]?.amountStroops).toBe(25_000_000n);
    expect(parsed.applicationId).toBeNull();
  });

  it("accepts a declared application link", () => {
    const parsed = parseSubmitRevenueShareDistributionCommand({
      ...validSubmitCommand,
      applicationId: VALID_APPLICATION_ID
    });

    expect(parsed.applicationId).toBe(VALID_APPLICATION_ID);
  });

  it.each(["signedXdr", "terms", "applicationId"])("rejects a submit command missing %s", (key) => {
    const input: Record<string, unknown> = { ...validSubmitCommand };
    delete input[key];

    expect(submitRevenueShareDistributionCommandSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    ["an empty signed XDR", { signedXdr: "" }],
    ["a non-string signed XDR", { signedXdr: 42 }],
    ["a malformed application ID", { applicationId: "not-a-uuid" }],
    ["an application link smuggled into the terms", { terms: { ...validTerms, applicationId: null } }],
    ["a malformed terms object", { terms: { network: "testnet" } }],
    ["terms with an unknown key", { terms: { ...validTerms, extra: "unexpected" } }],
    [
      "terms with a duplicate recipient",
      {
        terms: {
          ...validTerms,
          recipients: [recipientOne, { ...recipientTwo, accountId: RECIPIENT_ACCOUNT_ID }]
        }
      }
    ],
    ["terms carrying a JSON number amount", { terms: { ...validTerms, recipients: [{ ...recipientOne, amountStroops: 10_000_000 }] } }]
  ])("rejects %s", (_description, override) => {
    expect(submitRevenueShareDistributionCommandSchema.safeParse({ ...validSubmitCommand, ...override }).success).toBe(
      false
    );
  });

  it("rejects unknown top-level keys", () => {
    expect(
      submitRevenueShareDistributionCommandSchema.safeParse({ ...validSubmitCommand, extra: "unexpected" }).success
    ).toBe(false);
  });
});

describe("revenueShareDistributionSnapshotSchema", () => {
  it("parses a snapshot with a null application link", () => {
    const parsed = parseRevenueShareDistributionSnapshot(validSnapshot);

    expect(parsed.distributionId).toBe(VALID_DISTRIBUTION_ID);
    expect(parsed.state).toBe("submitted");
    expect(parsed.recipients[0]?.amountStroops).toBe(10_000_000n);
    expect(parsed.applicationId).toBeNull();
    expect(parsed.lastCorrelationId).toBe(VALID_CORRELATION_ID);
  });

  it("accepts a snapshot with an application link", () => {
    const parsed = parseRevenueShareDistributionSnapshot({
      ...validSnapshot,
      applicationId: VALID_APPLICATION_ID
    });

    expect(parsed.applicationId).toBe(VALID_APPLICATION_ID);
  });

  it.each(Object.keys(validSnapshot))("rejects a snapshot missing %s", (key) => {
    const input: Record<string, unknown> = { ...validSnapshot };
    delete input[key];

    expect(revenueShareDistributionSnapshotSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    ["a malformed distribution ID", { distributionId: "not-a-uuid" }],
    ["a malformed correlation ID", { lastCorrelationId: "not-a-uuid" }],
    ["a malformed application ID", { applicationId: "not-a-uuid" }],
    ["a state the demo cannot produce", { state: "manual_review" }],
    ["a JSON number amount", { recipients: [{ ...recipientOne, amountStroops: 10_000_000 }] }],
    ["an empty recipient list", { recipients: [] }],
    ["an empty transaction hash", { transactionHash: "" }],
    ["a relative explorer link", { explorerUrl: "/explorer/testnet/tx/abc" }],
    ["an explorer link that is not a URL", { explorerUrl: "stellar.expert" }],
    ["a datetime without an offset", { createdAt: "2026-09-21T12:00:00" }]
  ])("rejects %s", (_description, override) => {
    expect(revenueShareDistributionSnapshotSchema.safeParse({ ...validSnapshot, ...override }).success).toBe(false);
  });

  it("accepts a failed distribution that carries a reason", () => {
    const parsed = parseRevenueShareDistributionSnapshot({
      ...validSnapshot,
      state: "failed",
      failureReason: "insufficient_balance"
    });

    expect(parsed.state).toBe("failed");
    expect(parsed.failureReason).toBe("insufficient_balance");
  });

  it("accepts a confirmed distribution, which carries no reason", () => {
    const parsed = parseRevenueShareDistributionSnapshot({ ...validSnapshot, state: "confirmed" });

    expect(parsed.state).toBe("confirmed");
    expect(parsed.failureReason).toBeNull();
  });

  it.each([
    ["a failed distribution with no reason", { state: "failed", failureReason: null }],
    ["a submitted distribution that carries a reason", { state: "submitted", failureReason: "expired" }],
    ["a confirmed distribution that carries a reason", { state: "confirmed", failureReason: "expired" }]
  ])("rejects %s", (_description, override) => {
    // The equivalence form, mirroring the table's CHECK: a failed row without
    // its evidence and a non-failed row carrying evidence for a state it is not
    // in are both incoherent, and neither is merely untidy.
    expect(revenueShareDistributionSnapshotSchema.safeParse({ ...validSnapshot, ...override }).success).toBe(false);
  });

  it("refuses Horizon's own result code as a reason", () => {
    expect(
      revenueShareDistributionSnapshotSchema.safeParse({
        ...validSnapshot,
        state: "failed",
        failureReason: "tx_bad_seq"
      }).success
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      revenueShareDistributionSnapshotSchema.safeParse({ ...validSnapshot, extra: "unexpected" }).success
    ).toBe(false);
  });
});
