import type { FastifyInstance } from "fastify";
import type { RateSnapshot, RateSource, RateTableRepositoryPort } from "../../../application/ports/rate-table-repository-port.js";

export interface RateTableRouteDependencies { readonly repository: RateTableRepositoryPort; }

function wire(rate: RateSnapshot): Record<string, unknown> {
  return { version: rate.version, effectiveAt: rate.effectiveAt, authorUserId: rate.authorUserId, source: rate.source, usdToArs: rate.usdToArs.toString(), stroopsPerUsd: rate.stroopsPerUsd.toString() };
}

export function registerRateTableRoute(app: FastifyInstance, dependencies: RateTableRouteDependencies): void {
  app.post<{ Body: unknown }>("/admin/rates", async (request, reply) => {
    const principal = request.principal;
    if (!principal) return reply.code(401).send({ code: "unauthenticated" });
    const body = request.body;
    if (typeof body !== "object" || body === null || Array.isArray(body)) return reply.code(400).send({ code: "invalid_request" });
    const value = body as Record<string, unknown>;
    if (typeof value.version !== "number" || !Number.isSafeInteger(value.version) || typeof value.effectiveAt !== "string" || (value.source !== "manual" && value.source !== "provider") || typeof value.usdToArs !== "string" || typeof value.stroopsPerUsd !== "string" || !/^\d+$/.test(value.usdToArs) || !/^\d+$/.test(value.stroopsPerUsd)) return reply.code(400).send({ code: "invalid_request" });
    const result = await dependencies.repository.create({ version: value.version, effectiveAt: value.effectiveAt, authorUserId: principal.userId, source: value.source as RateSource, usdToArs: BigInt(value.usdToArs), stroopsPerUsd: BigInt(value.stroopsPerUsd) });
    if (result.ok) return reply.code(201).send({ rate: wire(result.value) });
    return reply.code(result.error.code === "already_exists" ? 409 : 503).send({ code: result.error.code === "already_exists" ? "already_exists" : "unavailable" });
  });

  // The current rate for signed-in PyMEs and investors (#572): the web shows a
  // simulated ARS equivalent next to the XLM balance. Only the rate itself is
  // exposed, never the admin metadata (author, source). No rate in effect is a
  // 404, never a made-up value; any other failure is a sanitized 503.
  app.get("/rates/current", async (_request, reply) => {
    const result = await dependencies.repository.findCurrent(new Date().toISOString());
    if (result.ok) {
      const rate = result.value;
      return reply.code(200).send({
        rate: { version: rate.version, effectiveAt: rate.effectiveAt, usdToArs: rate.usdToArs.toString(), stroopsPerUsd: rate.stroopsPerUsd.toString() }
      });
    }
    return result.error.code === "not_found"
      ? reply.code(404).send({ code: "not_found" })
      : reply.code(503).send({ code: "unavailable" });
  });

  app.get("/admin/rates/current", async (_request, reply) => {
    const result = await dependencies.repository.findCurrent(new Date().toISOString());
    if (result.ok) return reply.code(200).send({ rate: wire(result.value) });
    return reply.code(result.error.code === "not_found" ? 404 : 503).send({ code: result.error.code });
  });
}
