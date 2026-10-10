import { randomUUID } from "node:crypto";
import { Asset } from "@stellar/stellar-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiConfig } from "../application/config/api-config.js";
import type { ApplicationReviewRepositoryPort } from "../application/ports/application-review-repository-port.js";
import type { BusinessRepositoryPort } from "../application/ports/business-repository-port.js";
import type { SmeRequestRepositoryPort } from "../application/ports/sme-request-repository-port.js";
import type { GetAdminApplicationEvidenceDependencies } from "../application/use-cases/get-admin-application-evidence.js";
import { PlatformSigner } from "./adapters/platform-signer.js";
import { StellarCampaignFactory } from "./adapters/stellar-campaign-factory.js";
import { StellarCampaignVaultChain } from "./adapters/stellar-campaign-vault-chain.js";
import { StellarCampaignVaultInvocation } from "./adapters/stellar-campaign-vault-invocation.js";
import { StellarPlatformAccount } from "./adapters/stellar-platform-account.js";
import { SupabaseCampaignDeploymentRepository } from "./adapters/supabase-campaign-deployment-repository.js";
import { SupabaseCampaignRepository } from "./adapters/supabase-campaign-repository.js";
import { SupabaseRevenueShareDistributionRepository } from "./adapters/supabase-revenue-share-distribution-repository.js";
import { SupabaseRateTableRepository } from "./adapters/supabase-rate-table-repository.js";
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

  // One adapter backs both the campaign mirror and its per-transaction
  // contribution record (#438/WU1): same client, same sanitized error shape.
  const campaigns = new SupabaseCampaignRepository(clients.supabase);

  return {
    applicationReviews: clients.applicationReviews,
    campaigns,
    contributionTransactions: campaigns,
    // A fresh deployment resolves the current rate against this table and
    // snapshots it with the campaign's terms (#410/T3a). The same `fx_rate`
    // table backs the admin rate routes; both adapters only read/write it.
    rates: new SupabaseRateTableRepository(clients.supabase),
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

/**
 * Wires the ADMIN per-application Testnet evidence chain (#438/WU2). Unlike
 * `buildCampaignDependencies` it is never `undefined`: it reads only the stored
 * mirror (no signer, no chain), so it is served whether or not the campaign
 * vault slice is enabled. `explorerBaseUrl` is `undefined` exactly when the
 * network has no canonical explorer, which turns every link into `null`.
 */
export function buildAdminApplicationEvidenceDependencies(
  config: ApiConfig,
  clients: {
    readonly supabase: SupabaseClient;
    readonly applicationReviews: ApplicationReviewRepositoryPort;
    readonly smeRequests: SmeRequestRepositoryPort;
    readonly businesses: BusinessRepositoryPort;
  }
): GetAdminApplicationEvidenceDependencies {
  const campaigns = new SupabaseCampaignRepository(clients.supabase);
  return {
    applicationReviews: clients.applicationReviews,
    smeRequests: clients.smeRequests,
    businesses: clients.businesses,
    deployments: new SupabaseCampaignDeploymentRepository(clients.supabase),
    campaigns,
    contributionTransactions: campaigns,
    distributions: new SupabaseRevenueShareDistributionRepository(clients.supabase),
    explorerBaseUrl: config.stellar.explorerUrl
  };
}
