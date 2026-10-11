import { parseWalletFailureEvent } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";

/**
 * `POST /telemetry/wallet-failures` — the client→API half of the wallet-failure
 * beacon (#31/WU4a).
 *
 * The web is the only side that can see Freighter, so it classifies the failure
 * and reports it here; the API logs it and answers `202 Accepted`. Nothing is
 * created — no table, no row — because the point is observability, not state:
 * the request is fire-and-forget from the client's point of view, and the log
 * line is the artifact.
 *
 * The body is the closed, text-free `WalletFailureEvent` vocabulary. Its keys
 * are checked exactly before parsing (the funding-intent convention), so a body
 * that drifted — a public key, an XDR, an error string — is refused with a
 * sanitized `400` rather than stripped. The correlation is the request's own id,
 * which the logger binds to the line; the web holds none.
 *
 * `AUTHENTICATED` in `route-policy.ts`: the beacon only fires from signed-in
 * flows, so an anonymous caller can never write into the telemetry stream.
 */

const BODY_KEYS = new Set(["operation", "outcome"]);

function hasExactBodyKeys(
  input: unknown,
  allowed: ReadonlySet<string>
): input is Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }

  const keys = Object.keys(input);
  return keys.length === allowed.size && keys.every((key) => allowed.has(key));
}

export function registerTelemetryRoute(app: FastifyInstance): void {
  app.post<{ Body: unknown }>("/telemetry/wallet-failures", async (request, reply) => {
    if (!hasExactBodyKeys(request.body, BODY_KEYS)) {
      return reply.code(400).send({ code: "invalid_request" });
    }

    let event;
    try {
      event = parseWalletFailureEvent({
        operation: request.body["operation"],
        outcome: request.body["outcome"]
      });
    } catch {
      return reply.code(400).send({ code: "invalid_request" });
    }

    // The operation and outcome are the whole payload — the logger's redaction
    // hook runs over every argument, and the vocabulary is closed and text-free,
    // so nothing but the classification can reach the line.
    request.log.warn({ operation: event.operation, outcome: event.outcome }, "wallet failure reported");
    return reply.code(202).send({ accepted: true });
  });
}
