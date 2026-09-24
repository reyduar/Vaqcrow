import { randomUUID } from "node:crypto";
import { Asset } from "@stellar/stellar-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiConfig } from "../application/config/api-config.js";
import type { ApplicationReviewRepositoryPort } from "../application/ports/application-review-repository-port.js";
import { PlatformSigner } from "./adapters/platform-signer.js";
import { StellarCampaignFactory } from "./adapters/stellar-campaign-factory.js";
import { StellarCampaignVaultChain } from "./adapters/stellar-campaign-vault-chain.js";
import { StellarCampaignVaultInvocation } from "./adapters/stellar-campaign-vault-invocation.js";
import { StellarPlatformAccount } from "./adapters/stellar-platform-account.js";
import { SupabaseCampaignRepository } from "./adapters/supabase-campaign-repository.js";
import type { CampaignRouteDependencies } from "./http/routes/campaign.route.js";

/**
 * Wires the campaign vault journey's dependencies (`#247` U5) from validated
 * configuration — the composition root's own pure factory, pulled out of
 * `index.ts` so it is unit-testable without a real Supabase project or a
 * live Stellar network: every adapter constructed here only stores its
 * configuration at construction time, it performs no I/O.
 *
 * `undefined` when `config.campaignVault.enabled` is `false` — `index.ts`
 * then never registers the campaign routes at all (`buildApp` only wires a
 * route when its dependency group is supplied), matching the same
 * optional-slice pattern `CampaignVaultConfig` itself documents.
 */
export function buildCampaignDependencies(
  config: ApiConfig,
  clients: {
    readonly supabase: SupabaseClient;
    readonly applicationReviews: ApplicationReviewRepositoryPort;
  }
): CampaignRouteDependencies | undefined {
  if (!config.campaignVault.enabled) {
    return undefined;
  }

  const signer = new PlatformSigner(config.campaignVault.platformSecretKey);

  // The native XLM SAC id, derived rather than hardcoded when the operator
  // has not pinned one explicitly — `Asset.native().contractId(...)` is
  // deterministic per network passphrase, so this never disagrees with a
  // value someone else derived the same way.
  const tokenContractId = config.campaignVault.tokenContractId ?? Asset.native().contractId(config.stellar.networkPassphrase);

  return {
    applicationReviews: clients.applicationReviews,
    campaigns: new SupabaseCampaignRepository(clients.supabase),
    accounts: new StellarPlatformAccount(config.stellar, signer),
    factory: new StellarCampaignFactory(
      { ...config.stellar, factoryId: config.campaignVault.factoryId, readSourceAccountId: signer.publicKey },
      signer
    ),
    // The platform's own account, reused as the read-only source `simulateTransaction`
    // requires — nothing about a read depends on which account that is (D-U3 note).
    chain: new StellarCampaignVaultChain({ ...config.stellar, readSourceAccountId: signer.publicKey }),
    invocations: new StellarCampaignVaultInvocation(config.stellar),
    network: config.stellar.network,
    networkPassphrase: config.stellar.networkPassphrase,
    tokenContractId,
    explorerBaseUrl: config.stellar.explorerUrl,
    generateInvocationId: () => randomUUID()
  };
}
