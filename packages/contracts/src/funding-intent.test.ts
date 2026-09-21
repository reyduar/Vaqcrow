import { describe, expect, expectTypeOf, it } from "vitest";
import {
  fundingIntentSnapshotSchema,
  fundingIntentStateSchema,
  fundingIntentTermsSchema,
  parseFundingIntentSnapshot,
  parseFundingIntentState,
  parseFundingIntentTerms,
  parsePrepareFundingIntentCommand,
  parsePreparedFundingIntent,
  parseStroops,
  parseSubmitFundingIntentCommand,
  prepareFundingIntentCommandSchema,
  preparedFundingIntentSchema,
  stroopsSchema,
  submitFundingIntentCommandSchema
} from "./index.js";

const VALID_INTENT_ID = "123e4567-e89b-42d3-a456-426614174000";
const VALID_APPLICATION_ID = "87654321-4321-4abc-8def-123456789abc";
const VALID_CORRELATION_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_ACCOUNT_ID = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37";
const DESTINATION_ACCOUNT_ID = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

const validPrepareCommand: {
  sourceAccountId: string;
  destinationAccountId: string;
  amountStroops: string;
  memo: string | null;
  applicationId: string | null;
} = {
  sourceAccountId: SOURCE_ACCOUNT_ID,
  destinationAccountId: DESTINATION_ACCOUNT_ID,
  amountStroops: "10000000",
  memo: null,
  applicationId: null
};

const validTerms: {
  network: string;
  networkPassphrase: string;
  sourceAccountId: string;
  sourceSequence: string;
  destinationAccountId: string;
  amountStroops: string;
  memo: string | null;
  expiresAt: string;
} = {
  network: "testnet",
  networkPassphrase: NETWORK_PASSPHRASE,
  sourceAccountId: SOURCE_ACCOUNT_ID,
  sourceSequence: "1234567890",
  destinationAccountId: DESTINATION_ACCOUNT_ID,
  amountStroops: "10000000",
  memo: null,
  expiresAt: "2026-09-21T12:00:00.000Z"
};

const validPreparedIntent = {
  intentId: VALID_INTENT_ID,
  xdr: "AAAAAgAAAABfakeUnsignedEnvelope",
  applicationId: null,
  ...validTerms
};

const validSubmitCommand = {
  signedXdr: "AAAAAgAAAABfakeSignedEnvelope",
  intent: validTerms,
  applicationId: null
};

const validSnapshot = {
  intentId: VALID_INTENT_ID,
  ...validTerms,
  state: "submitted",
  transactionHash: "d0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f",
  applicationId: null,
  lastCorrelationId: VALID_CORRELATION_ID,
  createdAt: "2026-09-21T12:00:00.000Z",
  updatedAt: "2026-09-21T12:00:05.000Z"
};

describe("stroopsSchema", () => {
  it("parses a positive decimal integer string into a bigint", () => {
    const parsed = parseStroops("10000000");

    expect(parsed).toBe(10_000_000n);
    expectTypeOf(parsed).toEqualTypeOf<bigint>();
    expect(typeof parsed).toBe("bigint");
  });

  it("preserves an amount beyond Number.MAX_SAFE_INTEGER exactly", () => {
    const parsed = parseStroops("9223372036854775807");

    expect(parsed).toBe(9_223_372_036_854_775_807n);
  });

  it.each([
    ["a JSON number", 10_000_000],
    ["a zero number", 0],
    ["a bigint", 10_000_000n],
    ["null", null],
    ["undefined", undefined],
    ["a zero string", "0"],
    ["a negative string", "-1"],
    ["a fractional string", "1.5"],
    ["an exponent string", "1e7"],
    ["a leading-zero string", "007"],
    ["a string with surrounding whitespace", " 10000000 "],
    ["a non-numeric string", "ten million"],
    ["an empty string", ""]
  ])("rejects %s", (_description, input) => {
    expect(stroopsSchema.safeParse(input).success).toBe(false);
  });
});

