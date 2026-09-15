import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { registerHealthRoute } from "./routes/health.route.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  // load order: ecosystem plugins -> custom plugins -> decorators -> hooks -> routes
  registerHealthRoute(app);
  return app;
}
