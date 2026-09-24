import { describe, expect, it } from "vitest";
import {
  campaignSnapshotSchema,
  campaignStateSchema,
  contractInvocationSchema,
  contractInvocationSubmissionSchema,
  contractInvocationTransactionStatusSchema,
  contractOperationSchema,
  nonNegativeStroopsSchema,
  openCampaignCommandSchema,
  parseCampaignSnapshot,
  parseCampaignState,
  parseContractInvocation,
  parseContractInvocationSubmission,
  parseContractInvocationTransactionStatus,
  parseContractOperation,
  parseOpenCampaignCommand,
  parsePrepareContractInvocationCommand,
  parseReconciliationStatus,
  parseStellarAccountId,
  parseStellarContractId,
  parseSubmitContractInvocationCommand,
  prepareContractInvocationCommandSchema,
  reconciliationStatusSchema,
  stellarAccountIdSchema,
  stellarContractIdSchema,
  submitContractInvocationCommandSchema
} from "./index.js";

const VALID_APPLICATION_ID = "87654321-4321-4abc-8def-123456789abc";
const VALID_CAMPAIGN_ID = "123e4567-e89b-42d3-a456-426614174000";
const VALID_INVOCATION_ID = "22222222-2222-4222-8222-222222222222";
const VALID_SME_ACCOUNT_ID = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const VALID_CONTRACT_ADDRESS = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

describe("stellarAccountIdSchema", () => {
  it("accepts a well-formed G... account address", () => {
    expect(parseStellarAccountId(VALID_SME_ACCOUNT_ID)).toBe(VALID_SME_ACCOUNT_ID);
  });

  it.each([
    ["a contract address", VALID_CONTRACT_ADDRESS],
    ["a lowercase address", VALID_SME_ACCOUNT_ID.toLowerCase()],
    ["one character short", VALID_SME_ACCOUNT_ID.slice(0, -1)],
    ["one character too long", `${VALID_SME_ACCOUNT_ID}A`],
    ["a digit outside base32 (0/1/8/9)", `G0${VALID_SME_ACCOUNT_ID.slice(2)}`],
    ["a non-string value", 42],
    ["an empty string", ""]
  ])("rejects %s", (_description, input) => {
    expect(stellarAccountIdSchema.safeParse(input).success).toBe(false);
  });
});

describe("stellarContractIdSchema", () => {
  it("accepts a well-formed C... contract address", () => {
    expect(parseStellarContractId(VALID_CONTRACT_ADDRESS)).toBe(VALID_CONTRACT_ADDRESS);
  });

  it.each([
    ["an account address", VALID_SME_ACCOUNT_ID],
    ["one character short", VALID_CONTRACT_ADDRESS.slice(0, -1)],
    ["a non-string value", 42]
  ])("rejects %s", (_description, input) => {
    expect(stellarContractIdSchema.safeParse(input).success).toBe(false);
  });
});

describe("campaignStateSchema", () => {
  it.each(["funding", "settled", "refunding"] as const)("accepts %s", (state) => {
    expect(parseCampaignState(state)).toBe(state);
  });

  it.each([
    ["the mirror's own vocabulary (open)", "open"],
    ["the mirror's own vocabulary (refundable)", "refundable"],
    ["an unrelated string", "pending"],
    ["a non-string value", 1]
  ])("rejects %s", (_description, input) => {
    expect(campaignStateSchema.safeParse(input).success).toBe(false);
  });
});

describe("reconciliationStatusSchema", () => {
  it.each(["in_sync", "diverged"] as const)("accepts %s", (status) => {
    expect(parseReconciliationStatus(status)).toBe(status);
  });

  it("rejects an unrelated string", () => {
    expect(reconciliationStatusSchema.safeParse("synced").success).toBe(false);
  });
});