describe("fundingIntentStateSchema", () => {
  it("accepts exactly the submitted state", () => {
    expect(fundingIntentStateSchema.options).toEqual(["submitted"]);
    expect(parseFundingIntentState("submitted")).toBe("submitted");
  });

  it.each([
    ["a near-miss casing", "Submitted"],
    ["a production-roadmap state", "confirmed"],
    ["a production-roadmap state", "draft"],
    ["an unrelated value", "pending"],
    ["a numeric value", 1],
    ["a null value", null]
  ])("rejects %s", (_description, value) => {
    expect(fundingIntentStateSchema.safeParse(value).success).toBe(false);
  });
});

describe("fundingIntentTermsSchema", () => {
  it("parses the declared terms and yields a bigint amount", () => {
    const parsed = parseFundingIntentTerms(validTerms);

    expect(parsed.amountStroops).toBe(10_000_000n);
    expect(parsed.network).toBe("testnet");
    expect(parsed.networkPassphrase).toBe(NETWORK_PASSPHRASE);
    expect(parsed.sourceSequence).toBe("1234567890");
    expect(parsed.memo).toBeNull();
  });

  it("trims a present memo", () => {
    const parsed = parseFundingIntentTerms({ ...validTerms, memo: "  funding  " });

    expect(parsed.memo).toBe("funding");
  });

  it("accepts a 28-byte memo and a zero sequence", () => {
    const parsed = parseFundingIntentTerms({
      ...validTerms,
      memo: "m".repeat(28),
      sourceSequence: "0"
    });

    expect(parsed.memo).toHaveLength(28);
    expect(parsed.sourceSequence).toBe("0");
  });

  it("counts a memo's cap in UTF-8 bytes, not characters", () => {
    // "ñ" is two bytes, so fourteen of them fill the 28-byte cap exactly...
    expect(parseFundingIntentTerms({ ...validTerms, memo: "ñ".repeat(14) }).memo).toBe("ñ".repeat(14));

    // ...and fifteen exceed it, even though fifteen is well under 28 characters.
    // A character-based cap would have accepted this and the envelope builder
    // would then have refused it, in a Spanish-language demo most of all.
    expect(fundingIntentTermsSchema.safeParse({ ...validTerms, memo: "ñ".repeat(15) }).success).toBe(false);

    // An astral character is four bytes, not the two its UTF-16 length implies.
    expect(fundingIntentTermsSchema.safeParse({ ...validTerms, memo: "🙂".repeat(7) }).success).toBe(true);
    expect(fundingIntentTermsSchema.safeParse({ ...validTerms, memo: "🙂".repeat(8) }).success).toBe(false);
  });

  it.each(Object.keys(validTerms))("rejects terms missing %s", (key) => {
    const input: Record<string, unknown> = { ...validTerms };
    delete input[key];

    expect(fundingIntentTermsSchema.safeParse(input).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      fundingIntentTermsSchema.safeParse({ ...validTerms, extra: "unexpected" }).success
    ).toBe(false);
  });

  it.each([
    ["a memo over 28 bytes", { memo: "m".repeat(29) }],
    ["a JSON number amount", { amountStroops: 10_000_000 }],
    ["a zero amount", { amountStroops: "0" }],
    ["an empty network", { network: "   " }],
    ["an empty passphrase", { networkPassphrase: "" }],
    ["an empty source account", { sourceAccountId: "" }],
    ["an empty destination account", { destinationAccountId: "" }],
    ["a negative sequence", { sourceSequence: "-1" }],
    ["a fractional sequence", { sourceSequence: "1.5" }],
    ["a sequence beyond uint64", { sourceSequence: "18446744073709551616" }],
    ["a datetime without an offset", { expiresAt: "2026-09-21T12:00:00" }],
    ["a malformed datetime", { expiresAt: "September 21, 2026" }]
  ])("rejects %s", (_description, override) => {
    expect(fundingIntentTermsSchema.safeParse({ ...validTerms, ...override }).success).toBe(false);
  });
});

