import { describe, expect, it, vi } from "vitest";
import type { HttpClientPort } from "@/application/ports/http-client-port";
import type {
  OpenCampaignCommand,
  PrepareContractInvocationCommand,
  SubmitContractInvocationCommand
} from "@vaqcrow/contracts";
import { HttpCampaignGateway } from "./http-campaign-gateway";

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const APPLICATION_ID = "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f";
const SME = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const INVESTOR = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const CONTRACT = "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
const HASH = "TRANSACTION-HASH";

const snapshotWire = {
  campaignId: CAMPAIGN_ID,
  applicationId: APPLICATION_ID,
  contractAddress: CONTRACT,
  network: "TESTNET",
  state: "funding",
  goalStroops: "50000000",
  totalStroops: "0",
  deadline: "2026-12-01T00:00:00.000Z",
  smeAccountId: SME,
  reconciliationStatus: "in_sync"
};

const openCommand = {
  applicationId: APPLICATION_ID,
  smeAccountId: SME,
  goalStroops: 50000000n,
  deadline: "2026-12-01T00:00:00.000Z"
} as unknown as OpenCampaignCommand;

const prepareCommand = {
  operation: "contribute",
  investorAccountId: INVESTOR,
  sourceAccountId: null,
  amountStroops: 15000000n
} as unknown as PrepareContractInvocationCommand;

const submitCommand = {
  operation: "contribute",
  investorAccountId: INVESTOR,
  sourceAccountId: null,
  amountStroops: 15000000n,
  signedXdr: "SIGNED-XDR"
} as unknown as SubmitContractInvocationCommand;

function http(body: unknown, status = 200) {
  const send = vi.fn().mockResolvedValue({ status, body });
  return { port: { send } as unknown as HttpClientPort, send };
}

describe("HttpCampaignGateway.openCampaign", () => {
  it("posts the exact four body keys with money as a decimal string", async () => {
    const { port, send } = http({ campaign: snapshotWire }, 201);

    await new HttpCampaignGateway(port).openCampaign(openCommand);

    expect(send).toHaveBeenCalledWith({
      method: "POST",
      path: "/campaigns",
      body: {
        applicationId: APPLICATION_ID,
        smeAccountId: SME,
        goalStroops: "50000000",
        deadline: "2026-12-01T00:00:00.000Z"
      }
    });
  });

  it("reports applied=true on 201 and applied=false on a replayed 200", async () => {
    const created = http({ campaign: snapshotWire }, 201);
    const replayed = http({ campaign: snapshotWire }, 200);

    await expect(new HttpCampaignGateway(created.port).openCampaign(openCommand)).resolves.toMatchObject({
      applied: true,
      campaign: { campaignId: CAMPAIGN_ID }
    });
    await expect(new HttpCampaignGateway(replayed.port).openCampaign(openCommand)).resolves.toMatchObject({
      applied: false,
      campaign: { campaignId: CAMPAIGN_ID }
    });
  });

  it("throws on a malformed envelope", async () => {
    const { port } = http({ campaign: snapshotWire, extra: 1 }, 201);

    await expect(new HttpCampaignGateway(port).openCampaign(openCommand)).rejects.toThrow();
  });
});

describe("HttpCampaignGateway.getCampaign", () => {
  it("reads the campaign without an investor query when none is given", async () => {
    const { port, send } = http({ campaign: snapshotWire });

    const result = await new HttpCampaignGateway(port).getCampaign(CAMPAIGN_ID);

    expect(send).toHaveBeenCalledWith({ method: "GET", path: `/campaigns/${CAMPAIGN_ID}` });
    expect(result.state).toBe("funding");
    expect(result.goalStroops).toBe(50000000n);
  });

  it("appends the investor query when supplied", async () => {
    const { port, send } = http({ campaign: { ...snapshotWire, investorContributionStroops: "1000000" } });

    await new HttpCampaignGateway(port).getCampaign(CAMPAIGN_ID, INVESTOR);

    expect(send).toHaveBeenCalledWith({
      method: "GET",
      path: `/campaigns/${CAMPAIGN_ID}?investor=${encodeURIComponent(INVESTOR)}`
    });
  });

  it("throws on a drifted envelope", async () => {
    const { port } = http({});

    await expect(new HttpCampaignGateway(port).getCampaign(CAMPAIGN_ID)).rejects.toThrow();
  });
});

