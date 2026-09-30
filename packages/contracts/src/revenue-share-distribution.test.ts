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
  parseRevenueShareDerivation,
  prepareRevenueShareDistributionCommandSchema,
  preparedRevenueShareDistributionSchema,
  revenueShareDerivationSchema,
  revenueShareDistributionIdSchema,
  revenueShareDistributionSnapshotSchema,
  revenueShareDistributionStateSchema,
  revenueShareDistributionTermsSchema,
  submitRevenueShareDistributionCommandSchema
} from "./index.js";
import type { DistributionRecipient, RevenueShareDistributionId } from "./index.js";

const VALID_DISTRIBUTION_ID = "123e4567-e89b-42d3-a456-426614174000";
const VALID_APPLICATION_ID = "87654321-4321-4abc-8def-123456789abc";
const VALID_CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";
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

/**
 * The prepare command carries NO recipients or amounts: the server derives them
 * from the campaign (T5a), so a client cannot declare who is paid or how much.
 */
const validPrepareCommand: {
  sourceAccountId: string;
  applicationId: string;
  campaignId: string;
  memo: string | null;
} = {
  sourceAccountId: SOURCE_ACCOUNT_ID,
  applicationId: VALID_APPLICATION_ID,
  campaignId: VALID_CAMPAIGN_ID,
  memo: null
};

/** The canonical example: 2026-08, 3,745,800 ARS x 450 bps floor = 168,561 ARS. */
const validDerivation = {
  ruleVersion: "RS-2026-01",
  rateBps: 450,
  period: "2026-08",
  salesArs: "3745800",
  obligationArs: "168561",
  excludedPeriods: [
    { period: "2026-04", status: "missing", reason: "missing_data" },
    { period: "2026-06", status: "anomalous", reason: "requires_review" }
  ],
  conversion: {
    goalStroops: "1000000000",
    approvedLimitArs: "5000000",
    totalStroops: "33712200"
  },
  simulated: true
};

const validPreparedDistribution = {
  distributionId: VALID_DISTRIBUTION_ID,
  xdr: "AAAAAgAAAABfakeUnsignedEnvelope",
  applicationId: VALID_APPLICATION_ID as string,
  campaignId: VALID_CAMPAIGN_ID as string,
  derivation: validDerivation,
  ...validTerms
};

const validSubmitCommand = {
  signedXdr: "AAAAAgAAAABfakeSignedEnvelope",
  terms: validTerms,
  applicationId: VALID_APPLICATION_ID as string,
  campaignId: VALID_CAMPAIGN_ID as string
};

