import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBrowserWalletConnectionPort,
  createWalletConnectionPort,
  UNAVAILABLE_WALLET_CONNECTION_PORT
} from "./create-wallet-connection-port";
import { HttpWalletConnectionGateway } from "./http-wallet-connection-gateway";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createWalletConnectionPort", () => {
  it("returns null for a missing or blank base URL", () => {
    expect(createWalletConnectionPort(undefined)).toBeNull();
    expect(createWalletConnectionPort("")).toBeNull();
    expect(createWalletConnectionPort("   ")).toBeNull();
  });

  it("builds the HTTP gateway when a base URL is configured", () => {
    expect(createWalletConnectionPort("https://api.test")).toBeInstanceOf(HttpWalletConnectionGateway);
  });
});

describe("UNAVAILABLE_WALLET_CONNECTION_PORT", () => {
  it("answers a sanitized unavailable code for every call", async () => {
    expect(await UNAVAILABLE_WALLET_CONNECTION_PORT.requestChallenge()).toEqual({ ok: false, code: "unavailable" });
    expect(
      await UNAVAILABLE_WALLET_CONNECTION_PORT.submitConnection({
        challengeId: "9c1f0a4e-2b3d-4e5f-8a6b-7c8d9e0f1a2b",
        publicKey: "GBXK1234567890ABCD7Q2M",
        signature: "c2ln"
      })
    ).toEqual({ ok: false, code: "unavailable" });
    expect(await UNAVAILABLE_WALLET_CONNECTION_PORT.getConnection()).toEqual({ ok: false, code: "unavailable" });
  });
});

describe("createBrowserWalletConnectionPort", () => {
  it("returns the null-object when no base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    expect(createBrowserWalletConnectionPort()).toBe(UNAVAILABLE_WALLET_CONNECTION_PORT);
  });

  it("builds the HTTP gateway when the base URL is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.test");
    expect(createBrowserWalletConnectionPort()).toBeInstanceOf(HttpWalletConnectionGateway);
  });
});