describe("HttpCampaignGateway.prepareInvocation", () => {
  it("posts the declared invocation facts with the amount as text", async () => {
    const { port, send } = http({
      contractInvocation: {
        invocationId: "22222222-2222-4222-8222-222222222222",
        operation: "contribute",
        xdr: "UNSIGNED-XDR",
        networkPassphrase: "passphrase",
        expiresAt: "2026-09-21T12:15:00.000Z"
      }
    });

    const result = await new HttpCampaignGateway(port).prepareInvocation(CAMPAIGN_ID, prepareCommand);

    expect(send).toHaveBeenCalledWith({
      method: "POST",
      path: `/campaigns/${CAMPAIGN_ID}/invocations`,
      body: {
        operation: "contribute",
        investorAccountId: INVESTOR,
        sourceAccountId: null,
        amountStroops: "15000000"
      }
    });
    expect(result.xdr).toBe("UNSIGNED-XDR");
  });

  it("throws on a malformed envelope", async () => {
    const { port } = http({ contractInvocation: { operation: "contribute" } });

    await expect(new HttpCampaignGateway(port).prepareInvocation(CAMPAIGN_ID, prepareCommand)).rejects.toThrow();
  });
});

describe("HttpCampaignGateway.submitInvocation", () => {
  it("posts the signed envelope alongside the declared facts", async () => {
    const { port, send } = http({ transactionHash: HASH, status: "accepted" }, 202);

    const result = await new HttpCampaignGateway(port).submitInvocation(CAMPAIGN_ID, submitCommand);

    expect(send).toHaveBeenCalledWith({
      method: "POST",
      path: `/campaigns/${CAMPAIGN_ID}/invocations/submission`,
      body: {
        operation: "contribute",
        investorAccountId: INVESTOR,
        sourceAccountId: null,
        amountStroops: "15000000",
        signedXdr: "SIGNED-XDR"
      }
    });
    expect(result.transactionHash).toBe(HASH);
    expect(result.status).toBe("accepted");
  });

  it("throws on a malformed envelope", async () => {
    const { port } = http({ status: "accepted" }, 202);

    await expect(new HttpCampaignGateway(port).submitInvocation(CAMPAIGN_ID, submitCommand)).rejects.toThrow();
  });
});

describe("HttpCampaignGateway.getTransaction", () => {
  it("reads a pending transaction with no campaign attached", async () => {
    const { port, send } = http({ transactionHash: HASH, status: "pending" });

    const result = await new HttpCampaignGateway(port).getTransaction(CAMPAIGN_ID, HASH);

    expect(send).toHaveBeenCalledWith({ method: "GET", path: `/campaigns/${CAMPAIGN_ID}/transactions/${HASH}` });
    expect(result.status).toBe("pending");
    expect(result.campaign).toBeUndefined();
  });

  it("reads a succeeded transaction with the refreshed campaign", async () => {
    const { port } = http({ transactionHash: HASH, status: "success", campaign: snapshotWire });

    const result = await new HttpCampaignGateway(port).getTransaction(CAMPAIGN_ID, HASH);

    expect(result.status).toBe("success");
    expect(result.campaign?.campaignId).toBe(CAMPAIGN_ID);
  });

  it("throws on a malformed envelope", async () => {
    const { port } = http({ transactionHash: HASH, status: "unknown" });

    await expect(new HttpCampaignGateway(port).getTransaction(CAMPAIGN_ID, HASH)).rejects.toThrow();
  });
});
