import type { FastifyInstance } from "fastify";
import { validateCompletenessCheckInput } from "../../../application/completeness/completeness-request.js";
import type { CompletenessCheckPort } from "../../../application/ports/completeness-check-port.js";

/**
 * The HTTP surface of the application completeness check (Feature #402,
 * Task #403 / T1a).
 *
 * `POST /completeness-check` takes the declared metadata the wizard already
 * collects (the three mandatory documents, the photo count, the eight-month
 * sales series) and answers `200 { result }` with the structured findings.
 * Incomplete *warns*, it never blocks: the status is always `200` for a
 * well-formed body, and the human reviewer decides. The route is `PyME`-only
 * (`route-policy.ts`) and never trusts an owner from the body.
 *
 * The status mapping follows the established conventions: `400 { errors:
 * [{ field, code }] }` for a body that fails strict validation and a sanitized
 * `503 { code: "unavailable" }` for every checker failure.
 */

export interface CompletenessCheckRouteDependencies {
  readonly checker: CompletenessCheckPort;
}

export function registerCompletenessCheckRoute(
  app: FastifyInstance,
  dependencies: CompletenessCheckRouteDependencies
): void {
  app.post<{ Body: unknown }>("/completeness-check", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    const validated = validateCompletenessCheckInput(request.body);
    if (!validated.ok) {
      return reply.code(400).send({ errors: validated.fieldErrors });
    }

    try {
      const result = await dependencies.checker.check({
        // Server-owned: the owner is the verified principal, never a body field.
        ownerUserId: principal.userId,
        input: validated.value
      });
      return reply.code(200).send({ result });
    } catch (error) {
      // Fastify's logger is disabled, so this follows the adapters' and the
      // authorization hook's `console.error` convention. Only the error name and
      // correlation id are logged; the message is never echoed.
      // eslint-disable-next-line no-console -- internal diagnostics only; never returned to the caller
      console.error("[CompletenessCheckRoute] checker threw", {
        cause: error instanceof Error ? error.name : "unknown",
        correlationId: request.id
      });
      return reply.code(503).send({ code: "unavailable" });
    }
  });
}