describe("nonNegativeStroopsSchema", () => {
  it("parses zero, unlike stroopsSchema", () => {
    expect(nonNegativeStroopsSchema.parse("0")).toBe(0n);
  });

  it("parses a positive decimal string into a bigint", () => {
    expect(nonNegativeStroopsSchema.parse("10000000")).toBe(10_000_000n);
  });

  it.each([
    ["a negative string", "-1"],
    ["a leading-zero string", "007"],
    ["a fractional string", "1.5"]
  ])("rejects %s", (_description, input) => {
    expect(nonNegativeStroopsSchema.safeParse(input).success).toBe(false);
  });
});

const validOpenCommand = {
  applicationId: VALID_APPLICATION_ID,
  smeAccountId: VALID_SME_ACCOUNT_ID,
  goalStroops: "10000000",
  deadline: "2026-10-01T00:00:00.000Z"
};

describe("openCampaignCommandSchema", () => {
  it("parses a well-formed command", () => {
    const parsed = parseOpenCampaignCommand(validOpenCommand);
    expect(parsed.goalStroops).toBe(10_000_000n);
    expect(parsed.smeAccountId).toBe(VALID_SME_ACCOUNT_ID);
  });

  it("rejects a zero goal", () => {
    expect(openCampaignCommandSchema.safeParse({ ...validOpenCommand, goalStroops: "0" }).success).toBe(false);
  });

  it("rejects an unknown field", () => {
    expect(openCampaignCommandSchema.safeParse({ ...validOpenCommand, extra: true }).success).toBe(false);
  });

  it("rejects a malformed SME account id", () => {
    expect(openCampaignCommandSchema.safeParse({ ...validOpenCommand, smeAccountId: "not-an-account" }).success).toBe(
      false
    );
  });
});

const validSnapshot = {
  campaignId: VALID_CAMPAIGN_ID,
  applicationId: VALID_APPLICATION_ID,
  contractAddress: VALID_CONTRACT_ADDRESS,
  network: "testnet",
  state: "funding",
  goalStroops: "10000000",
  totalStroops: "0",
  deadline: "2026-10-01T00:00:00.000Z",
  smeAccountId: VALID_SME_ACCOUNT_ID,
  reconciliationStatus: "in_sync"
};

describe("campaignSnapshotSchema", () => {
  it("parses a snapshot with no contribution yet and no explorer link", () => {
    const parsed = parseCampaignSnapshot(validSnapshot);
    expect(parsed.totalStroops).toBe(0n);
    expect(parsed.investorContributionStroops).toBeUndefined();
    expect(parsed.explorerUrl).toBeUndefined();
  });

  it("parses a snapshot with an observed contribution and explorer link", () => {
    const parsed = parseCampaignSnapshot({
      ...validSnapshot,
      totalStroops: "2500000",
      investorContributionStroops: "2500000",
      explorerUrl: "https://stellar.expert/explorer/testnet/contract/CAAA"
    });
    expect(parsed.investorContributionStroops).toBe(2_500_000n);
  });

  it("parses an explicit null contribution", () => {
    const parsed = parseCampaignSnapshot({ ...validSnapshot, investorContributionStroops: null });
    expect(parsed.investorContributionStroops).toBeNull();
  });

  it("rejects the mirror's own state vocabulary", () => {
    expect(campaignSnapshotSchema.safeParse({ ...validSnapshot, state: "open" }).success).toBe(false);
  });

  it("rejects an unknown field", () => {
    expect(campaignSnapshotSchema.safeParse({ ...validSnapshot, extra: true }).success).toBe(false);
  });
});

describe("contractOperationSchema", () => {
  it.each(["contribute", "withdraw", "refund"] as const)("accepts %s", (operation) => {
    expect(parseContractOperation(operation)).toBe(operation);
  });

  it("rejects an unrelated operation", () => {
    expect(contractOperationSchema.safeParse("deploy").success).toBe(false);
  });
});

