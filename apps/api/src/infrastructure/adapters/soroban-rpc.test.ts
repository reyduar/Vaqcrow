import { describe, expect, it } from "vitest";
import {
  STELLAR_LOCAL_NETWORK_PASSPHRASE,
  STELLAR_TESTNET_NETWORK_PASSPHRASE
} from "../../application/config/stellar-config.js";
import type { StellarConfig } from "../../application/config/stellar-config.js";
import { createSorobanRpcServer, usesPlainHttp } from "./soroban-rpc.js";

/**
 * Mirrors `stellar-horizon.test.ts`: `usesPlainHttp` here is
 * `allowsPlainHttp(config.rpcUrl, config.network)`, the same boundary applied
 * to the RPC URL instead of the Horizon URL — both axes (loopback, and the
 * `local` network regardless of host) are covered independently.
 */

function config(overrides: Partial<StellarConfig>): StellarConfig {
  return {
    network: "testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: STELLAR_TESTNET_NETWORK_PASSPHRASE,
    explorerUrl: "https://stellar.expert/explorer/testnet",
    ...overrides
  };
}

describe("usesPlainHttp", () => {
  it("refuses plain http on testnet against a non-loopback host", () => {
    expect(usesPlainHttp(config({ rpcUrl: "http://soroban-testnet.stellar.org" }))).toBe(false);
  });

  it("allows plain http on testnet against a loopback host", () => {
    expect(usesPlainHttp(config({ rpcUrl: "http://127.0.0.1:8000/rpc" }))).toBe(true);
    expect(usesPlainHttp(config({ rpcUrl: "http://localhost:8000/rpc" }))).toBe(true);
  });

  it("never allows plain http against https", () => {
    expect(usesPlainHttp(config({ rpcUrl: "https://soroban-testnet.stellar.org" }))).toBe(false);
  });

  it("allows plain http on the local network even against a non-loopback host", () => {
    expect(
      usesPlainHttp(
        config({
          network: "local",
          rpcUrl: "http://host.docker.internal:8000/rpc",
          networkPassphrase: STELLAR_LOCAL_NETWORK_PASSPHRASE
        })
      )
    ).toBe(true);
  });
});

describe("createSorobanRpcServer", () => {
  it("constructs a server for a validated configuration without throwing", () => {
    expect(() => createSorobanRpcServer(config({}))).not.toThrow();
    expect(() =>
      createSorobanRpcServer(
        config({
          network: "local",
          rpcUrl: "http://host.docker.internal:8000/rpc",
          networkPassphrase: STELLAR_LOCAL_NETWORK_PASSPHRASE
        })
      )
    ).not.toThrow();
  });
});