describe("prepareFundingIntentCommandSchema", () => {
  it("parses a valid command and yields a bigint amount", () => {
    const parsed = parsePrepareFundingIntentCommand(validPrepareCommand);

    expect(parsed.amountStroops).toBe(10_000_000n);
    expectTypeOf(parsed.amountStroops).toEqualTypeOf<bigint>();
    expect(parsed.memo).toBeNull();
    expect(parsed.applicationId).toBeNull();
  });

  it("accepts a present memo and a present application link", () => {
    const parsed = parsePrepareFundingIntentCommand({
      ...validPrepareCommand,
      memo: "funding",
      applicationId: VALID_APPLICATION_ID
    });

    expect(parsed.memo).toBe("funding");
    expect(parsed.applicationId).toBe(VALID_APPLICATION_ID);
  });

  it.each(Object.keys(validPrepareCommand))("rejects a command missing %s", (key) => {
    const input: Record<string, unknown> = { ...validPrepareCommand };
    delete input[key];

    expect(prepareFundingIntentCommandSchema.safeParse(input).success).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      prepareFundingIntentCommandSchema.safeParse({ ...validPrepareCommand, extra: "unexpected" })
        .success
    ).toBe(false);
  });

  it.each([
    ["a JSON number amount", { amountStroops: 10_000_000 }],
    ["a zero amount", { amountStroops: "0" }],
    ["a negative amount", { amountStroops: "-10000000" }],
    ["a fractional amount", { amountStroops: "1.5" }],
    ["a memo over 28 bytes", { memo: "m".repeat(29) }],
    ["a malformed application ID", { applicationId: "not-a-uuid" }],
    ["an empty source account", { sourceAccountId: "" }],
    ["an empty destination account", { destinationAccountId: "" }]
  ])("rejects %s", (_description, override) => {
    expect(
      prepareFundingIntentCommandSchema.safeParse({ ...validPrepareCommand, ...override }).success
    ).toBe(false);
  });

  it("rejects a command whose source and destination are the same account", () => {
    const result = prepareFundingIntentCommandSchema.safeParse({
      ...validPrepareCommand,
      destinationAccountId: SOURCE_ACCOUNT_ID
    });

    expect(result.success).toBe(false);
  });

  it("compares the trimmed accounts, not the raw input", () => {
    const result = prepareFundingIntentCommandSchema.safeParse({
      ...validPrepareCommand,
      destinationAccountId: `  ${SOURCE_ACCOUNT_ID}  `
    });

    expect(result.success).toBe(false);
  });
});

describe("preparedFundingIntentSchema", () => {
  it("parses the prepared intent: the terms plus the intent ID and the XDR", () => {
    const parsed = parsePreparedFundingIntent(validPreparedIntent);

    expect(parsed.intentId).toBe(VALID_INTENT_ID);
    expect(parsed.xdr).toBe(validPreparedIntent.xdr);
    expect(parsed.amountStroops).toBe(10_000_000n);
    expect(parsed.applicationId).toBeNull();
  });

  it("carries a declared application link alongside the terms", () => {
    const parsed = parsePreparedFundingIntent({
      ...validPreparedIntent,
      applicationId: VALID_APPLICATION_ID
    });

    expect(parsed.applicationId).toBe(VALID_APPLICATION_ID);
    // The link is declared metadata, not a term: it is not in the envelope and
    // so it is deliberately absent from the terms object.
    expect(parsed).not.toHaveProperty("intent.applicationId");
    expect(fundingIntentTermsSchema.safeParse({ ...validTerms, applicationId: null }).success).toBe(
      false
    );
  });

  it.each(["intentId", "xdr", "applicationId", ...Object.keys(validTerms)])(
    "rejects a prepared intent missing %s",
    (key) => {
      const input: Record<string, unknown> = { ...validPreparedIntent };
      delete input[key];

      expect(preparedFundingIntentSchema.safeParse(input).success).toBe(false);
    }
  );

  it.each([
    ["a malformed intent ID", { intentId: "not-a-uuid" }],
    ["an empty XDR", { xdr: "" }],
    ["a malformed application ID", { applicationId: "not-a-uuid" }],
    ["a malformed terms object", { amountStroops: 1 }]
  ])("rejects %s", (_description, override) => {
    expect(preparedFundingIntentSchema.safeParse({ ...validPreparedIntent, ...override }).success).toBe(
      false
    );
  });

  it("rejects unknown keys", () => {
    expect(
      preparedFundingIntentSchema.safeParse({ ...validPreparedIntent, extra: "unexpected" }).success
    ).toBe(false);
  });
});