const validInvocation = {
  invocationId: VALID_INVOCATION_ID,
  operation: "contribute",
  xdr: "AAAAAgAAAABfakeUnsignedEnvelope",
  networkPassphrase: NETWORK_PASSPHRASE,
  expiresAt: "2026-10-01T00:05:00.000Z"
};

describe("contractInvocationSchema", () => {
  it("parses a well-formed prepared invocation", () => {
    expect(parseContractInvocation(validInvocation)).toEqual(validInvocation);
  });

  it("rejects an empty XDR", () => {
    expect(contractInvocationSchema.safeParse({ ...validInvocation, xdr: "" }).success).toBe(false);
  });

  it("rejects an unknown field", () => {
    expect(contractInvocationSchema.safeParse({ ...validInvocation, extra: true }).success).toBe(false);
  });
});

const VALID_OTHER_ACCOUNT_ID = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBQ";

const validContribute = {
  operation: "contribute",
  investorAccountId: VALID_SME_ACCOUNT_ID,
  sourceAccountId: null,
  amountStroops: "5000000"
};

const validWithdraw = {
  operation: "withdraw",
  investorAccountId: VALID_SME_ACCOUNT_ID,
  sourceAccountId: VALID_SME_ACCOUNT_ID,
  amountStroops: null
};

const validRefund = {
  operation: "refund",
  investorAccountId: VALID_SME_ACCOUNT_ID,
  sourceAccountId: VALID_OTHER_ACCOUNT_ID,
  amountStroops: null
};

describe("prepareContractInvocationCommandSchema", () => {
  it("parses a well-formed contribute command with amountStroops", () => {
    const parsed = parsePrepareContractInvocationCommand(validContribute);
    expect(parsed.amountStroops).toBe(5_000_000n);
    expect(parsed.sourceAccountId).toBeNull();
  });

  it("parses a well-formed withdraw command with no amount and a matching source", () => {
    const parsed = parsePrepareContractInvocationCommand(validWithdraw);
    expect(parsed.amountStroops).toBeNull();
    expect(parsed.sourceAccountId).toBe(VALID_SME_ACCOUNT_ID);
  });

  it("parses a refund command with any source account", () => {
    const parsed = parsePrepareContractInvocationCommand(validRefund);
    expect(parsed.sourceAccountId).toBe(VALID_OTHER_ACCOUNT_ID);
  });

  it("parses a refund command with no source at all", () => {
    const parsed = parsePrepareContractInvocationCommand({ ...validRefund, sourceAccountId: null });
    expect(parsed.sourceAccountId).toBeNull();
  });

  it("rejects a contribute command missing amountStroops", () => {
    expect(
      prepareContractInvocationCommandSchema.safeParse({ ...validContribute, amountStroops: null }).success
    ).toBe(false);
  });

  it("rejects a withdraw command that carries amountStroops", () => {
    expect(
      prepareContractInvocationCommandSchema.safeParse({ ...validWithdraw, amountStroops: "1" }).success
    ).toBe(false);
  });

  it("rejects a refund command that carries amountStroops", () => {
    expect(
      prepareContractInvocationCommandSchema.safeParse({ ...validRefund, amountStroops: "1" }).success
    ).toBe(false);
  });

  it("rejects a contribute command whose source differs from the investor", () => {
    expect(
      prepareContractInvocationCommandSchema.safeParse({ ...validContribute, sourceAccountId: VALID_OTHER_ACCOUNT_ID })
        .success
    ).toBe(false);
  });

  it("rejects a withdraw command whose source differs from the investor", () => {
    expect(
      prepareContractInvocationCommandSchema.safeParse({ ...validWithdraw, sourceAccountId: VALID_OTHER_ACCOUNT_ID })
        .success
    ).toBe(false);
  });

  it("rejects an unrelated operation", () => {
    expect(
      prepareContractInvocationCommandSchema.safeParse({ ...validContribute, operation: "deploy" }).success
    ).toBe(false);
  });

  it("rejects a missing field", () => {
    const withoutAmount: Record<string, unknown> = { ...validContribute };
    delete withoutAmount["amountStroops"];
    expect(prepareContractInvocationCommandSchema.safeParse(withoutAmount).success).toBe(false);
  });

  it("rejects an unknown field", () => {
    expect(prepareContractInvocationCommandSchema.safeParse({ ...validContribute, extra: true }).success).toBe(false);
  });
});

