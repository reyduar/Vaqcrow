import cors from "@fastify/cors";
import { generateCorrelationId } from "@vaqcrow/contracts";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { ApplicationReviewRepositoryPort } from "../../application/ports/application-review-repository-port.js";
import { registerApplicationAssessmentRoute } from "./routes/application-assessment.route.js";
import type { ApplicationAssessmentRouteDependencies } from "./routes/application-assessment.route.js";
import { registerApplicationManualReviewRoute } from "./routes/application-manual-review.route.js";
import { registerAssessmentRoute } from "./routes/assessment.route.js";
import type { AssessmentRouteDependencies } from "./routes/assessment.route.js";
import { registerCampaignRoute } from "./routes/campaign.route.js";
import type { CampaignRouteDependencies } from "./routes/campaign.route.js";
import { registerFundingIntentRoute } from "./routes/funding-intent.route.js";
import type { FundingIntentRouteDependencies } from "./routes/funding-intent.route.js";
import { registerHealthRoute } from "./routes/health.route.js";
import { registerHumanDecisionRoute } from "./routes/human-decision.route.js";
import { registerRevenueShareDistributionRoute } from "./routes/revenue-share-distribution.route.js";
import type { RevenueShareDistributionRouteDependencies } from "./routes/revenue-share-distribution.route.js";
import { registerSalesFeedRoute } from "./routes/sales-feed.route.js";
import type { SalesFeedRouteDependencies } from "./routes/sales-feed.route.js";

function assertRandomUUIDAvailable(): void {
  const crypto = Reflect.get(globalThis, "crypto") as { randomUUID?: unknown } | undefined;

  if (typeof crypto?.randomUUID !== "function") {
    throw new Error("Web Crypto randomUUID is required");
  }
}

export function buildApp(dependencies: {
  readonly applicationReviewRepository?: ApplicationReviewRepositoryPort;
  readonly fundingIntent?: FundingIntentRouteDependencies;
  readonly revenueShareDistribution?: RevenueShareDistributionRouteDependencies | undefined;
  readonly assessment?: AssessmentRouteDependencies;
  readonly applicationAssessment?: ApplicationAssessmentRouteDependencies;
  readonly campaign?: CampaignRouteDependencies | undefined;
  readonly salesFeed?: SalesFeedRouteDependencies;
  readonly cors?: { readonly allowedOrigins: readonly string[] };
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
      methods: ["GET", "POST", "OPTIONS"],
      exposedHeaders: ["x-correlation-id"],
      credentials: false
    });
  }
  app.addHook("onRequest", (request, reply, done) => {
    reply.header("x-correlation-id", request.id);
    done();
  });
  registerHealthRoute(app);
  if (dependencies.applicationReviewRepository) {
    registerHumanDecisionRoute(app, dependencies.applicationReviewRepository);
    registerApplicationManualReviewRoute(app, { repository: dependencies.applicationReviewRepository });
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
  return app;
}
