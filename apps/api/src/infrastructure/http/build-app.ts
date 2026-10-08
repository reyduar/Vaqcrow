import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { generateCorrelationId } from "@vaqcrow/contracts";
import Fastify from "fastify";
import type { FastifyError, FastifyInstance } from "fastify";
import type { ApplicationReviewRepositoryPort } from "../../application/ports/application-review-repository-port.js";
import type { DecisionDeploymentDependencies, DecisionNotificationDependencies } from "../../application/use-cases/record-human-decision.js";
import { MAX_UPLOAD_BYTES } from "../../application/storage/document-upload.js";
import { registerAuthorizationHook } from "./authorization-hook.js";
import type { AuthorizationDependencies } from "./authorization-hook.js";
import { registerAdminReviewContextRoute } from "./routes/admin-review-context.route.js";
import type { AdminReviewContextRouteDependencies } from "./routes/admin-review-context.route.js";
import { registerApplicationAssessmentRoute } from "./routes/application-assessment.route.js";
import type { ApplicationAssessmentRouteDependencies } from "./routes/application-assessment.route.js";
import { registerApplicationManualReviewRoute } from "./routes/application-manual-review.route.js";
import { registerAssessmentRoute } from "./routes/assessment.route.js";
import type { AssessmentRouteDependencies } from "./routes/assessment.route.js";
import { registerBusinessRoute } from "./routes/business.route.js";
import type { BusinessRouteDependencies } from "./routes/business.route.js";
import { registerCampaignRoute } from "./routes/campaign.route.js";
import type { CampaignRouteDependencies } from "./routes/campaign.route.js";
import { registerCampaignDeploymentRoute } from "./routes/campaign-deployment.route.js";
import type { CampaignDeploymentRouteDependencies } from "./routes/campaign-deployment.route.js";
import { registerDocumentVerdictRoute } from "./routes/document-verdict.route.js";
import type { DocumentVerdictRouteDependencies } from "./routes/document-verdict.route.js";
import { registerCompletenessCheckRoute } from "./routes/completeness-check.route.js";
import type { CompletenessCheckRouteDependencies } from "./routes/completeness-check.route.js";
import { registerFundingIntentRoute } from "./routes/funding-intent.route.js";
import type { FundingIntentRouteDependencies } from "./routes/funding-intent.route.js";
import { registerHealthRoute } from "./routes/health.route.js";
import { registerHumanDecisionRoute } from "./routes/human-decision.route.js";
import { registerNotificationRoute } from "./routes/notification.route.js";
import type { NotificationRouteDependencies } from "./routes/notification.route.js";
import { registerRevenueShareDistributionRoute } from "./routes/revenue-share-distribution.route.js";
import type { RevenueShareDistributionRouteDependencies } from "./routes/revenue-share-distribution.route.js";
import { registerSmeRequestRoute } from "./routes/sme-request.route.js";
import type { SmeRequestRouteDependencies } from "./routes/sme-request.route.js";
import { registerSalesFeedRoute } from "./routes/sales-feed.route.js";
import type { SalesFeedRouteDependencies } from "./routes/sales-feed.route.js";
import { registerStorageRoute } from "./routes/storage.route.js";
import type { StorageRouteDependencies } from "./routes/storage.route.js";
import { registerWalletRoute } from "./routes/wallet.route.js";
import type { WalletRouteDependencies } from "./routes/wallet.route.js";
import { registerRateTableRoute } from "./routes/rate-table.route.js";
import type { RateTableRouteDependencies } from "./routes/rate-table.route.js";

/**
 * Fastify's own 4xx errors (body parsing, media type, body size, schema
 * validation) carry fixed framework text, never request or provider data, so
 * their default body is kept unchanged.
 */
function isFrameworkClientError(error: FastifyError): boolean {
  const status = error.statusCode;
  if (status === undefined || status < 400 || status >= 500) return false;
  // `code` is typed as a string but is absent on plain errors thrown by handlers.
  return error.validation !== undefined || (typeof error.code === "string" && error.code.startsWith("FST_"));
}

/**
 * Anything else that escapes a route is unexpected: answer a bare
 * `500 { code: "internal" }` and log only the error name, never its message
 * (it could echo provider details or request data). Fastify's logger is
 * disabled, so this follows the adapters' `console.error` convention.
 */
function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (isFrameworkClientError(error)) {
      return reply.send(error);
    }
    // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
    console.error("[HttpErrorHandler] unhandled error", {
      cause: error instanceof Error ? error.name : "unknown",
      statusCode: typeof error.statusCode === "number" ? error.statusCode : 500,
      correlationId: request.id
    });
    return reply.code(500).send({ code: "internal" });
  });
}

function assertRandomUUIDAvailable(): void {
  const crypto = Reflect.get(globalThis, "crypto") as { randomUUID?: unknown } | undefined;

  if (typeof crypto?.randomUUID !== "function") {
    throw new Error("Web Crypto randomUUID is required");
  }
}

