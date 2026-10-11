import axios, { type AxiosInstance } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCampaignGateway } from "./default-gateway";

const CAMPAIGN_ID = "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10";

/** A minimal, contract-valid `campaignSnapshotSchema` payload for the `{ campaign }` envelope. */
const SNAPSHOT = {
  campaignId: CAMPAIGN_ID,
  applicationId: "5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f",
  contractAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
  network: "testnet",
  state: "funding",
  goalStroops: "50000000",
  totalStroops: "15000000",
  deadline: "2026-12-01T00:00:00.000Z",
  smeAccountId: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  reconciliationStatus: "in_sync"
};

/** Replaces `axios.create` with an instance whose `request` records every call. */
function captureRequests() {
  const request = vi.fn().mockResolvedValue({ status: 200, data: { campaign: SNAPSHOT } });
  vi.spyOn(axios, "create").mockReturnValue({ request } as unknown as AxiosInstance);
  return request;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("createCampaignGateway", () => {
  it("returns null when no backend is configured, so the UI can refuse explicitly", () => {
    expect(createCampaignGateway(undefined)).toBeNull();
    expect(createCampaignGateway("")).toBeNull();
    expect(createCampaignGateway("   ")).toBeNull();
  });

  it("returns a gateway when a base URL is configured", () => {
    expect(createCampaignGateway("http://localhost:3001")).not.toBeNull();
  });

  // `GET /campaigns/:id`, the invocation prepare/submit and the transaction
  // poll are all `AUTHENTICATED` in the API, so an unauthenticated read is a
  // live 401. The gateway must attach the signed-in session's Bearer token.
  it("attaches the Bearer token from the access-token provider to the campaign read", async () => {
    const request = captureRequests();
    const gateway = createCampaignGateway("https://api.example.test", async () => "token-123");

    await gateway!.getCampaign(CAMPAIGN_ID);

    const call = request.mock.calls[0]![0];
    expect(call.method).toBe("GET");
    expect(call.url).toBe(`/campaigns/${CAMPAIGN_ID}`);
    expect(call.headers).toEqual({ Authorization: "Bearer token-123" });
  });
});
