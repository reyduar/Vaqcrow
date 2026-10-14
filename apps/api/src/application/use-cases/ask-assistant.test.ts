import { afterEach, describe, expect, it, vi } from "vitest";
import type { AssistantAccessPort } from "../ports/assistant-access-port.js";
import type { AssistantChatPort } from "../ports/assistant-chat-port.js";
import type { WikiRepositoryPort } from "../ports/wiki-repository-port.js";
import { ASSISTANT_QUESTION_CAP, ASSISTANT_WINDOW_MS, askAssistant } from "./ask-assistant.js";
import {
  ASSISTANT_ACCOUNT_COPY,
  ASSISTANT_CAP_COPY,
  ASSISTANT_NO_DOCUMENTATION_COPY,
  ASSISTANT_OUT_OF_SCOPE_COPY
} from "../assistant/fixed-copy.js";

/**
 * The assistant orchestrator (#499/WU2). Every guard from the issue is here:
 * S2/S4/S5/S6/S7/S8 plus the account path. All doubles — no provider is
 * reached, and no answer is ever invented.
 */
const NOW = new Date("2026-10-14T12:00:00.000Z");
const INDEX = [
  "- [revenue-share](revenue-share.md): qué es el revenue share.",
  "- [mi-campana](mi-campana.md): el área de la PyME."
].join("\n");

const PAGE_REVENUE = "---\ntitle: Revenue share\ntype: concepto\n---\n\nReparte un porcentaje.";
const PAGE_CAMPAIGN = "---\ntitle: Mi campaña\ntype: pantalla\nscreen: /company\n---\n\nEl área de la PyME.";

const ok = <T>(value: T) => ({ ok: true as const, value });
const fail = { ok: false as const, error: { code: "unavailable" as const } };

function wiki(overrides: Partial<WikiRepositoryPort> = {}): WikiRepositoryPort {
  return {
    readIndex: vi.fn().mockResolvedValue(ok(INDEX)),
    readPage: vi.fn(async (id: string) => {
      if (id === "revenue-share") return ok(PAGE_REVENUE);
      if (id === "mi-campana") return ok(PAGE_CAMPAIGN);
      return ok(undefined);
    }),
    ...overrides
  };
}

function chat(overrides: Partial<AssistantChatPort> = {}): AssistantChatPort {
  return { complete: vi.fn().mockResolvedValue(ok("{}")), ...overrides };
}

function access(overrides: Partial<AssistantAccessPort> = {}): AssistantAccessPort {
  return {
    isChatEnabled: vi.fn().mockResolvedValue(ok(true)),
    countRecentQuestions: vi.fn().mockResolvedValue(ok(0)),
    recordQuestion: vi.fn().mockResolvedValue(ok(undefined)),
    ...overrides
  };
}

const request = { question: "¿Qué es el revenue share?", userId: "user-1" };

afterEach(() => vi.restoreAllMocks());

