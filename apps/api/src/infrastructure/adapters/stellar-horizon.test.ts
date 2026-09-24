import { describe, expect, it } from "vitest";
import {
  STELLAR_LOCAL_NETWORK_PASSPHRASE,
  STELLAR_TESTNET_NETWORK_PASSPHRASE
} from "../../application/config/stellar-config.js";
import type { StellarConfig } from "../../application/config/stellar-config.js";
import { createHorizonServer, usesPlainHttp } from "./stellar-horizon.js";

/**
 * `allowHttp` decides whether the SDK will submit over plain HTTP at all —
 * getting it wrong either refuses a legitimate local double (loopback, or the
 * `local` network's own non-loopback Quickstart host) or, worse, would allow
 * plain HTTP somewhere it should not. U1 widened the boundary from "any
 * http:// URL" to "loopback, or the network is `local`", so both axes are
 * covered independently here rather than only through the URL scheme.
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
    expect(usesPlainHttp(config({ horizonUrl: "http://horizon-testnet.stellar.org" }))).toBe(false);
  });

  it("allows plain http on testnet against a loopback host", () => {
    expect(usesPlainHttp(config({ horizonUrl: "http://127.0.0.1:8000" }))).toBe(true);
    expect(usesPlainHttp(config({ horizonUrl: "http://localhost:8000" }))).toBe(true);
  });

  it("never allows plain http against https", () => {
    expect(usesPlainHttp(config({ horizonUrl: "https://horizon-testnet.stellar.org" }))).toBe(false);
  });

  it("allows plain http on the local network even against a non-loopback host", () => {
    // The API container reaches Quickstart via `host.docker.internal`, which is
    // not a loopback spelling `isLoopbackHost` recognises.
    expect(
      usesPlainHttp(
        config({
          network: "local",
          horizonUrl: "http://host.docker.internal:8000",
          networkPassphrase: STELLAR_LOCAL_NETWORK_PASSPHRASE
        })
      )
    ).toBe(true);
  });

  it("still allows plain http on the local network against loopback", () => {
    expect(
      usesPlainHttp(
        config({
          network: "local",
          horizonUrl: "http://localhost:8000",
          networkPassphrase: STELLAR_LOCAL_NETWORK_PASSPHRASE
        })
      )
    ).toBe(true);
  });
});

describe("createHorizonServer", () => {
  it("constructs a server for a validated configuration without throwing", () => {
    expect(() => createHorizonServer(config({}))).not.toThrow();
    expect(() =>
      createHorizonServer(
        config({
          network: "local",
          horizonUrl: "http://host.docker.internal:8000",
          networkPassphrase: STELLAR_LOCAL_NETWORK_PASSPHRASE
        })
      )
    ).not.toThrow();
  });
});
