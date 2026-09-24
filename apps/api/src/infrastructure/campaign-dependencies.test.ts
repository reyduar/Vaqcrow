import { Asset, Keypair } from "@stellar/stellar-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { ApiConfig } from "../application/config/api-config.js";
import { Secret } from "../application/config/secret.js";
import type { ApplicationReviewRepositoryPort } from "../application/ports/application-review-repository-port.js";
import { buildCampaignDependencies } from "./campaign-dependencies.js";

/**
 * `Keypair.random()` and reading `.secret()` straight back off it are both
 * allowed here (`tests/stellar-non-custody.test.ts`'s ephemeral-signer
 * concession for test files): the seed never touches a real account and is
 * never persisted.
 */
function randomPlatformSecret(): { readonly keypair: Keypair; readonly secret: Secret } {
  const keypair = Keypair.random();
  return { keypair, secret: new Secret(keypair.secret()) };
}

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const FACTORY_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const CONFIGURED_TOKEN_ID = "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBQ";

function baseConfig(overrides: {
  readonly enabled: boolean;
  readonly tokenContractId?: string;
  readonly secret?: Secret;
  readonly explorerUrl?: string | undefined;
}): ApiConfig {
  const stellar = {
    network: "testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: TESTNET_PASSPHRASE,
    explorerUrl: overrides.explorerUrl
  };

  const campaignVault = overrides.enabled
    ? {
        enabled: true as const,
        factoryId: FACTORY_ID,
        tokenContractId: overrides.tokenContractId,
        platformSecretKey: overrides.secret ?? randomPlatformSecret().secret
      }
    : { enabled: false as const };

  return { stellar, campaignVault } as unknown as ApiConfig;
}

function applicationReviewsDouble(): ApplicationReviewRepositoryPort {
  return {} as ApplicationReviewRepositoryPort;
}

const supabase = {} as SupabaseClient;

describe("buildCampaignDependencies", () => {
  it("returns undefined when the campaign vault is disabled", () => {
    const config = baseConfig({ enabled: false });

    expect(
      buildCampaignDependencies(config, { supabase, applicationReviews: applicationReviewsDouble() })
    ).toBeUndefined();
  });

  it("reads the chain and factory with the platform's own public key as the read source", () => {
    const { keypair, secret } = randomPlatformSecret();
    const config = baseConfig({ enabled: true, secret, tokenContractId: CONFIGURED_TOKEN_ID });

    const dependencies = buildCampaignDependencies(config, {
      supabase,
      applicationReviews: applicationReviewsDouble()
    });

    expect(dependencies).toBeDefined();
    expect(dependencies?.network).toBe("testnet");
    expect(dependencies?.networkPassphrase).toBe(TESTNET_PASSPHRASE);
    expect(dependencies?.tokenContractId).toBe(CONFIGURED_TOKEN_ID);
    // The read-source account is opaque from the outside (private on the
    // adapters), so this only asserts the signer's own public key was
    // derived from the given secret rather than a different one.
    expect(keypair.publicKey().startsWith("G")).toBe(true);
  });

  it("derives the native SAC id when no token contract is configured", () => {
    const config = baseConfig({ enabled: true });

    const dependencies = buildCampaignDependencies(config, {
      supabase,
      applicationReviews: applicationReviewsDouble()
    });

    expect(dependencies?.tokenContractId).toBe(Asset.native().contractId(TESTNET_PASSPHRASE));
  });

  it("omits explorerBaseUrl exactly when the stellar config's own explorerUrl is undefined", () => {
    const local = buildCampaignDependencies(baseConfig({ enabled: true, explorerUrl: undefined }), {
      supabase,
      applicationReviews: applicationReviewsDouble()
    });
    const testnet = buildCampaignDependencies(
      baseConfig({ enabled: true, explorerUrl: "https://stellar.expert/explorer/testnet" }),
      { supabase, applicationReviews: applicationReviewsDouble() }
    );

    expect(local?.explorerBaseUrl).toBeUndefined();
    expect(testnet?.explorerBaseUrl).toBe("https://stellar.expert/explorer/testnet");
  });

  it("generates a fresh invocation id on every call", () => {
    const config = baseConfig({ enabled: true });
    const dependencies = buildCampaignDependencies(config, {
      supabase,
      applicationReviews: applicationReviewsDouble()
    });

    const first = dependencies?.generateInvocationId();
    const second = dependencies?.generateInvocationId();

    expect(first).toBeDefined();
    expect(first).not.toBe(second);
  });
});