describe("askAssistant — access (S2, D7, D9)", () => {
  it("is forbidden when the per-user flag is off, before any other dependency", async () => {
    const wikiPort = wiki();
    const router = chat();
    const accessPort = access({ isChatEnabled: vi.fn().mockResolvedValue(ok(false)) });

    const result = await askAssistant(
      { wiki: wikiPort, router, answerer: chat(), access: accessPort, now: () => NOW },
      request
    );

    expect(result).toEqual({ ok: false, error: { code: "forbidden" } });
    expect(accessPort.countRecentQuestions).not.toHaveBeenCalled();
    expect(wikiPort.readIndex).not.toHaveBeenCalled();
    expect(router.complete).not.toHaveBeenCalled();
  });

  it("answers unavailable when the flag cannot be read", async () => {
    const result = await askAssistant(
      { wiki: wiki(), router: chat(), answerer: chat(), access: access({ isChatEnabled: vi.fn().mockResolvedValue(fail) }), now: () => NOW },
      request
    );
    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

describe("askAssistant — rate limit (S8, D6)", () => {
  it("answers the cap copy at the limit, with no index read and no model call", async () => {
    const wikiPort = wiki();
    const router = chat();
    const accessPort = access({ countRecentQuestions: vi.fn().mockResolvedValue(ok(ASSISTANT_QUESTION_CAP)) });

    const result = await askAssistant(
      { wiki: wikiPort, router, answerer: chat(), access: accessPort, now: () => NOW },
      request
    );

    expect(result).toEqual({ ok: true, value: { answer: ASSISTANT_CAP_COPY, citations: [] } });
    expect(wikiPort.readIndex).not.toHaveBeenCalled();
    expect(router.complete).not.toHaveBeenCalled();
    expect(accessPort.recordQuestion).not.toHaveBeenCalled();
  });

  it("counts in the rolling 24h window and records the question", async () => {
    const accessPort = access();
    const router = chat({
      complete: vi.fn().mockResolvedValue(ok('{"scope":"in","pages":["revenue-share"]}'))
    });
    const answerer = chat({
      complete: vi.fn().mockResolvedValue(ok('{"answer":"Reparte un porcentaje.","citations":["revenue-share"]}'))
    });

    await askAssistant(
      { wiki: wiki(), router, answerer, access: accessPort, now: () => NOW },
      request
    );

    expect(accessPort.countRecentQuestions).toHaveBeenCalledExactlyOnceWith("user-1", new Date(NOW.getTime() - ASSISTANT_WINDOW_MS));
    expect(accessPort.recordQuestion).toHaveBeenCalledExactlyOnceWith("user-1", NOW);
  });

  it("answers unavailable when the question cannot be recorded", async () => {
    const result = await askAssistant(
      {
        wiki: wiki(),
        router: chat(),
        answerer: chat(),
        access: access({ recordQuestion: vi.fn().mockResolvedValue(fail) }),
        now: () => NOW
      },
      request
    );
    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

describe("askAssistant — no documentation (S4)", () => {
  it("answers unavailable when the indices cannot be read", async () => {
    const result = await askAssistant(
      { wiki: wiki({ readIndex: vi.fn().mockResolvedValue(fail) }), router: chat(), answerer: chat(), access: access(), now: () => NOW },
      request
    );
    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("answers the no-documentation copy when the index file is missing", async () => {
    const result = await askAssistant(
      { wiki: wiki({ readIndex: vi.fn().mockResolvedValue(ok(undefined)) }), router: chat(), answerer: chat(), access: access(), now: () => NOW },
      request
    );
    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });

  it("answers no documentation when the index has no pages, never calling the router", async () => {
    const router = chat();
    const result = await askAssistant(
      { wiki: wiki({ readIndex: vi.fn().mockResolvedValue(ok("# vacío\n")) }), router, answerer: chat(), access: access(), now: () => NOW },
      request
    );
    expect(result).toEqual({ ok: true, value: { answer: ASSISTANT_NO_DOCUMENTATION_COPY, citations: [] } });
    expect(router.complete).not.toHaveBeenCalled();
  });

  it("answers no documentation when the router selects no known page, never calling the answerer", async () => {
    const router = chat({ complete: vi.fn().mockResolvedValue(ok('{"scope":"in","pages":["no-existe"]}')) });
    const answerer = chat();
    const result = await askAssistant(
      { wiki: wiki(), router, answerer, access: access(), now: () => NOW },
      request
    );
    expect(result).toEqual({ ok: true, value: { answer: ASSISTANT_NO_DOCUMENTATION_COPY, citations: [] } });
    expect(answerer.complete).not.toHaveBeenCalled();
  });

  it("answers no documentation when a routed page file is missing", async () => {
    const router = chat({ complete: vi.fn().mockResolvedValue(ok('{"scope":"in","pages":["revenue-share"]}')) });
    const result = await askAssistant(
      { wiki: wiki({ readPage: vi.fn().mockResolvedValue(ok(undefined)) }), router, answerer: chat(), access: access(), now: () => NOW },
      request
    );
    expect(result).toEqual({ ok: true, value: { answer: ASSISTANT_NO_DOCUMENTATION_COPY, citations: [] } });
  });
});

describe("askAssistant — out of scope (S5)", () => {
  it("answers the decline copy and never asks for an answer", async () => {
    const router = chat({ complete: vi.fn().mockResolvedValue(ok('{"scope":"out","pages":[]}')) });
    const answerer = chat();
    const result = await askAssistant(
      { wiki: wiki(), router, answerer, access: access(), now: () => NOW },
      { question: "¿Quién ganó el mundial?", userId: "user-1" }
    );
    expect(result).toEqual({ ok: true, value: { answer: ASSISTANT_OUT_OF_SCOPE_COPY, citations: [] } });
    expect(answerer.complete).not.toHaveBeenCalled();
  });
});

describe("askAssistant — account (D3)", () => {
  it("answers the account copy, pointing to the reports, and never asks for an answer", async () => {
    const router = chat({ complete: vi.fn().mockResolvedValue(ok('{"scope":"account","pages":[]}')) });
    const answerer = chat();
    const result = await askAssistant(
      { wiki: wiki(), router, answerer, access: access(), now: () => NOW },
      { question: "¿Cuánto aporté?", userId: "user-1" }
    );
    expect(result).toEqual({ ok: true, value: { answer: ASSISTANT_ACCOUNT_COPY, citations: [] } });
    expect(answerer.complete).not.toHaveBeenCalled();
  });
});

describe("askAssistant — citations and retry (S3, S6)", () => {
  it("answers the model's answer with the cited pages enriched with title and screen", async () => {
    const router = chat({ complete: vi.fn().mockResolvedValue(ok('{"scope":"in","pages":["revenue-share","mi-campana"]}')) });
    const answerer = chat({
      complete: vi.fn().mockResolvedValue(ok('{"answer":"Reparte un porcentaje.","citations":["revenue-share"]}'))
    });

    const result = await askAssistant(
      { wiki: wiki(), router, answerer, access: access(), now: () => NOW },
      request
    );

    expect(result).toEqual({
      ok: true,
      value: {
        answer: "Reparte un porcentaje.",
        citations: [{ id: "revenue-share", title: "Revenue share", screen: null }]
      }
    });
  });

  it("retries once when a citation is outside the routed pages, then answers no documentation", async () => {
    const router = chat({ complete: vi.fn().mockResolvedValue(ok('{"scope":"in","pages":["revenue-share"]}')) });
    const answerer = chat({
      // Both attempts cite a page that was never routed.
      complete: vi.fn().mockResolvedValue(ok('{"answer":"ok","citations":["mi-campana"]}'))
    });

    const result = await askAssistant(
      { wiki: wiki(), router, answerer, access: access(), now: () => NOW },
      request
    );

    expect(result).toEqual({ ok: true, value: { answer: ASSISTANT_NO_DOCUMENTATION_COPY, citations: [] } });
    expect(answerer.complete).toHaveBeenCalledTimes(2);
  });

  it("accepts the second attempt when the first is invalid", async () => {
    const router = chat({ complete: vi.fn().mockResolvedValue(ok('{"scope":"in","pages":["revenue-share"]}')) });
    const answerer = chat({
      complete: vi
        .fn()
        .mockResolvedValueOnce(ok("no es json"))
        .mockResolvedValueOnce(ok('{"answer":"Reparte un porcentaje.","citations":["revenue-share"]}'))
    });

    const result = await askAssistant(
      { wiki: wiki(), router, answerer, access: access(), now: () => NOW },
      request
    );

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.citations).toEqual([
      { id: "revenue-share", title: "Revenue share", screen: null }
    ]);
    expect(answerer.complete).toHaveBeenCalledTimes(2);
  });

  it("retries once when the router output is unparseable, then answers no documentation", async () => {
    const router = chat({ complete: vi.fn().mockResolvedValue(ok("no es json")) });
    const answerer = chat();
    const result = await askAssistant(
      { wiki: wiki(), router, answerer, access: access(), now: () => NOW },
      request
    );
    expect(result).toEqual({ ok: true, value: { answer: ASSISTANT_NO_DOCUMENTATION_COPY, citations: [] } });
    expect(router.complete).toHaveBeenCalledTimes(2);
    expect(answerer.complete).not.toHaveBeenCalled();
  });

  it("treats a null/length-limited model output as invalid and retries once", async () => {
    const router = chat({ complete: vi.fn().mockResolvedValue({ ok: false, error: { code: "invalid_output" } }) });
    const result = await askAssistant(
      { wiki: wiki(), router, answerer: chat(), access: access(), now: () => NOW },
      request
    );
    expect(result).toEqual({ ok: true, value: { answer: ASSISTANT_NO_DOCUMENTATION_COPY, citations: [] } });
    expect(router.complete).toHaveBeenCalledTimes(2);
  });
});

describe("askAssistant — provider failure (S8)", () => {
  it("answers unavailable when the router transport fails, without retrying", async () => {
    const router = chat({ complete: vi.fn().mockResolvedValue({ ok: false, error: { code: "unavailable" } }) });
    const result = await askAssistant(
      { wiki: wiki(), router, answerer: chat(), access: access(), now: () => NOW },
      request
    );
    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
    expect(router.complete).toHaveBeenCalledTimes(1);
  });

  it("answers unavailable when the answer transport fails", async () => {
    const router = chat({ complete: vi.fn().mockResolvedValue(ok('{"scope":"in","pages":["revenue-share"]}')) });
    const answerer = chat({ complete: vi.fn().mockResolvedValue({ ok: false, error: { code: "timeout" } }) });
    const result = await askAssistant(
      { wiki: wiki(), router, answerer, access: access(), now: () => NOW },
      request
    );
    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});

describe("askAssistant — a thrown dependency is unavailable", () => {
  it("never lets a thrown error escape", async () => {
    const router = chat({
      complete: vi.fn().mockRejectedValue(new Error("secret"))
    });
    const result = await askAssistant(
      { wiki: wiki(), router, answerer: chat(), access: access(), now: () => NOW },
      request
    );
    expect(result).toEqual({ ok: false, error: { code: "unavailable" } });
  });
});