describe("submitFundingIntentCommandSchema", () => {
  it("parses a valid submit command", () => {
    const parsed = parseSubmitFundingIntentCommand(validSubmitCommand);

    expect(parsed.signedXdr).toBe(validSubmitCommand.signedXdr);
    expect(parsed.intent.amountStroops).toBe(10_000_000n);
    expect(parsed.applicationId).toBeNull();
  });

  it("accepts a declared application link", () => {
    const parsed = parseSubmitFundingIntentCommand({
      ...validSubmitCommand,
      applicationId: VALID_APPLICATION_ID
    });

    expect(parsed.applicationId).toBe(VALID_APPLICATION_ID);
  });

  it.each(["signedXdr", "intent", "applicationId"])(
    "rejects a submit command missing %s",
    (key) => {
      const input: Record<string, unknown> = { ...validSubmitCommand };
      delete input[key];

      expect(submitFundingIntentCommandSchema.safeParse(input).success).toBe(false);
    }
  );

  it.each([
    ["an empty signed XDR", { signedXdr: "" }],
    ["a non-string signed XDR", { signedXdr: 42 }],
    ["a malformed application ID", { applicationId: "not-a-uuid" }],
    ["an application link smuggled into the terms", { intent: { ...validTerms, applicationId: null } }],
    ["a malformed intent", { intent: { network: "testnet" } }],
    ["an intent with an unknown key", { intent: { ...validTerms, extra: "unexpected" } }],
    ["an intent carrying a JSON number amount", { intent: { ...validTerms, amountStroops: 10_000_000 } }]
  ])("rejects %s", (_description, override) => {
    expect(submitFundingIntentCommandSchema.safeParse({ ...validSubmitCommand, ...override }).success).toBe(
      false
    );
  });

  it("rejects unknown top-level keys", () => {
    expect(
      submitFundingIntentCommandSchema.safeParse({ ...validSubmitCommand, extra: "unexpected" }).success
    ).toBe(false);
  });
});

describe("fundingIntentSnapshotSchema", () => {
  it("parses a snapshot with a null application link", () => {
    const parsed = parseFundingIntentSnapshot(validSnapshot);

    expect(parsed.intentId).toBe(VALID_INTENT_ID);
    expect(parsed.state).toBe("submitted");
    expect(parsed.amountStroops).toBe(10_000_000n);
    expect(parsed.applicationId).toBeNull();
    expect(parsed.lastCorrelationId).toBe(VALID_CORRELATION_ID);
  });

  it("accepts a snapshot with an application link", () => {
    const parsed = parseFundingIntentSnapshot({
      ...validSnapshot,
      applicationId: VALID_APPLICATION_ID
    });

    expect(parsed.applicationId).toBe(VALID_APPLICATION_ID);
  });

  it.each(Object.keys(validSnapshot))("rejects a snapshot missing %s", (key) => {
    const input: Record<string, unknown> = { ...validSnapshot };
    delete input[key];

    expect(fundingIntentSnapshotSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    ["a malformed intent ID", { intentId: "not-a-uuid" }],
    ["a malformed correlation ID", { lastCorrelationId: "not-a-uuid" }],
    ["a malformed application ID", { applicationId: "not-a-uuid" }],
    ["a state the demo cannot produce", { state: "confirmed" }],
    ["a JSON number amount", { amountStroops: 10_000_000 }],
    ["an empty transaction hash", { transactionHash: "" }],
    ["a datetime without an offset", { createdAt: "2026-09-21T12:00:00" }]
  ])("rejects %s", (_description, override) => {
    expect(fundingIntentSnapshotSchema.safeParse({ ...validSnapshot, ...override }).success).toBe(
      false
    );
  });

  it("rejects unknown keys", () => {
    expect(
      fundingIntentSnapshotSchema.safeParse({ ...validSnapshot, extra: "unexpected" }).success
    ).toBe(false);
  });
});