describe("submitContractInvocationCommandSchema", () => {
  it("parses a well-formed contribute submission", () => {
    const parsed = parseSubmitContractInvocationCommand({ ...validContribute, signedXdr: "AAAAAgAAAABfakeSignedEnvelope" });
    expect(parsed.amountStroops).toBe(5_000_000n);
    expect(parsed.signedXdr).toBe("AAAAAgAAAABfakeSignedEnvelope");
  });

  it("parses a well-formed refund submission with any source", () => {
    const parsed = parseSubmitContractInvocationCommand({ ...validRefund, signedXdr: "AAAAAgAAAABfakeSignedEnvelope" });
    expect(parsed.sourceAccountId).toBe(VALID_OTHER_ACCOUNT_ID);
  });

  it("rejects an empty signed envelope", () => {
    expect(
      submitContractInvocationCommandSchema.safeParse({ ...validWithdraw, signedXdr: "" }).success
    ).toBe(false);
  });

  it("rejects a contribute submission missing amountStroops", () => {
    expect(
      submitContractInvocationCommandSchema.safeParse({
        ...validContribute,
        amountStroops: null,
        signedXdr: "x"
      }).success
    ).toBe(false);
  });

  it("rejects a withdraw submission whose source differs from the investor", () => {
    expect(
      submitContractInvocationCommandSchema.safeParse({
        ...validWithdraw,
        sourceAccountId: VALID_OTHER_ACCOUNT_ID,
        signedXdr: "x"
      }).success
    ).toBe(false);
  });

  it("rejects an unknown field", () => {
    expect(
      submitContractInvocationCommandSchema.safeParse({ ...validWithdraw, signedXdr: "x", extra: true }).success
    ).toBe(false);
  });
});

describe("contractInvocationSubmissionSchema", () => {
  it("parses an accepted submission outcome", () => {
    expect(
      parseContractInvocationSubmission({
        transactionHash: "d0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f",
        status: "accepted"
      })
    ).toEqual({
      transactionHash: "d0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f",
      status: "accepted"
    });
  });

  it("rejects any other status", () => {
    expect(
      contractInvocationSubmissionSchema.safeParse({ transactionHash: "abc", status: "rejected" }).success
    ).toBe(false);
  });

  it("rejects an unknown field", () => {
    expect(
      contractInvocationSubmissionSchema.safeParse({
        transactionHash: "abc",
        status: "accepted",
        extra: true
      }).success
    ).toBe(false);
  });
});

describe("contractInvocationTransactionStatusSchema", () => {
  it("parses a pending status with no campaign snapshot", () => {
    const parsed = parseContractInvocationTransactionStatus({ transactionHash: "abc", status: "pending" });
    expect(parsed.campaign).toBeUndefined();
  });

  it("parses a success status carrying a fresh campaign snapshot", () => {
    const parsed = parseContractInvocationTransactionStatus({
      transactionHash: "abc",
      status: "success",
      campaign: validSnapshot
    });
    expect(parsed.campaign?.campaignId).toBe(VALID_CAMPAIGN_ID);
  });

  it("rejects an unrelated status", () => {
    expect(
      contractInvocationTransactionStatusSchema.safeParse({ transactionHash: "abc", status: "settled" }).success
    ).toBe(false);
  });

  it("rejects an unknown field", () => {
    expect(
      contractInvocationTransactionStatusSchema.safeParse({
        transactionHash: "abc",
        status: "failed",
        extra: true
      }).success
    ).toBe(false);
  });
});