export function buildApp(dependencies: {
  readonly applicationReviewRepository?: ApplicationReviewRepositoryPort;
  /**
   * Optional audience for a recorded decision's owner notification. When
   * omitted, decisions still record but do not notify.
   */
  readonly humanDecisionNotifications?: DecisionNotificationDependencies;
  /**
   * Optional trigger that advances the vault deployment for an applied approved
   * decision (#410/T5b). When omitted, decisions still record but do not deploy.
   */
  readonly humanDecisionDeployment?: DecisionDeploymentDependencies | undefined;
  readonly adminReviewContext?: AdminReviewContextRouteDependencies;
  /** Per-document KYC/KYB verdicts in the admin review (#410/U1). */
  readonly documentVerdict?: DocumentVerdictRouteDependencies;
  readonly fundingIntent?: FundingIntentRouteDependencies;
  readonly revenueShareDistribution?: RevenueShareDistributionRouteDependencies | undefined;
  readonly assessment?: AssessmentRouteDependencies;
  readonly applicationAssessment?: ApplicationAssessmentRouteDependencies;
  readonly campaign?: CampaignRouteDependencies | undefined;
  /**
   * The vault-deployment lifecycle surface (#410/T5b): deploy/retry and the
   * read-only detail. Omitted when the campaign vault slice is disabled.
   */
  readonly campaignDeployment?: CampaignDeploymentRouteDependencies | undefined;
  readonly salesFeed?: SalesFeedRouteDependencies;
  readonly smeRequest?: SmeRequestRouteDependencies;
  readonly storage?: StorageRouteDependencies;
  readonly business?: BusinessRouteDependencies;
  readonly wallet?: WalletRouteDependencies;
  readonly notification?: NotificationRouteDependencies;
  readonly completenessCheck?: CompletenessCheckRouteDependencies;
  readonly rateTable?: RateTableRouteDependencies;
  readonly cors?: { readonly allowedOrigins: readonly string[] };
  /**
   * Required in production (`index.ts` wires the Supabase adapter). When omitted,
   * every non-public route still denies with 401.
   */
  readonly auth?: AuthorizationDependencies;
  /** Registration observer, used by the policy coverage test. */
  readonly observeRoutes?: (route: { method: string; url: string }) => void;
} = {}): FastifyInstance {
  assertRandomUUIDAvailable();

  const app = Fastify({
    logger: false,
    requestIdHeader: false,
    genReqId: generateCorrelationId
  });
  // load order: ecosystem plugins -> custom plugins -> decorators -> hooks -> routes
  if (dependencies.cors && dependencies.cors.allowedOrigins.length > 0) {
    const allowedOrigins = [...dependencies.cors.allowedOrigins];
    void app.register(cors, {
      origin: allowedOrigins,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["authorization", "content-type", "x-correlation-id"],
      exposedHeaders: ["x-correlation-id"],
      credentials: false
    });
  }
  app.addHook("onRequest", (request, reply, done) => {
    reply.header("x-correlation-id", request.id);
    done();
  });
  registerAuthorizationHook(app, dependencies.auth);
  registerErrorHandler(app);
  const observeRoutes = dependencies.observeRoutes;
  if (observeRoutes) {
    app.addHook("onRoute", (route) => {
      for (const method of [route.method].flat()) {
        observeRoutes({ method, url: route.url });
      }
    });
  }
  registerHealthRoute(app);
  if (dependencies.adminReviewContext) {
    registerAdminReviewContextRoute(app, dependencies.adminReviewContext);
  }
  if (dependencies.documentVerdict) {
    registerDocumentVerdictRoute(app, dependencies.documentVerdict);
  }
  if (dependencies.applicationReviewRepository) {
    registerHumanDecisionRoute(
      app,
      dependencies.applicationReviewRepository,
      dependencies.humanDecisionNotifications,
      dependencies.humanDecisionDeployment
    );
    registerApplicationManualReviewRoute(app, { repository: dependencies.applicationReviewRepository });
  }
  if (dependencies.campaignDeployment) {
    registerCampaignDeploymentRoute(app, dependencies.campaignDeployment);
  }
  if (dependencies.fundingIntent) {
    registerFundingIntentRoute(app, dependencies.fundingIntent);
  }
  if (dependencies.revenueShareDistribution) {
    registerRevenueShareDistributionRoute(app, dependencies.revenueShareDistribution);
  }
  if (dependencies.assessment) {
    registerAssessmentRoute(app, dependencies.assessment);
  }
  if (dependencies.applicationAssessment) {
    registerApplicationAssessmentRoute(app, dependencies.applicationAssessment);
  }
  if (dependencies.campaign) {
    registerCampaignRoute(app, dependencies.campaign);
  }
  if (dependencies.salesFeed) {
    registerSalesFeedRoute(app, dependencies.salesFeed);
  }
  if (dependencies.smeRequest) {
    registerSmeRequestRoute(app, dependencies.smeRequest);
  }
  if (dependencies.business) {
    registerBusinessRoute(app, dependencies.business);
  }
  if (dependencies.storage) {
    // Multipart parsing is only needed by the upload route; registering it here
    // keeps the browser-to-API byte transport self-contained and caps the file
    // before the route reads it into memory.
    void app.register(multipart, {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 1 }
    });
    registerStorageRoute(app, dependencies.storage);
  }
  if (dependencies.wallet) {
    registerWalletRoute(app, dependencies.wallet);
  }
  if (dependencies.notification) {
    registerNotificationRoute(app, dependencies.notification);
  }
  if (dependencies.completenessCheck) {
    registerCompletenessCheckRoute(app, dependencies.completenessCheck);
  }
  if (dependencies.rateTable) {
    registerRateTableRoute(app, dependencies.rateTable);
  }
  return app;
}
