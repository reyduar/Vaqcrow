import { generateCorrelationId } from "@vaqcrow/contracts";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { ApplicationReviewRepositoryPort } from "../../application/ports/application-review-repository-port.js";
import { registerFundingIntentRoute } from "./routes/funding-intent.route.js";
import type { FundingIntentRouteDependencies } from "./routes/funding-intent.route.js";
import { registerHealthRoute } from "./routes/health.route.js";
import { registerHumanDecisionRoute } from "./routes/human-decision.route.js";

function assertRandomUUIDAvailable(): void {
  const crypto = Reflect.get(globalThis, "crypto") as { randomUUID?: unknown } | undefined;

  if (typeof crypto?.randomUUID !== "function") {
    throw new Error("Web Crypto randomUUID is required");
  }
}

export function buildApp(dependencies: {
  readonly applicationReviewRepository?: ApplicationReviewRepositoryPort;
  readonly fundingIntent?: FundingIntentRouteDependencies;
} = {}): FastifyInstance {
  assertRandomUUIDAvailable();

  const app = Fastify({
    logger: false,
    requestIdHeader: false,
    genReqId: generateCorrelationId
  });
  // load order: ecosystem plugins -> custom plugins -> decorators -> hooks -> routes
  app.addHook("onRequest", (request, reply, done) => {
    reply.header("x-correlation-id", request.id);
    done();
  });
  registerHealthRoute(app);
  if (dependencies.applicationReviewRepository) {
    registerHumanDecisionRoute(app, dependencies.applicationReviewRepository);
  }
  if (dependencies.fundingIntent) {
    registerFundingIntentRoute(app, dependencies.fundingIntent);
  }
  return app;
}
