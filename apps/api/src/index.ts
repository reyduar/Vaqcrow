import { randomUUID } from "node:crypto";
import { createOpenCodeGoProvider, createOpenCodeGoVisionProvider } from "@vaqcrow/ai";
import { parseApplicationId, parseRevenueShareDistributionId } from "@vaqcrow/contracts";
import type { ApplicationId, CorrelationId } from "@vaqcrow/contracts";
import { parseApiConfig } from "./application/config/api-config.js";
import { confirmRevenueShareDistributions } from "./application/use-cases/confirm-revenue-share-distributions.js";
import { deployApprovedCampaign } from "./application/use-cases/deploy-approved-campaign.js";
import { deriveRevenueShareDistribution } from "./application/use-cases/derive-revenue-share-distribution.js";
import { createAdminReviewContextRouteDependencies } from "./infrastructure/http/routes/admin-review-context.route.js";
import { createDocumentVerdictRouteDependencies } from "./infrastructure/http/routes/document-verdict.route.js";
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
import { SupabaseSalesPeriodRepository } from "./infrastructure/adapters/supabase-sales-period-repository.js";
import { SupabaseCampaignDeploymentRepository } from "./infrastructure/adapters/supabase-campaign-deployment-repository.js";
import { SupabaseDocumentVerdictRepository } from "./infrastructure/adapters/supabase-document-verdict-repository.js";
import { SupabaseFavoriteRepository } from "./infrastructure/adapters/supabase-favorite-repository.js";
import { SupabaseInvestorKycRepository } from "./infrastructure/adapters/supabase-investor-kyc-repository.js";
import { SupabasePymeDocumentRepository } from "./infrastructure/adapters/supabase-pyme-document-repository.js";
import { SupabaseNotificationRepository } from "./infrastructure/adapters/supabase-notification-repository.js";
import { SupabaseMarketplaceCampaignRepository } from "./infrastructure/adapters/supabase-marketplace-campaign-repository.js";
import { SupabaseCampaignDetailRepository } from "./infrastructure/adapters/supabase-campaign-detail-repository.js";
import { SupabasePortfolioRepository } from "./infrastructure/adapters/supabase-portfolio-repository.js";
import { SupabaseReportsRepository } from "./infrastructure/adapters/supabase-reports-repository.js";
import { createEmailPort } from "./infrastructure/adapters/resend-email-adapter.js";
import { createContentAwareCompletenessCheckAdapter } from "./infrastructure/adapters/content-aware-completeness-check-adapter.js";
import { createPdfiumPdfRasterizerAdapter } from "./infrastructure/adapters/pdfium-pdf-rasterizer-adapter.js";
import { SupabaseSmeRequestRepository } from "./infrastructure/adapters/supabase-sme-request-repository.js";
import { SupabaseStorageAdapter } from "./infrastructure/adapters/supabase-storage-adapter.js";
import { SupabaseRevenueShareDistributionRepository } from "./infrastructure/adapters/supabase-revenue-share-distribution-repository.js";
import { SupabaseWalletRepository } from "./infrastructure/adapters/supabase-wallet-repository.js";
import { SupabaseRateTableRepository } from "./infrastructure/adapters/supabase-rate-table-repository.js";
import { buildApp } from "./infrastructure/http/build-app.js";
import { createSubmissionAssessment } from "./infrastructure/submission-assessment.js";
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
const applicationAssessmentRepository = new SupabaseApplicationAssessmentRepository(supabase);

// Per-document KYC/KYB verdicts (#410/U1, D8): written by the ADMIN verdict
// route and read back into the review context.
const documentVerdictRepository = new SupabaseDocumentVerdictRepository(supabase);

// The monthly sales feed runs on the simulated provider (issue #83, D2/D3):
// frozen synthetic data, no I/O — a real authorized source would replace it
// here, at the composition root, and nowhere else.
const salesDataProvider = createSimulatedSalesDataProvider();

const smeRequestRepository = new SupabaseSmeRequestRepository(supabase);

// The persisted monthly sales series (#422/WU2b): the campaign detail reads it
// through the `marketplace_campaign_detail` view, and it is written from the
// deterministic sales feed so both surfaces agree by construction.
const salesPeriodRepository = new SupabaseSalesPeriodRepository(supabase);

