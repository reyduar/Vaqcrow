import { generateCorrelationId } from "@vaqcrow/contracts";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { registerHealthRoute } from "./routes/health.route.js";

function assertRandomUUIDAvailable(): void {
  const crypto = Reflect.get(globalThis, "crypto") as { randomUUID?: unknown } | undefined;

  if (typeof crypto?.randomUUID !== "function") {
    throw new Error("Web Crypto randomUUID is required");
  }
}

export function buildApp(): FastifyInstance {
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
  return app;
}