const validSnapshot = {
  distributionId: VALID_DISTRIBUTION_ID,
  ...validTerms,
  state: "submitted",
  transactionHash: "d0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f",
  applicationId: null as string | null,
  campaignId: null as string | null,
  // The YYYY-MM period the distribution settled; null for one recorded before it was persisted.
  period: null as string | null,
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

  it("rejects a recipient equal to the source account", () => {
    const result = revenueShareDistributionTermsSchema.safeParse({
      ...validTerms,
      recipients: [{ ...recipientOne, accountId: SOURCE_ACCOUNT_ID }]
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["a contract address", "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"],
    ["a non-account string", "not-a-stellar-address"],
    ["a whitespace-padded key", `  ${SOURCE_ACCOUNT_ID}  `]
  ])("rejects a source account that is %s", (_description, sourceAccountId) => {
    expect(revenueShareDistributionTermsSchema.safeParse({ ...validTerms, sourceAccountId }).success).toBe(
      false
    );
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
  it("parses a valid command that names the case, never the recipients", () => {
    const parsed = parsePrepareRevenueShareDistributionCommand(validPrepareCommand);

    expect(parsed.sourceAccountId).toBe(SOURCE_ACCOUNT_ID);
    expect(parsed.applicationId).toBe(VALID_APPLICATION_ID);
    expect(parsed.campaignId).toBe(VALID_CAMPAIGN_ID);
    expect(parsed.memo).toBeNull();
    expect(parsed).not.toHaveProperty("recipients");
  });

  it("accepts a present memo", () => {
    expect(parsePrepareRevenueShareDistributionCommand({ ...validPrepareCommand, memo: "payout" }).memo).toBe(
      "payout"
    );
  });

  it.each(Object.keys(validPrepareCommand))("rejects a command missing %s", (key) => {
    const input: Record<string, unknown> = { ...validPrepareCommand };
    delete input[key];

    expect(prepareRevenueShareDistributionCommandSchema.safeParse(input).success).toBe(false);
  });

  it("rejects client-supplied recipients: the server derives them", () => {
    expect(
      prepareRevenueShareDistributionCommandSchema.safeParse({ ...validPrepareCommand, recipients: validRecipients })
        .success
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      prepareRevenueShareDistributionCommandSchema.safeParse({
        ...validPrepareCommand,
        extra: "unexpected"
      }).success
    ).toBe(false);
  });

  it.each([
    ["a contract address", "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"],
    ["a non-account string", "not-a-stellar-address"],
    ["a whitespace-padded key", `  ${SOURCE_ACCOUNT_ID}  `]
  ])("rejects a source account that is %s", (_description, sourceAccountId) => {
    expect(
      prepareRevenueShareDistributionCommandSchema.safeParse({ ...validPrepareCommand, sourceAccountId }).success
    ).toBe(false);
  });

  it.each([
    ["a memo over 28 bytes", { memo: "m".repeat(29) }],
    ["a malformed application ID", { applicationId: "not-a-uuid" }],
    ["a null application ID", { applicationId: null }],
    ["a malformed campaign ID", { campaignId: "not-a-uuid" }],
    ["a null campaign ID", { campaignId: null }],
    ["an empty source account", { sourceAccountId: "" }]
  ])("rejects %s", (_description, override) => {
    expect(
      prepareRevenueShareDistributionCommandSchema.safeParse({ ...validPrepareCommand, ...override }).success
    ).toBe(false);
  });
});

describe("revenueShareDerivationSchema", () => {
  it("parses the canonical 2026-08 derivation and keeps money as decimal strings", () => {
    const parsed = parseRevenueShareDerivation(validDerivation);

    expect(parsed.period).toBe("2026-08");
    expect(parsed.salesArs).toBe("3745800");
    expect(parsed.obligationArs).toBe("168561");
    expect(parsed.conversion.totalStroops).toBe("33712200");
    expect(parsed.simulated).toBe(true);
  });

  it.each(Object.keys(validDerivation))("rejects a derivation missing %s", (key) => {
    const input: Record<string, unknown> = { ...validDerivation };
    delete input[key];

    expect(revenueShareDerivationSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    ["a JSON number amount", { salesArs: 3_745_800 }],
    ["a fractional amount", { obligationArs: "168561.5" }],
    ["a negative amount", { obligationArs: "-1" }],
    ["a malformed period", { period: "2026-13" }],
    ["a rate that is not an integer", { rateBps: 4.5 }],
    ["a derivation that is not labeled simulated", { simulated: false }],
    ["an excluded period with an unknown reason", { excludedPeriods: [{ period: "2026-04", status: "missing", reason: "other" }] }],
    ["a conversion with an unknown key", { conversion: { ...validDerivation.conversion, extra: "1" } }]
  ])("rejects %s", (_description, override) => {
    expect(revenueShareDerivationSchema.safeParse({ ...validDerivation, ...override }).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(revenueShareDerivationSchema.safeParse({ ...validDerivation, extra: "unexpected" }).success).toBe(false);
  });
});

describe("preparedRevenueShareDistributionSchema", () => {
  it("parses the prepared distribution: the terms plus the id and the XDR", () => {
    const parsed = parsePreparedRevenueShareDistribution(validPreparedDistribution);

    expect(parsed.distributionId).toBe(VALID_DISTRIBUTION_ID);
    expect(parsed.xdr).toBe(validPreparedDistribution.xdr);
    expect(parsed.recipients[0]?.amountStroops).toBe(10_000_000n);
    expect(parsed.applicationId).toBe(VALID_APPLICATION_ID);
    expect(parsed.campaignId).toBe(VALID_CAMPAIGN_ID);
    expect(parsed.derivation.obligationArs).toBe("168561");
  });

  it("carries the case ids alongside the terms, not inside them", () => {
    const parsed = parsePreparedRevenueShareDistribution(validPreparedDistribution);

    expect(parsed.applicationId).toBe(VALID_APPLICATION_ID);
    // The link is declared metadata, not a term: it is not in the envelope and
    // so it is deliberately absent from the terms object.
    expect(revenueShareDistributionTermsSchema.safeParse({ ...validTerms, applicationId: null }).success).toBe(
      false
    );
  });

  it.each(["distributionId", "xdr", "applicationId", "campaignId", "derivation", ...Object.keys(validTerms)])(
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
    ["a null application ID", { applicationId: null }],
    ["a malformed campaign ID", { campaignId: "not-a-uuid" }],
    ["a malformed derivation", { derivation: { ...validDerivation, simulated: false } }],
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
    expect(parsed.applicationId).toBe(VALID_APPLICATION_ID);
    expect(parsed.campaignId).toBe(VALID_CAMPAIGN_ID);
  });

  it("rejects terms whose recipient is the source account", () => {
    const result = submitRevenueShareDistributionCommandSchema.safeParse({
      ...validSubmitCommand,
      terms: { ...validTerms, recipients: [{ ...recipientOne, accountId: SOURCE_ACCOUNT_ID }] }
    });

    expect(result.success).toBe(false);
  });

  it.each(["signedXdr", "terms", "applicationId", "campaignId"])("rejects a submit command missing %s", (key) => {
    const input: Record<string, unknown> = { ...validSubmitCommand };
    delete input[key];

    expect(submitRevenueShareDistributionCommandSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    ["an empty signed XDR", { signedXdr: "" }],
    ["a non-string signed XDR", { signedXdr: 42 }],
    ["a malformed application ID", { applicationId: "not-a-uuid" }],
    ["a null application ID", { applicationId: null }],
    ["a malformed campaign ID", { campaignId: "not-a-uuid" }],
    ["a null campaign ID", { campaignId: null }],
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
  it("carries the settled period, null for a legacy row, and requires the field to be present", () => {
    expect(parseRevenueShareDistributionSnapshot({ ...validSnapshot, period: "2026-08" }).period).toBe("2026-08");
    expect(parseRevenueShareDistributionSnapshot(validSnapshot).period).toBeNull();

    const missing: Record<string, unknown> = { ...validSnapshot };
    delete missing["period"];
    expect(revenueShareDistributionSnapshotSchema.safeParse(missing).success).toBe(false);
    expect(revenueShareDistributionSnapshotSchema.safeParse({ ...validSnapshot, period: "2026-13" }).success).toBe(
      false
    );
  });

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

  it("accepts a snapshot with a campaign link and requires the field to be present", () => {
    expect(parseRevenueShareDistributionSnapshot({ ...validSnapshot, campaignId: VALID_CAMPAIGN_ID }).campaignId).toBe(
      VALID_CAMPAIGN_ID
    );
    expect(parseRevenueShareDistributionSnapshot(validSnapshot).campaignId).toBeNull();

    const missing: Record<string, unknown> = { ...validSnapshot };
    delete missing["campaignId"];
    expect(revenueShareDistributionSnapshotSchema.safeParse(missing).success).toBe(false);
    expect(
      revenueShareDistributionSnapshotSchema.safeParse({ ...validSnapshot, campaignId: "not-a-uuid" }).success
    ).toBe(false);
  });

  it("rejects a duplicate recipient account", () => {
    const result = revenueShareDistributionSnapshotSchema.safeParse({
      ...validSnapshot,
      recipients: [recipientOne, { ...recipientTwo, accountId: RECIPIENT_ACCOUNT_ID }]
    });

    expect(result.success).toBe(false);
  });

  it("rejects a recipient equal to the source account", () => {
    const result = revenueShareDistributionSnapshotSchema.safeParse({
      ...validSnapshot,
      recipients: [{ ...recipientOne, accountId: SOURCE_ACCOUNT_ID }]
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["a contract address", "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"],
    ["a non-account string", "not-a-stellar-address"],
    ["a whitespace-padded key", `  ${SOURCE_ACCOUNT_ID}  `]
  ])("rejects a source account that is %s", (_description, sourceAccountId) => {
    expect(revenueShareDistributionSnapshotSchema.safeParse({ ...validSnapshot, sourceAccountId }).success).toBe(
      false
    );
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
