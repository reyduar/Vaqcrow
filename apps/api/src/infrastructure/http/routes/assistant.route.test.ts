import { parseAssistantAnswer } from "@vaqcrow/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AskAssistantOutcome } from "../../../application/use-cases/ask-assistant.js";
import { buildApp } from "../build-app.js";
import { bearer, fakeAuthPort } from "../test-support/auth.js";
import type { AssistantRouteDependencies } from "./assistant.route.js";

/**
 * The assistant endpoint (#499/WU2, S2/S8). `POST /assistant/questions` needs a
 * session (PYME or INVERSOR — an ADMIN is refused by the policy), validates the
 * body strictly, and maps the use-case outcome: a `forbidden` (the per-user
 * flag is off) is 403 and a provider failure is a sanitized 503.
 */
const ANSWER = {
  answer: "El revenue share reparte un porcentaje.",
  citations: [{ id: "revenue-share", title: "Revenue share", screen: null }]
};

function app(ask: AssistantRouteDependencies["ask"]): FastifyInstance {
  return buildApp({ auth: { port: fakeAuthPort() }, assistant: { ask } });
}

let server: FastifyInstance | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  await server?.close();
  server = undefined;
});

describe("POST /assistant/questions", () => {
  it("answers a PYME with the contract envelope", async () => {
    const ask = vi.fn().mockResolvedValue({ ok: true, value: ANSWER } satisfies AskAssistantOutcome);
    server = app(ask);

    const response = await server.inject({
      method: "POST",
      url: "/assistant/questions",
      headers: bearer("PYME"),
      payload: { question: "¿Qué es el revenue share?" }
    });

    expect(response.statusCode).toBe(200);
    expect(parseAssistantAnswer(response.json())).toEqual(ANSWER);
    expect(ask).toHaveBeenCalledExactlyOnceWith({ question: "¿Qué es el revenue share?", userId: expect.any(String) });
  });

  it("answers an INVERSOR too", async () => {
    server = app(vi.fn().mockResolvedValue({ ok: true, value: ANSWER }));

    const response = await server.inject({
      method: "POST",
      url: "/assistant/questions",
      headers: bearer("INVERSOR"),
      payload: { question: "hola" }
    });

    expect(response.statusCode).toBe(200);
  });

  it("refuses an ADMIN with 403 before the use case (D7)", async () => {
    const ask = vi.fn();
    server = app(ask);

    const response = await server.inject({
      method: "POST",
      url: "/assistant/questions",
      headers: bearer("ADMIN"),
      payload: { question: "hola" }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ code: "forbidden" });
    expect(ask).not.toHaveBeenCalled();
  });

  it("answers 401 without a token (S2)", async () => {
    const ask = vi.fn();
    server = app(ask);

    const response = await server.inject({ method: "POST", url: "/assistant/questions", payload: { question: "hola" } });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ code: "unauthenticated" });
    expect(ask).not.toHaveBeenCalled();
  });

  it.each([[{}], [{ question: "" }], [{ question: 42 }], [{ question: "ok", userId: "x" }], [null]])(
    "answers 400 for a malformed body (%o) without calling the use case",
    async (body) => {
      const ask = vi.fn();
      server = app(ask);

      const response = await server.inject({
        method: "POST",
        url: "/assistant/questions",
        headers: bearer("PYME"),
        payload: body as object
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ code: "invalid_request" });
      expect(ask).not.toHaveBeenCalled();
    }
  );

  it("maps the flag-off forbidden outcome to 403", async () => {
    server = app(vi.fn().mockResolvedValue({ ok: false, error: { code: "forbidden" } } satisfies AskAssistantOutcome));

    const response = await server.inject({
      method: "POST",
      url: "/assistant/questions",
      headers: bearer("PYME"),
      payload: { question: "hola" }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ code: "forbidden" });
  });

  it("maps a provider failure to a sanitized 503 (S8)", async () => {
    server = app(vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } } satisfies AskAssistantOutcome));

    const response = await server.inject({
      method: "POST",
      url: "/assistant/questions",
      headers: bearer("PYME"),
      payload: { question: "hola" }
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
  });

  it("maps a thrown dependency to a sanitized 503 that never echoes the error", async () => {
    server = app(vi.fn().mockRejectedValue(new Error("secret detail")));

    const response = await server.inject({
      method: "POST",
      url: "/assistant/questions",
      headers: bearer("PYME"),
      payload: { question: "hola" }
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ code: "unavailable" });
    expect(response.body).not.toMatch(/secret/);
  });
});
