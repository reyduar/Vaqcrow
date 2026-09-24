import { describe, expect, it } from "vitest";
import {
  campaignSnapshotSchema,
  campaignStateSchema,
  contractInvocationSchema,
  contractOperationSchema,
  nonNegativeStroopsSchema,
  openCampaignCommandSchema,
  parseCampaignSnapshot,
  parseCampaignState,
  parseContractInvocation,
  parseContractOperation,
  parseOpenCampaignCommand,
  parseReconciliationStatus,
  parseStellarAccountId,
  parseStellarContractId,
  parseSubmitContractInvocationCommand,
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

describe("submitContractInvocationCommandSchema", () => {
  it("parses a signed envelope", () => {
    expect(parseSubmitContractInvocationCommand({ signedXdr: "AAAAAgAAAABfakeSignedEnvelope" })).toEqual({
      signedXdr: "AAAAAgAAAABfakeSignedEnvelope"
    });
  });

  it("rejects an empty signed envelope", () => {
    expect(submitContractInvocationCommandSchema.safeParse({ signedXdr: "" }).success).toBe(false);
  });

  it("rejects an unknown field", () => {
    expect(submitContractInvocationCommandSchema.safeParse({ signedXdr: "x", extra: true }).success).toBe(false);
  });
});
