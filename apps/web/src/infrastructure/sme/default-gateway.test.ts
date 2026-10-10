import axios, { type AxiosInstance } from "axios";
import type { SmeRequest } from "@vaqcrow/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBrowserSmeRequestGateway, createSmeRequestGateway } from "./default-gateway";

/**
 * The browser default must read the signed-in session's token: `POST
 * /sme-requests` is `only("PYME")` in the API, so an unauthenticated send is a
 * 401 (observed in the U9 live rehearsal). The session double stands in for
 * Supabase; no network or env is touched beyond the stubbed base URL.
 */
vi.mock("@/infrastructure/auth/browser-auth-session", () => ({
  createBrowserAuthSession: () => ({ getAccessToken: async () => "session-jwt" })
}));

const REQUEST: SmeRequest = {
  smeReference: "30712345678",
  declaredTotalArs: 27138250,
  periodStart: "2026-01",
  periodEnd: "2026-08",
  simuladoLabel: "SIMULADO"
};

const SUBMITTED = { applicationId: "3f0c1d52-7a4b-4c1e-9d3a-2b6e8f4a9c10", request: REQUEST };

/** Replaces `axios.create` with an instance whose `request` records every call. */
function captureRequests() {
  const request = vi.fn().mockResolvedValue({ status: 201, data: SUBMITTED });
  vi.spyOn(axios, "create").mockReturnValue({ request } as unknown as AxiosInstance);
  return request;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const TOKEN = async () => "token-123";

describe("createSmeRequestGateway", () => {
  it("returns null when no backend base URL is configured", () => {
    expect(createSmeRequestGateway(undefined, TOKEN)).toBeNull();
    expect(createSmeRequestGateway("", TOKEN)).toBeNull();
    expect(createSmeRequestGateway("   ", TOKEN)).toBeNull();
  });

  it("returns a gateway when a base URL is configured", () => {
    expect(createSmeRequestGateway("https://api.example.test", TOKEN)).not.toBeNull();
  });

  it("sends POST /sme-requests with the Bearer token from the given provider", async () => {
    const request = captureRequests();
    const gateway = createSmeRequestGateway("https://api.example.test", async () => "token-123");

    await gateway!.submit(REQUEST);

    const call = request.mock.calls[0]![0];
    expect(call.method).toBe("POST");
    expect(call.url).toBe("/sme-requests");
    expect(call.headers).toEqual({ Authorization: "Bearer token-123" });
  });
});

describe("createBrowserSmeRequestGateway", () => {
  it("returns null when no backend base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    expect(createBrowserSmeRequestGateway()).toBeNull();
  });

  it("attaches the browser session's access token to POST /sme-requests", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    const request = captureRequests();

    await createBrowserSmeRequestGateway()!.submit(REQUEST);

    const call = request.mock.calls[0]![0];
    expect(call.url).toBe("/sme-requests");
    expect(call.headers).toEqual({ Authorization: "Bearer session-jwt" });
  });
});
