import { randomUUID } from "node:crypto";
import { createOpenCodeGoProvider } from "@vaqcrow/ai";
import { parseRevenueShareDistributionId } from "@vaqcrow/contracts";
import { parseApiConfig } from "./application/config/api-config.js";
import { confirmRevenueShareDistributions } from "./application/use-cases/confirm-revenue-share-distributions.js";
import { buildCampaignDependencies } from "./infrastructure/campaign-dependencies.js";
import { createSimulatedSalesDataProvider } from "./infrastructure/adapters/simulated-sales-data-provider.js";
import { StellarLedger } from "./infrastructure/adapters/stellar-ledger.js";
import { StellarRevenueShareDistributionXdr } from "./infrastructure/adapters/stellar-revenue-share-distribution-xdr.js";
import { StellarTransaction } from "./infrastructure/adapters/stellar-transaction.js";
import { SupabaseApplicationReviewRepository } from "./infrastructure/adapters/supabase-application-review-repository.js";
import { SupabaseRevenueShareDistributionRepository } from "./infrastructure/adapters/supabase-revenue-share-distribution-repository.js";
import { buildApp } from "./infrastructure/http/build-app.js";
import { ConfirmationScheduler } from "./infrastructure/scheduling/confirmation-scheduler.js";
import { DEFAULT_CONFIRMATION_POLICY } from "./infrastructure/scheduling/confirmation-policy.js";
import { createSupabaseClient } from "./infrastructure/supabase/create-supabase-client.js";

// Fail fast and clearly: a missing or out-of-scope value stops the process here
// with every offending key listed, rather than surfacing at the first request.
const config = parseApiConfig(process.env);

// One client, shared by every repository: the process holds a single
// connection pool, not one per adapter.
const supabase = createSupabaseClient(config.supabase);

const applicationReviewRepository = new SupabaseApplicationReviewRepository(supabase);

// The revenue-share distribution HTTP surface (S2c). Unlike the funding-intent
// and campaign groups, which `index.ts` deliberately leaves unwired today, this
// group is served so the demo can actually call it. `explorerUrl` is
// `undefined` only on the local standalone network, which has no canonical
// block explorer (`StellarConfig`); the route builds a transaction link from it,
// so the group is omitted there rather than handed a base that would produce a
// broken link.
const revenueShareDistributionRepository = new SupabaseRevenueShareDistributionRepository(supabase);

const revenueShareDistribution =
  config.stellar.explorerUrl === undefined
    ? undefined
    : {
        ledger: new StellarLedger(config.stellar),
        xdr: new StellarRevenueShareDistributionXdr(),
        repository: revenueShareDistributionRepository,
        network: {
          network: config.stellar.network,
          networkPassphrase: config.stellar.networkPassphrase
        },
        explorerBaseUrl: config.stellar.explorerUrl,
        generateDistributionId: () => parseRevenueShareDistributionId(randomUUID())
      };

/**
 * The composition root is the one place the credential is unwrapped.
 *
 * `config.llm.apiKey` is a `Secret` that collapses to a marker under string
 * coercion, so it cannot reach a log line by accident; `reveal()` is greppable
 * in review, and this call site is the only one. The adapter receives a plain
 * string and never returns it.
 */
const assessmentProvider = createOpenCodeGoProvider({
  baseUrl: config.llm.baseUrl,
  model: config.llm.model,
  apiKey: config.llm.apiKey.reveal(),
  timeoutMs: config.llm.timeoutMs
});

const campaign = buildCampaignDependencies(config, {
  supabase,
  applicationReviews: applicationReviewRepository
});

// The monthly sales feed runs on the simulated provider (issue #83, D2/D3):
// frozen synthetic data, no I/O — a real authorized source would replace it
// here, at the composition root, and nowhere else.
const salesDataProvider = createSimulatedSalesDataProvider();

const app = buildApp({
  applicationReviewRepository,
  revenueShareDistribution,
  assessment: {
    provider: assessmentProvider,
    timeoutMs: config.llm.timeoutMs
  },
  applicationAssessment: {
    repository: applicationReviewRepository,
    provider: assessmentProvider,
    timeoutMs: config.llm.timeoutMs
  },
  campaign,
  salesFeed: { provider: salesDataProvider },
  cors: config.cors
});

/**
 * The revenue-share distribution confirmation loop (S2d).
 *
 * The funding-intent confirmation loop is still not started from this composition
 * root today — it is exercised by tests only — so only the distribution loop runs
 * in production. Both loops are now driven by the same `ConfirmationScheduler`,
 * which owns the recursive `setTimeout` (so a slow Horizon call cannot let ticks
 * overlap), the `unref`ed timer (so the HTTP server alone keeps the process
 * alive) and the shared confirmation policy. Before the scheduler was generalized
 * this loop had to duplicate all of that here, because the class was typed to the
 * funding-intent use case.
 */
const distributionTransaction = new StellarTransaction(config.stellar);

const distributionConfirmation = new ConfirmationScheduler(
  (input) =>
    confirmRevenueShareDistributions(
      { repository: revenueShareDistributionRepository, transaction: distributionTransaction },
      input
    ),
  {
    policy: DEFAULT_CONFIRMATION_POLICY,
    onError: (error) => {
      // The loop survives, but the failure is not silent: a tick that cannot run
      // at all is usually the database or Horizon being briefly unreachable —
      // precisely when the loop must keep going, and precisely when an operator
      // needs to know it is happening.
      app.log.error({ err: error }, "revenue-share distribution confirmation tick failed");
    }
  }
);

await app.listen({ port: config.port, host: "0.0.0.0" });

distributionConfirmation.start();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void (async () => {
      await distributionConfirmation.stop();
      await app.close();
      process.exit(0);
    })();
  });
}
