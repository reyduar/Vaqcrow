import { randomUUID } from "node:crypto";
import { createOpenCodeGoProvider } from "@vaqcrow/ai";
import { parseApplicationId, parseRevenueShareDistributionId } from "@vaqcrow/contracts";
import type { ApplicationId, CorrelationId } from "@vaqcrow/contracts";
import { parseApiConfig } from "./application/config/api-config.js";
import { confirmRevenueShareDistributions } from "./application/use-cases/confirm-revenue-share-distributions.js";
import { deriveRevenueShareDistribution } from "./application/use-cases/derive-revenue-share-distribution.js";
import { NotificationPublisher } from "./application/use-cases/notification-publisher.js";
import { WALLET_CHALLENGE_TTL_SECONDS } from "./application/use-cases/wallet.js";
import { buildCampaignDependencies } from "./infrastructure/campaign-dependencies.js";
import { createSimulatedSalesDataProvider } from "./infrastructure/adapters/simulated-sales-data-provider.js";
import { StellarLedger } from "./infrastructure/adapters/stellar-ledger.js";
import { StellarRevenueShareDistributionXdr } from "./infrastructure/adapters/stellar-revenue-share-distribution-xdr.js";
import { StellarTransaction } from "./infrastructure/adapters/stellar-transaction.js";
import { StellarWalletSignature } from "./infrastructure/adapters/stellar-wallet-signature.js";
import { SupabaseAuditLog } from "./infrastructure/adapters/supabase-audit-log.js";
import { SupabaseAuth } from "./infrastructure/adapters/supabase-auth.js";
import { SupabaseApplicationReviewRepository } from "./infrastructure/adapters/supabase-application-review-repository.js";
import { SupabaseApplicationAssessmentRepository } from "./infrastructure/adapters/supabase-application-assessment-repository.js";
import { SupabaseBusinessRepository } from "./infrastructure/adapters/supabase-business-repository.js";
import { SupabaseNotificationRepository } from "./infrastructure/adapters/supabase-notification-repository.js";
import { createEmailPort } from "./infrastructure/adapters/resend-email-adapter.js";
import { createDeterministicCompletenessCheckAdapter } from "./infrastructure/adapters/deterministic-completeness-check-adapter.js";
import { SupabaseSmeRequestRepository } from "./infrastructure/adapters/supabase-sme-request-repository.js";
import { SupabaseStorageAdapter } from "./infrastructure/adapters/supabase-storage-adapter.js";
import { SupabaseRevenueShareDistributionRepository } from "./infrastructure/adapters/supabase-revenue-share-distribution-repository.js";
import { SupabaseWalletRepository } from "./infrastructure/adapters/supabase-wallet-repository.js";
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

// The monthly sales feed runs on the simulated provider (issue #83, D2/D3):
// frozen synthetic data, no I/O — a real authorized source would replace it
// here, at the composition root, and nowhere else.
const salesDataProvider = createSimulatedSalesDataProvider();

const smeRequestRepository = new SupabaseSmeRequestRepository(supabase);

// The PyME company (T3b): created and read by owner, and the ownership source
// the sales-feed route scopes a PyME's series to. It also resolves the company
// name the submission notification carries.
const businessRepository = new SupabaseBusinessRepository(supabase);

// The PyME Freighter wallet (#406/#407): one binding shared by the connect route
// and the submission precondition (#402/T1b), so the presence check reads the
// same stored key the connection wrote.
const walletRepository = new SupabaseWalletRepository(supabase);

// Built first: the distribution derivation reconciles the campaign from the chain,
// so it reuses the campaign group's repository and vault chain reader.
const campaign = buildCampaignDependencies(config, {
  supabase,
  applicationReviews: applicationReviewRepository
});

// The distribution derivation (T5a): who is paid and how much is a function of
// the case (settled campaign, approved decision, sales feed), never of the
// request. Prepare and submit share this one binding.
const deriveDistribution =
  campaign === undefined
    ? undefined
    : (input: {
        readonly applicationId: ApplicationId;
        readonly campaignId: string;
        readonly sourceAccountId: string;
        readonly correlationId: CorrelationId;
      }) =>
        deriveRevenueShareDistribution(
          {
            // The campaign group's repository and vault reader, so the derivation
            // reconciles from the chain instead of trusting a stale mirror.
            campaigns: campaign.campaigns,
            chain: campaign.chain,
            applicationReviews: applicationReviewRepository,
            smeRequests: smeRequestRepository,
            salesData: salesDataProvider
          },
          input
        );

