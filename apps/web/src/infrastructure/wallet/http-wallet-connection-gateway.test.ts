import type { AxiosInstance } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpWalletConnectionGateway } from "./http-wallet-connection-gateway";

const CHALLENGE_ID = "9c1f0a4e-2b3d-4e5f-8a6b-7c8d9e0f1a2b";
const PUBLIC_KEY = "GBXK1234567890ABCD7Q2M";
const WIRE_CHALLENGE = { challengeId: CHALLENGE_ID, message: "Vaqcrow wallet connection challenge\nNonce: n" };
const WIRE_CONNECTION = { publicKey: PUBLIC_KEY, frozen: false };
const INPUT = { challengeId: CHALLENGE_ID, publicKey: PUBLIC_KEY, signature: "c2ln" };

interface Call {
  readonly method: "post" | "get";
  readonly url: string;
  readonly data: unknown;
  readonly config: Record<string, unknown> | undefined;
}

interface Fake {
  readonly post?: { status: number; data: unknown } | Error;
  readonly get?: { status: number; data: unknown } | Error;
}

function fakeClient(fake: Fake) {
  const calls: Call[] = [];
  const client = {
    post: async (url: string, data: unknown, config: Record<string, unknown> | undefined) => {
      calls.push({ method: "post", url, data, config });
      if (fake.post instanceof Error) throw fake.post;
      return fake.post ?? { status: 201, data: WIRE_CHALLENGE };
    },
    get: async (url: string, config: Record<string, unknown> | undefined) => {
      calls.push({ method: "get", url, data: undefined, config });
      if (fake.get instanceof Error) throw fake.get;
      return fake.get ?? { status: 200, data: WIRE_CONNECTION };
    }
  } as unknown as AxiosInstance;
  return { client, calls };
}

afterEach(() => vi.restoreAllMocks());

describe("HttpWalletConnectionGateway.requestChallenge", () => {
  it("posts for a challenge with the Bearer token and returns it", async () => {
    const { client, calls } = fakeClient({});
    const gateway = new HttpWalletConnectionGateway(client, async () => "token-123");

    expect(await gateway.requestChallenge()).toEqual({ ok: true, challenge: WIRE_CHALLENGE });
    expect(calls[0]!.method).toBe("post");
    expect(calls[0]!.url).toBe("/profile/wallet/challenge");
    expect(calls[0]!.config?.["headers"]).toEqual({ Authorization: "Bearer token-123" });
  });

  it("sends no Authorization header when there is no token", async () => {
    const { client, calls } = fakeClient({});
    await new HttpWalletConnectionGateway(client, async () => null).requestChallenge();

    expect(calls[0]!.config?.["headers"]).toEqual({});
  });

  it("answers unavailable for a malformed challenge body", async () => {
    const { client } = fakeClient({ post: { status: 201, data: { challengeId: "x" } } });

    expect(await new HttpWalletConnectionGateway(client).requestChallenge()).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("prefers the sanitized envelope code", async () => {
    const { client } = fakeClient({ post: { status: 503, data: { code: "unavailable" } } });

    expect(await new HttpWalletConnectionGateway(client).requestChallenge()).toEqual({ ok: false, code: "unavailable" });
  });

  it("answers network when the transport throws", async () => {
    const { client } = fakeClient({ post: new Error("socket hang up") });

    expect(await new HttpWalletConnectionGateway(client).requestChallenge()).toEqual({ ok: false, code: "network" });
  });
});

describe("HttpWalletConnectionGateway.submitConnection", () => {
  it("posts the key and signature and returns the stored connection", async () => {
    const { client, calls } = fakeClient({ post: { status: 200, data: WIRE_CONNECTION } });
    const gateway = new HttpWalletConnectionGateway(client, async () => "token-123");

    expect(await gateway.submitConnection(INPUT)).toEqual({ ok: true, connection: WIRE_CONNECTION });
    expect(calls[0]!.method).toBe("post");
    expect(calls[0]!.url).toBe("/profile/wallet");
    expect(calls[0]!.data).toEqual(INPUT);
    expect(calls[0]!.config?.["headers"]).toEqual({ Authorization: "Bearer token-123" });
  });

  it("maps 409 to wallet_frozen", async () => {
    const { client } = fakeClient({ post: { status: 409, data: { code: "wallet_frozen" } } });

    expect(await new HttpWalletConnectionGateway(client).submitConnection(INPUT)).toEqual({
      ok: false,
      code: "wallet_frozen"
    });
  });

  it("maps 400 to invalid_request", async () => {
    const { client } = fakeClient({ post: { status: 400, data: { code: "invalid_request" } } });

    expect(await new HttpWalletConnectionGateway(client).submitConnection(INPUT)).toEqual({
      ok: false,
      code: "invalid_request"
    });
  });

  it("answers unavailable for a malformed success body", async () => {
    const { client } = fakeClient({ post: { status: 200, data: { publicKey: PUBLIC_KEY } } });

    expect(await new HttpWalletConnectionGateway(client).submitConnection(INPUT)).toEqual({
      ok: false,
      code: "unavailable"
    });
  });

  it("answers network when the transport throws", async () => {
    const { client } = fakeClient({ post: new Error("offline") });

    expect(await new HttpWalletConnectionGateway(client).submitConnection(INPUT)).toEqual({ ok: false, code: "network" });
  });
});

describe("HttpWalletConnectionGateway.getConnection", () => {
  it("reads the owner's connection with the Bearer token", async () => {
    const { client, calls } = fakeClient({ get: { status: 200, data: WIRE_CONNECTION } });
    const gateway = new HttpWalletConnectionGateway(client, async () => "token-123");

    expect(await gateway.getConnection()).toEqual({ ok: true, publicKey: PUBLIC_KEY, frozen: false });
    expect(calls[0]!.method).toBe("get");
    expect(calls[0]!.url).toBe("/profile/wallet");
    expect(calls[0]!.config?.["headers"]).toEqual({ Authorization: "Bearer token-123" });
  });

  it("treats a null key as a normal empty state", async () => {
    const { client } = fakeClient({ get: { status: 200, data: { publicKey: null, frozen: false } } });

    expect(await new HttpWalletConnectionGateway(client).getConnection()).toEqual({
      ok: true,
      publicKey: null,
      frozen: false
    });
  });

  it("maps 404 to not_found", async () => {
    const { client } = fakeClient({ get: { status: 404, data: { code: "not_found" } } });

    expect(await new HttpWalletConnectionGateway(client).getConnection()).toEqual({ ok: false, code: "not_found" });
  });

  it("answers unavailable for a malformed success body", async () => {
    const { client } = fakeClient({ get: { status: 200, data: { publicKey: PUBLIC_KEY } } });

    expect(await new HttpWalletConnectionGateway(client).getConnection()).toEqual({ ok: false, code: "unavailable" });
  });

  it("answers network when the transport throws", async () => {
    const { client } = fakeClient({ get: new Error("offline") });

    expect(await new HttpWalletConnectionGateway(client).getConnection()).toEqual({ ok: false, code: "network" });
  });
});
