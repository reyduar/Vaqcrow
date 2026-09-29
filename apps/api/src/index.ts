import { randomUUID } from "node:crypto";
import { createOpenCodeGoProvider } from "@vaqcrow/ai";
import { generateCorrelationId, parseRevenueShareDistributionId } from "@vaqcrow/contracts";
import { parseApiConfig } from "./application/config/api-config.js";
import { DEFAULT_CONFIRMATION_POLICY } from "./application/use-cases/confirm-funding-intents.js";
import { confirmRevenueShareDistributions } from "./application/use-cases/confirm-revenue-share-distributions.js";
import { buildCampaignDependencies } from "./infrastructure/campaign-dependencies.js";
import { createSimulatedSalesDataProvider } from "./infrastructure/adapters/simulated-sales-data-provider.js";
import { StellarLedger } from "./infrastructure/adapters/stellar-ledger.js";
import { StellarRevenueShareDistributionXdr } from "./infrastructure/adapters/stellar-revenue-share-distribution-xdr.js";
import { StellarTransaction } from "./infrastructure/adapters/stellar-transaction.js";
import { SupabaseApplicationReviewRepository } from "./infrastructure/adapters/supabase-application-review-repository.js";
import { SupabaseRevenueShareDistributionRepository } from "./infrastructure/adapters/supabase-revenue-share-distribution-repository.js";
import { buildApp } from "./infrastructure/http/build-app.js";
import { DEFAULT_CONFIRMATION_INTERVAL_MS } from "./infrastructure/scheduling/confirmation-scheduler.js";
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
 * The funding-intent confirmation scheduler is not started from this composition
 * root today — `ConfirmationScheduler` is exercised by tests only — so there was
 * no existing start-up call to mirror. It is also typed to the funding-intent use
 * case and cannot drive the distribution one without a generic scheduler, and
 * that extraction sits outside this slice's file budget. What is left is this
 * loop, which follows that scheduler's documented shape: a recursive
 * `setTimeout` so a slow Horizon call cannot let ticks overlap, an `unref`ed
 * timer so the HTTP server alone keeps the process alive, and no in-process
 * state so a restart resumes from the persisted `next_attempt_at`. The policy and
 * interval are the existing confirmation constants, not new ones.
 */
const distributionTransaction = new StellarTransaction(config.stellar);

let distributionConfirmationTimer: ReturnType<typeof setTimeout> | undefined;
let distributionConfirmationInFlight: Promise<void> | undefined;
let distributionConfirmationStopped = true;

async function runDistributionConfirmation(): Promise<void> {
  try {
    await confirmRevenueShareDistributions(
      { repository: revenueShareDistributionRepository, transaction: distributionTransaction },
      {
        now: new Date().toISOString(),
        // One id per tick: every write a tick causes belongs to that execution.
        correlationId: generateCorrelationId(),
        policy: DEFAULT_CONFIRMATION_POLICY
      }
    );
  } catch (error) {
    // The loop survives, but the failure is not silent: a tick that cannot run
    // at all is usually the database or Horizon being briefly unreachable —
    // precisely when the loop must keep going, and precisely when an operator
    // needs to know it is happening.
    app.log.error({ err: error }, "revenue-share distribution confirmation tick failed");
  }
}

function scheduleDistributionConfirmation(): void {
  if (distributionConfirmationStopped) {
    return;
  }

  distributionConfirmationTimer = setTimeout(() => {
    distributionConfirmationInFlight = runDistributionConfirmation().finally(() => {
      distributionConfirmationInFlight = undefined;
      // Re-armed once the tick completes, which is what makes overlap impossible.
      scheduleDistributionConfirmation();
    });
  }, DEFAULT_CONFIRMATION_INTERVAL_MS);

  distributionConfirmationTimer.unref?.();
}

async function stopDistributionConfirmation(): Promise<void> {
  distributionConfirmationStopped = true;

  if (distributionConfirmationTimer !== undefined) {
    clearTimeout(distributionConfirmationTimer);
    distributionConfirmationTimer = undefined;
  }

  // Wait for the tick in flight so a clean restart cannot leave a write running
  // against a closing process.
  await distributionConfirmationInFlight;
}

await app.listen({ port: config.port, host: "0.0.0.0" });

distributionConfirmationStopped = false;
scheduleDistributionConfirmation();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void (async () => {
      await stopDistributionConfirmation();
      await app.close();
      process.exit(0);
    })();
  });
}