// The revenue-share distribution HTTP surface (S2c). Unlike the funding-intent
// and campaign groups, which `index.ts` deliberately leaves unwired today, this
// group is served so the demo can actually call it. `explorerUrl` is
// `undefined` only on the local standalone network, which has no canonical
// block explorer (`StellarConfig`); the route builds a transaction link from it,
// so the group is omitted there rather than handed a base that would produce a
// broken link.
const revenueShareDistributionRepository = new SupabaseRevenueShareDistributionRepository(supabase);

const revenueShareDistribution =
  config.stellar.explorerUrl === undefined || deriveDistribution === undefined
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
        derive: deriveDistribution,
        generateDistributionId: () => parseRevenueShareDistributionId(randomUUID()),
        // R1-002: the ownership source for the distribution's application.
        smeRequests: smeRequestRepository
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

// Identity and audit (Task #370). The audit log is wired here so its first
// callers (#410, #390) only have to consume the port; no route appends yet.
const auth = { port: new SupabaseAuth(supabase) };
const auditLog = new SupabaseAuditLog(supabase);
void auditLog; // not consumed by any route yet

// Notifications (#382/T1c). The repository backs the bell routes below; the
// publisher's first production call site is the submission below (#402/T1b),
// which publishes `admin.new_application` best-effort. Email is optional config:
// with no Resend key the port is a null object, not a misconfig.
const notificationRepository = new SupabaseNotificationRepository(supabase);
const notificationPublisher = new NotificationPublisher({
  repository: notificationRepository,
  email: createEmailPort(config.email),
  appBaseUrl: config.email.appBaseUrl
});

// The completeness check (#402/T1a): deterministic and declared-data only — the
// owner deferred content/vision reading, so no model or storage read is wired.
const completenessCheck = createDeterministicCompletenessCheckAdapter();

const app = buildApp({
  auth,
  applicationReviewRepository,
  revenueShareDistribution,
  assessment: {
    provider: assessmentProvider,
    timeoutMs: config.llm.timeoutMs
  },
  applicationAssessment: {
    repository: applicationReviewRepository,
    assessments: new SupabaseApplicationAssessmentRepository(supabase),
    smeRequests: smeRequestRepository,
    salesData: salesDataProvider,
    provider: assessmentProvider,
    timeoutMs: config.llm.timeoutMs
  },
  campaign,
  salesFeed: { provider: salesDataProvider, businesses: businessRepository },
  smeRequest: {
    repository: smeRequestRepository,
    salesData: salesDataProvider,
    // The submission precondition (#406 seam) and the admin notification.
    wallet: walletRepository,
    businesses: businessRepository,
    notifications: notificationPublisher,
    generateApplicationId: () => parseApplicationId(randomUUID())
  },
  business: { repository: businessRepository },
  // The in-app notification bell (#382/T1c): the signed-in user's own rows.
  notification: { repository: notificationRepository },
  // The completeness check (#402/T1a): gaps warn, they never block the send.
  completenessCheck: { checker: completenessCheck },
  // The PyME Freighter wallet connection (#407/T1b): a signed, single-use
  // challenge proves account ownership before the key is stored on the profile.
  // SEP-53 verification lives in `StellarWalletSignature` (infrastructure/).
  wallet: {
    repository: walletRepository,
    signatures: new StellarWalletSignature(),
    generateChallengeId: () => randomUUID(),
    generateNonce: () => randomUUID(),
    ttlSeconds: WALLET_CHALLENGE_TTL_SECONDS
  },
  // The document/photo transport (#399/T4b): the API validates the bytes and
  // writes to the private `pyme-documents` bucket with `service_role`.
  storage: {
    storage: new SupabaseStorageAdapter(supabase),
    generateObjectId: () => randomUUID()
  },
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
