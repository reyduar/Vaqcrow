import type { FastifyInstance } from "fastify";
import { resolveRoutePolicy } from "../../application/authorization/route-policy.js";
import type { RoutePolicyLookup } from "../../application/authorization/route-policy.js";
import type { AuthPort, Principal } from "../../application/ports/auth-port.js";

declare module "fastify" {
  interface FastifyRequest {
    /** The verified principal; set by the authorization hook on non-public routes. */
    principal: Principal | undefined;
  }
}

export interface AuthorizationDependencies {
  readonly port: AuthPort;
  /** Overrides the production policy table. Tests only. */
  readonly policy?: RoutePolicyLookup;
}

/** With no auth dependency every non-public route must still deny. */
const DENY_ALL_PORT: AuthPort = {
  verifyAccessToken: async () => ({ ok: false, error: { code: "unauthenticated" } })
};

function bearerToken(header: string | undefined): string | undefined {
  const match = /^Bearer +(\S+)$/i.exec(header ?? "");
  return match?.[1];
}

/**
 * Default-deny authorization on `onRequest`. Must be registered after the
 * correlation-id hook so every denial carries the request id.
 */
export function registerAuthorizationHook(
  app: FastifyInstance,
  dependencies: AuthorizationDependencies | undefined
): void {
  const port = dependencies?.port ?? DENY_ALL_PORT;
  const lookup = dependencies?.policy ?? resolveRoutePolicy;

  app.decorateRequest("principal", undefined);

  app.addHook("onRequest", async (request, reply) => {
    // CORS preflights are answered by the CORS plugin and carry no credentials.
    if (request.method === "OPTIONS") {
      return;
    }

    const pattern = request.routeOptions.url;
    // No matched route: Fastify's own 404 handling answers.
    if (pattern === undefined) {
      return;
    }

    const policy = lookup(request.method, pattern);
    if (policy === undefined) {
      return reply.code(403).send({ code: "forbidden" });
    }
    if (policy.kind === "public") {
      return;
    }

    const token = bearerToken(request.headers.authorization);
    if (token === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    let verified: Awaited<ReturnType<AuthPort["verifyAccessToken"]>>;
    try {
      verified = await port.verifyAccessToken(token);
    } catch (cause) {
      // The port contract is to return `unavailable`, never throw; if an
      // adapter breaks it, Fastify's default handler would echo the message.
      // Only the error name is logged: a message could echo the token or
      // provider details. Fastify's logger is disabled (`logger: false`), so
      // this follows the adapters' `console.error` convention.
      // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
      console.error("[AuthorizationHook] auth port threw", {
        cause: cause instanceof Error ? cause.name : "unknown",
        correlationId: request.id
      });
      return reply.code(503).send({ code: "unavailable" });
    }
    if (!verified.ok) {
      return verified.error.code === "unavailable"
        ? reply.code(503).send({ code: "unavailable" })
        : reply.code(401).send({ code: "unauthenticated" });
    }

    const principal = verified.value;
    if (principal.status !== "active") {
      return reply.code(401).send({ code: "unauthenticated" });
    }
    if (policy.kind === "roles" && !policy.roles.includes(principal.role)) {
      return reply.code(403).send({ code: "forbidden" });
    }

    request.principal = principal;
  });
}
