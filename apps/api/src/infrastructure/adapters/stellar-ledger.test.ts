import { Networks, NotFoundError } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";
import {
  STELLAR_TESTNET_NETWORK_PASSPHRASE,
  parseStellarConfig
} from "../../application/config/stellar-config.js";
import { StellarLedger } from "./stellar-ledger.js";
import type { HorizonAccountSource } from "./stellar-ledger.js";

/**
 * Deterministic Horizon double. The pull-request suite must never reach Testnet
 * or Horizon, so every branch below is driven by this source.
 */
const PUBLIC_KEY = "GDVEU3DDJGBXQKZTPJ7Q2PLZRZXQ4OBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const SEQUENCE = "123456789012345678";

const TESTNET_CONFIG = parseStellarConfig({ STELLAR_NETWORK: "testnet" });
const LOOPBACK_CONFIG = parseStellarConfig({
  STELLAR_NETWORK: "testnet",
  STELLAR_HORIZON_URL: "http://localhost:8000"
});

function createSource(overrides: Partial<HorizonAccountSource> = {}): HorizonAccountSource {
  return {
    loadAccount: vi.fn(async () => ({
      account_id: PUBLIC_KEY,
      sequence: SEQUENCE,
      balances: [
        { asset_type: "native", balance: "10000.0000000" },
        { asset_type: "credit_alphanum4", balance: "50.0000000" }
      ]
    })),
    ...overrides
  };
}

describe("StellarLedger network context", () => {
  it("declares the passphrase the SDK itself uses for Testnet", () => {
    // The passphrase is hashed into every signature. If the constant drifted
    // from the real Testnet value, signatures would be built for a network that
    // does not exist and nothing else in the suite would notice.
    expect(STELLAR_TESTNET_NETWORK_PASSPHRASE).toBe(Networks.TESTNET);
  });

  it("reports the network it was configured for", () => {
    expect(new StellarLedger(TESTNET_CONFIG, createSource()).network).toBe("testnet");
  });

  it("builds its own Horizon client from the validated URL when none is supplied", () => {
    // No network call happens at construction; this proves the default path is
    // wired to configuration rather than to an ambient default.
    expect(() => new StellarLedger(LOOPBACK_CONFIG)).not.toThrow();
  });
});

describe("StellarLedger.getAccount", () => {
  it("returns the public account with its native balance in stroops", async () => {
    const ledger = new StellarLedger(TESTNET_CONFIG, createSource());

    await expect(ledger.getAccount(PUBLIC_KEY)).resolves.toEqual({
      ok: true,
      value: {
        accountId: PUBLIC_KEY,
        sequence: SEQUENCE,
        nativeBalanceStroops: 100000000000n
      }
    });
  });

  it("returns a balance that stays an integer past the range of a number", async () => {
    const ledger = new StellarLedger(
      TESTNET_CONFIG,
      createSource({
        loadAccount: vi.fn(async () => ({
          account_id: PUBLIC_KEY,
          sequence: SEQUENCE,
          balances: [{ asset_type: "native", balance: "922337203685.4775807" }]
        }))
      })
    );

    const result = await ledger.getAccount(PUBLIC_KEY);

    expect(result).toEqual({
      ok: true,
      value: {
        accountId: PUBLIC_KEY,
        sequence: SEQUENCE,
        nativeBalanceStroops: 9223372036854775807n
      }
    });
  });

  it("treats an unfunded account as an expected outcome, not a failure", async () => {
    const ledger = new StellarLedger(
      TESTNET_CONFIG,
      createSource({
        loadAccount: vi.fn(async () => {
          throw new NotFoundError("Not Found", { status: 404 });
        })
      })
    );

    await expect(ledger.getAccount(PUBLIC_KEY)).resolves.toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("recognises a 404 that did not arrive as the SDK error type", async () => {
    const ledger = new StellarLedger(
      TESTNET_CONFIG,
      createSource({
        loadAccount: vi.fn(async () => {
          throw { response: { status: 404 } };
        })
      })
    );

    await expect(ledger.getAccount(PUBLIC_KEY)).resolves.toEqual({
      ok: false,
      error: { code: "not_found" }
    });
  });

  it("reports an unreachable ledger as unavailable, without leaking the cause", async () => {
    const ledger = new StellarLedger(
      TESTNET_CONFIG,
      createSource({
        loadAccount: vi.fn(async () => {
          throw new Error("connect ECONNREFUSED 127.0.0.1:8000");
        })
      })
    );

    const result = await ledger.getAccount(PUBLIC_KEY);

    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(JSON.stringify(result)).not.toContain("ECONNREFUSED");
  });

  it("asks for one public address and nothing else", async () => {
    const loadAccount = vi.fn(async () => ({
      account_id: PUBLIC_KEY,
      sequence: SEQUENCE,
      balances: [{ asset_type: "native", balance: "1.0000000" }]
    }));
    const ledger = new StellarLedger(TESTNET_CONFIG, createSource({ loadAccount }));

    await ledger.getAccount(PUBLIC_KEY);

    expect(loadAccount).toHaveBeenCalledExactlyOnceWith(PUBLIC_KEY);
  });

  it("refuses to invent a balance when Horizon omits the native line", async () => {
    // Deliberately not folded into `unavailable`: Horizon answered, and the
    // answer was wrong. Reporting an outage here would turn a real anomaly into
    // a fake one and hide it from the correlation id that would surface it.
    const ledger = new StellarLedger(
      TESTNET_CONFIG,
      createSource({
        loadAccount: vi.fn(async () => ({
          account_id: PUBLIC_KEY,
          sequence: SEQUENCE,
          balances: [{ asset_type: "credit_alphanum4", balance: "50.0000000" }]
        }))
      })
    );

    await expect(ledger.getAccount(PUBLIC_KEY)).rejects.toThrow(/without a native balance/);
  });
});
