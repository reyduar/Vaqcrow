import { describe, expect, it } from "vitest";
import {
  assistantAnswerOutputSchema,
  assistantAnswerSchema,
  assistantQuestionCommandSchema,
  assistantRouterOutputSchema,
  assistantScopeSchema,
  parseAssistantAnswer,
  parseAssistantAnswerOutput,
  parseAssistantQuestionCommand,
  parseAssistantRouterOutput,
  parseSetChatAccessCommand,
  parseSetChatAccessResult,
  setChatAccessCommandSchema,
  setChatAccessResultSchema
} from "./assistant.js";

/**
 * The help assistant contracts (#499/WU2). The wire shapes are strict: an extra
 * field is a rejection, so a body can never smuggle an `actor`/`userId` past
 * the route, and the model-output schemas reject anything the orchestration
 * would otherwise have to guess about.
 */
describe("assistantQuestionCommandSchema", () => {
  it("accepts a trimmed question and defaults nothing", () => {
    expect(parseAssistantQuestionCommand({ question: "  ¿Qué es el revenue share?  " })).toEqual({
      question: "¿Qué es el revenue share?"
    });
  });

  it.each([[{}], [{ question: "" }], [{ question: "   " }], [{ question: 42 }], [null]])(
    "rejects a malformed command: %o",
    (body) => {
      expect(assistantQuestionCommandSchema.safeParse(body).success).toBe(false);
    }
  );

  it("rejects an unknown extra field (strict object)", () => {
    expect(assistantQuestionCommandSchema.safeParse({ question: "hola", userId: "x" }).success).toBe(false);
  });

  it("rejects a question over the length cap", () => {
    expect(assistantQuestionCommandSchema.safeParse({ question: "a".repeat(2001) }).success).toBe(false);
    expect(assistantQuestionCommandSchema.safeParse({ question: "a".repeat(2000) }).success).toBe(true);
  });
});

describe("assistantScopeSchema", () => {
  it("accepts exactly in, out and account", () => {
    expect(assistantScopeSchema.options).toEqual(["in", "out", "account"]);
  });
});

describe("assistantAnswerSchema", () => {
  it("carries an answer and its citations, with a nullable screen", () => {
    const answer = parseAssistantAnswer({
      answer: "El revenue share reparte un porcentaje de las ventas.",
      citations: [{ id: "revenue-share", title: "Revenue share", screen: null }]
    });
    expect(answer.citations).toEqual([{ id: "revenue-share", title: "Revenue share", screen: null }]);
  });

  it("accepts a fixed answer with no citations", () => {
    expect(parseAssistantAnswer({ answer: "No tengo documentación sobre eso.", citations: [] }).citations).toEqual([]);
  });

  it.each([
    [{ answer: "", citations: [] }],
    [{ answer: "ok" }],
    [{ answer: "ok", citations: [{ id: "Revenue Share", title: "x", screen: null }] }],
    [{ answer: "ok", citations: [{ id: "a", title: "x" }] }],
    [{ answer: "ok", citations: [{ id: "a", title: "x", screen: null, extra: 1 }] }]
  ])("rejects a malformed answer: %o", (value) => {
    expect(assistantAnswerSchema.safeParse(value).success).toBe(false);
  });
});

describe("assistantRouterOutputSchema", () => {
  it("accepts the three scopes with a page list", () => {
    expect(parseAssistantRouterOutput({ scope: "in", pages: ["revenue-share"] })).toEqual({
      scope: "in",
      pages: ["revenue-share"]
    });
    expect(parseAssistantRouterOutput({ scope: "out", pages: [] }).scope).toBe("out");
    expect(parseAssistantRouterOutput({ scope: "account", pages: [] }).scope).toBe("account");
  });

  it.each([
    [{ scope: "maybe", pages: [] }],
    [{ scope: "in" }],
    [{ scope: "in", pages: [1] }],
    [{ scope: "in", pages: [], extra: true }]
  ])("rejects a malformed router output: %o", (value) => {
    expect(assistantRouterOutputSchema.safeParse(value).success).toBe(false);
  });
});

describe("assistantAnswerOutputSchema", () => {
  it("accepts an answer with bare page ids as citations", () => {
    expect(parseAssistantAnswerOutput({ answer: "ok", citations: ["revenue-share"] })).toEqual({
      answer: "ok",
      citations: ["revenue-share"]
    });
  });

  it.each([[{ answer: "", citations: [] }], [{ answer: "ok", citations: [3] }], [{ answer: "ok" }]])(
    "rejects a malformed answer output: %o",
    (value) => {
      expect(assistantAnswerOutputSchema.safeParse(value).success).toBe(false);
    }
  );
});

describe("the admin chat-access toggle contracts", () => {
  it("accepts an enabled boolean and rejects an extra identity field", () => {
    expect(parseSetChatAccessCommand({ enabled: true })).toEqual({ enabled: true });
    expect(setChatAccessCommandSchema.safeParse({ enabled: "yes" }).success).toBe(false);
    expect(setChatAccessCommandSchema.safeParse({ enabled: true, actor: "me" }).success).toBe(false);
  });

  it("carries the user id and the flag back", () => {
    expect(parseSetChatAccessResult({ userId: "u-1", enabled: false })).toEqual({ userId: "u-1", enabled: false });
    expect(setChatAccessResultSchema.safeParse({ userId: "u-1" }).success).toBe(false);
  });
});
