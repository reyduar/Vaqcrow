import { parseAssistantQuestionCommand } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import type { AskAssistantOutcome, AskAssistantRequest } from "../../../application/use-cases/ask-assistant.js";

/**
 * The assistant endpoint (#499/WU2, S2/S8).
 *
 * `POST /assistant/questions` is `PYME` or `INVERSOR` by the route-policy table
 * (owner decision D7; an ADMIN is refused there, before this handler runs). It
 * returns one JSON body — no streaming, a conscious deferral of the issue's
 * streaming wish. The body is validated strictly (an extra field, an empty
 * question or a non-string is a `400`). The per-user `chat_enabled` flag and the
 * rolling cap are enforced by the use case: the flag off is `403`; a provider
 * failure is a sanitized `503`.
 */
export interface AssistantRouteDependencies {
  readonly ask: (request: AskAssistantRequest) => Promise<AskAssistantOutcome>;
}

export function registerAssistantRoute(app: FastifyInstance, dependencies: AssistantRouteDependencies): void {
  app.post<{ Body: unknown }>("/assistant/questions", async (request, reply) => {
    const principal = request.principal;
    if (principal === undefined) {
      return reply.code(401).send({ code: "unauthenticated" });
    }

    let question: string;
    try {
      question = parseAssistantQuestionCommand(request.body).question;
    } catch {
      return reply.code(400).send({ code: "invalid_request" });
    }

    try {
      const result = await dependencies.ask({ question, userId: principal.userId });
      if (result.ok) {
        return reply.code(200).send(result.value);
      }
      return reply
        .code(result.error.code === "forbidden" ? 403 : 503)
        .send({ code: result.error.code });
    } catch {
      // The use case never throws; if it does, the failure is still sanitized.
      return reply.code(503).send({ code: "unavailable" });
    }
  });
}
