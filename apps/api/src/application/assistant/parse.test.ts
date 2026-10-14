import { describe, expect, it } from "vitest";
import { extractJson, parseAnswerOutput, parseRouterOutput } from "./parse.js";

/**
 * The model-output reader (#499/WU2). The models are reasoners and sometimes
 * wrap their JSON in a Markdown fence or in a sentence; the reader tolerates
 * both, and anything it cannot turn into the expected shape throws so the
 * orchestration can retry once and then answer "no documentation".
 */
describe("extractJson", () => {
  it("parses a bare JSON object", () => {
    expect(extractJson('{"scope":"out","pages":[]}')).toEqual({ scope: "out", pages: [] });
  });

  it("parses a fenced JSON block", () => {
    expect(extractJson('```json\n{"scope":"in","pages":["a"]}\n```')).toEqual({ scope: "in", pages: ["a"] });
    expect(extractJson("```\n{\"a\":1}\n```")).toEqual({ a: 1 });
  });

  it("extracts the object from surrounding prose", () => {
    expect(extractJson('Claro, acá está:\n{"scope":"account","pages":[]}\nEso es todo.')).toEqual({
      scope: "account",
      pages: []
    });
  });

  it("throws when there is no JSON object", () => {
    expect(() => extractJson("no hay json")).toThrow();
  });
});

describe("parseRouterOutput and parseAnswerOutput", () => {
  it("validates the router output", () => {
    expect(parseRouterOutput('{"scope":"in","pages":["revenue-share"]}')).toEqual({
      scope: "in",
      pages: ["revenue-share"]
    });
  });

  it("validates the answer output", () => {
    expect(parseAnswerOutput('{"answer":"ok","citations":["revenue-share"]}')).toEqual({
      answer: "ok",
      citations: ["revenue-share"]
    });
  });

  it("throws on a shape-invalid JSON object", () => {
    expect(() => parseRouterOutput('{"scope":"maybe","pages":[]}')).toThrow();
    expect(() => parseAnswerOutput('{"answer":"ok"}')).toThrow();
  });
});