// The PyME company (T3b): created and read by owner, and the ownership source
// the sales-feed route scopes a PyME's series to. It also resolves the company
// name the submission notification carries, and persists the business's
// deterministic sales series when it is registered (#422/WU2b).
const businessRepository = new SupabaseBusinessRepository(supabase, {
  salesData: salesDataProvider,
  salesPeriods: salesPeriodRepository
});

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

/**
 * The content-relevance vision engine (Feature #402, U3) and the completeness
 * check it now powers (U5). The checker composes the pure declared-data rules
 * with a content pass: it resolves the owner's persisted `pyme_document` rows,
 * reads the bytes, rasterizes a PDF's first page and asks the vision provider
 * whether the image is the document it claims to be. An irrelevant document is a
 * `gap` that warns but never blocks; a failure to judge one is an honest
 * `warning`, never a silent pass.
 */
const visionProvider = createOpenCodeGoVisionProvider({
  baseUrl: config.llm.baseUrl,
  model: config.llm.visionModel,
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

// The persistence + storage bindings the upload route and the content-aware
// check share: each object is written once and read back through the same
// service_role client.
const storageAdapter = new SupabaseStorageAdapter(supabase);
const pymeDocumentRepository = new SupabasePymeDocumentRepository(supabase);
const rateTableRepository = new SupabaseRateTableRepository(supabase);

// The public marketplace listing (#414/WU1): reads the joined
// `marketplace_campaign` view as service_role. It carries no PII and only
// published (confirmed vault, open campaign) rows.
const marketplaceCampaignRepository = new SupabaseMarketplaceCampaignRepository(supabase);

// The account-gated campaign detail (#422/WU1): reads the joined
// `marketplace_campaign_detail` view as service_role. No PII; published rows only.
const campaignDetailRepository = new SupabaseCampaignDetailRepository(supabase);

// The per-account favorites surface (#414/WU2): reads and writes
// `campaign_favorite` as service_role, always scoped by the verified
// principal's user_id. Anonymous visitors retain nothing (owner decision D1).
const favoriteRepository = new SupabaseFavoriteRepository(supabase);

// The investor's simulated KYC (#422/WU4): reads and writes `investor_kyc` as
// service_role, always scoped by the verified principal's user_id. The approval
// is simulated and auto-granted at the first contribution (owner decision D2).
const investorKycRepository = new SupabaseInvestorKycRepository(supabase);

// The investor's portfolio read model (#426/WU1): reads the two
// service_role-only views scoped by the investor's own profile key. The account
// is resolved server-side from the verified principal, never the request.
const portfolioRepository = new SupabasePortfolioRepository(supabase);

// The investor report read model (#430/WU1): reads the three
// service_role-only report views scoped by the verified principal's own profile
// key, resolved server-side, never the request. The sales block shares the same
// account resolution so both endpoints agree.
const reportsRepository = new SupabaseReportsRepository(supabase);

// The vault-deployment lifecycle (#410/T5b): one durable row per approved
// application. The admin route deploys/retries explicitly, and an applied
// `approved` decision advances it best-effort. It reuses the campaign group's
// engine, so it is only wired when the campaign vault slice is enabled.
const deploymentRepository = new SupabaseCampaignDeploymentRepository(supabase);

const deployApproved =
  campaign === undefined
    ? undefined
    : (input: { readonly applicationId: ApplicationId; readonly correlationId: CorrelationId }) =>
        deployApprovedCampaign(
          {
            applicationReviews: applicationReviewRepository,
            deployments: deploymentRepository,
            smeRequests: smeRequestRepository,
            businesses: businessRepository,
            wallet: walletRepository,
            // The same rate table the campaign snapshot reads; the conversion
            // for goal ARS->stroops uses its current row.
            rates: rateTableRepository,
            campaigns: campaign.campaigns,
            accounts: campaign.accounts,
            factory: campaign.factory,
            chain: campaign.chain,
            network: campaign.network,
            tokenContractId: campaign.tokenContractId,
            notifications: notificationPublisher,
            now: () => new Date()
          },
          input
        );

const campaignDeployment =
  deployApproved === undefined
    ? undefined
    : { deployments: deploymentRepository, deploy: deployApproved, now: () => new Date() };

const humanDecisionDeployment = deployApproved === undefined ? undefined : { onApproved: deployApproved };

// The completeness check (#402/T1a, extended by U5): the declared rules run
// first, then the persisted documents are read and judged. Gaps warn, they never
// block the send.
const completenessCheck = createContentAwareCompletenessCheckAdapter({
  documents: pymeDocumentRepository,
  storage: storageAdapter,
  rasterizer: createPdfiumPdfRasterizerAdapter(),
  vision: visionProvider
});

// The application-scoped assessment (Feature #22/#30): the admin route and the
// background run a real submission starts (U12) share these exact dependencies,
// so both use the same provider, timeout and evidence derivation.
const applicationAssessmentDependencies = {
  repository: applicationReviewRepository,
  assessments: applicationAssessmentRepository,
  smeRequests: smeRequestRepository,
  salesData: salesDataProvider,
  provider: assessmentProvider,
  timeoutMs: config.llm.timeoutMs
};

const app = buildApp({
  auth,
  applicationReviewRepository,
  // A recorded changes-requested/rejected decision notifies the application's
  // owner (#410/T4a): the SME request resolves the owner, the publisher delivers
  // the in-app row and email addressed to that user alone.
  humanDecisionNotifications: {
    smeRequests: smeRequestRepository,
    notifications: notificationPublisher
  },
  // An applied approval advances the vault deploy without blocking the
  // decision response (#410/T5b).
  humanDecisionDeployment,
  adminReviewContext: createAdminReviewContextRouteDependencies({
    applicationReviews: applicationReviewRepository,
    smeRequests: smeRequestRepository,
    businesses: businessRepository,
    documents: pymeDocumentRepository,
    assessments: applicationAssessmentRepository,
    verdicts: documentVerdictRepository
  }),
  documentVerdict: createDocumentVerdictRouteDependencies({
    applicationReviews: applicationReviewRepository,
    smeRequests: smeRequestRepository,
    documents: pymeDocumentRepository,
    verdicts: documentVerdictRepository
  }),
  revenueShareDistribution,
  assessment: {
    provider: assessmentProvider,
    timeoutMs: config.llm.timeoutMs
  },
  applicationAssessment: applicationAssessmentDependencies,
  campaign,
  campaignDeployment,
  salesFeed: { provider: salesDataProvider, businesses: businessRepository, salesPeriods: salesPeriodRepository },
  smeRequest: {
    repository: smeRequestRepository,
    salesData: salesDataProvider,
    // The submission precondition (#406 seam) and the admin notification.
    wallet: walletRepository,
    businesses: businessRepository,
    notifications: notificationPublisher,
    generateApplicationId: () => parseApplicationId(randomUUID()),
    // An applied submission starts the advisory assessment in the background
    // (U12): never awaited, never failing the send.
    assessment: createSubmissionAssessment(applicationAssessmentDependencies)
  },
  business: { repository: businessRepository },
  // The in-app notification bell (#382/T1c): the signed-in user's own rows.
  notification: { repository: notificationRepository },
  // The completeness check (#402/T1a, U5): declared gaps and content findings
  // warn, they never block the send.
  completenessCheck: { checker: completenessCheck },
  rateTable: { repository: rateTableRepository },
  // The public marketplace listing (#414/WU1) and the real PyME photo it
  // serves (#414/WU3): published campaigns only. The image route reads the
  // bytes through the same storage adapter the upload/content checks use.
  marketplace: { campaigns: marketplaceCampaignRepository, storage: storageAdapter, detail: campaignDetailRepository },
  // Per-account favorites (#414/WU2): the signed-in caller's own rows only.
  favorite: { favorites: favoriteRepository },
  // The investor's simulated KYC (#422/WU4): the signed-in caller's own state
  // only, auto-approved at the first contribution.
  investorKyc: { kyc: investorKycRepository },
  // The investor's portfolio (#426/WU1): the verified principal's Stellar key
  // resolves the account server-side, and only that account's own rows are read.
  portfolio: { wallets: walletRepository, portfolio: portfolioRepository, now: () => new Date() },
  // The investor report (#430/WU1): every authenticated role reads the report
  // and its independently fetched sales block, always scoped to the verified
  // principal's own stored Stellar key.
  reports: { wallets: walletRepository, reports: reportsRepository, now: () => new Date() },
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
  // writes to the private `pyme-documents` bucket with `service_role`, recording
  // the row the content-relevance check (U5) will resolve server-side.
  storage: {
    storage: storageAdapter,
    documents: pymeDocumentRepository,
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
