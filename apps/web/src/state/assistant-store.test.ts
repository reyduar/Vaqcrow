import { describe, expect, it, vi } from "vitest";
import type { AssistantAskResult, AssistantPort } from "@/application/assistant/assistant-port";
import { createAssistantStore } from "./assistant-store";

/**
 * The per-turn assistant store (#499, WU3). It holds one question and its answer
 * (D4: single turn), the pending flag and the last sanitized error code; a new
 * question replaces the previous exchange, and two stores never share state.
 */

const ANSWER: AssistantAskResult = {
  ok: true,
  answer: {
    answer: "El revenue share es un porcentaje de tus ventas.",
    citations: [{ id: "que-es-vaqcrow", title: "Qué es Vaqcrow", screen: "/about" }]
  }
};

/** A port whose `ask` the test resolves, so the pending state is observable. */
function deferredPort() {
  let resolve: ((value: AssistantAskResult) => void) | null = null;
  const ask = vi.fn(
    () => new Promise<AssistantAskResult>((r) => { resolve = r; })
  );
  return {
    port: { ask } satisfies AssistantPort,
    ask,
    resolve: (value: AssistantAskResult) => resolve?.(value)
  };
}

describe("createAssistantStore", () => {
  it("appends the question, then the answer with its citations", async () => {
    const { port, resolve } = deferredPort();
    const store = createAssistantStore(port);

    const pending = store.getState().ask("  ¿Qué es el revenue share?  ");

    expect(store.getState().pending).toBe(true);
    expect(store.getState().messages).toEqual([
      { id: expect.any(String), role: "user", text: "¿Qué es el revenue share?", citations: [] }
    ]);

    resolve(ANSWER);
    await pending;

    expect(store.getState().pending).toBe(false);
    expect(store.getState().lastError).toBeNull();
    expect(store.getState().messages).toHaveLength(2);
    expect(store.getState().messages[1]).toMatchObject({
      role: "assistant",
      text: "El revenue share es un porcentaje de tus ventas.",
      citations: [{ id: "que-es-vaqcrow", title: "Qué es Vaqcrow", screen: "/about" }]
    });
  });

  it("keeps a sanitized code and no answer when the port fails (e.g. 403)", async () => {
    const ask = vi.fn().mockResolvedValue({ ok: false, code: "forbidden" });
    const store = createAssistantStore({ ask });

    await store.getState().ask("¿Mi saldo?");

    expect(store.getState().messages).toHaveLength(1);
    expect(store.getState().messages[0]?.role).toBe("user");
    expect(store.getState().lastError).toBe("forbidden");
    expect(store.getState().pending).toBe(false);
  });

  it("renders every 200 answer identically, fixed copy included (declined / no-doc / cap / account)", async () => {
    // The API returns the four fixed answers as ordinary 200s; the store only
    // ever sees an answer with no citations.
    for (const answer of [
      "Puedo ayudarte solo con Vaqcrow: qué es, cómo funciona y su tecnología. Para otros temas no soy de utilidad.",
      "No tengo documentación sobre eso. Podés leer las guías y el Blog, o escribir a soporte: contact@vaqcrow.com.",
      "Te sugiero leer los artículos del Blog: ahí cubrimos Vaqcrow con más detalle.",
      "La información de tu cuenta está en tus informes. Si no lo encontrás ahí, escribí a soporte: contact@vaqcrow.com."
    ]) {
      const ask = vi.fn().mockResolvedValue({ ok: true, answer: { answer, citations: [] } });
      const store = createAssistantStore({ ask });

      await store.getState().ask("una pregunta");

      expect(store.getState().messages[1]).toMatchObject({ text: answer, citations: [] });
      expect(store.getState().lastError).toBeNull();
    }
  });

  it("ignores an empty question and a question asked while pending", async () => {
    const { port, ask, resolve } = deferredPort();
    const store = createAssistantStore(port);

    await store.getState().ask("   ");
    expect(ask).not.toHaveBeenCalled();
    expect(store.getState().messages).toHaveLength(0);

    const first = store.getState().ask("primera");
    await store.getState().ask("segunda");
    expect(ask).toHaveBeenCalledTimes(1);

    resolve(ANSWER);
    await first;
  });

  it("resets the exchange and the error", async () => {
    const ask = vi.fn().mockResolvedValue({ ok: false, code: "network" });
    const store = createAssistantStore({ ask });

    await store.getState().ask("una pregunta");
    store.getState().reset();

    expect(store.getState().messages).toEqual([]);
    expect(store.getState().lastError).toBeNull();
    expect(store.getState().pending).toBe(false);
  });

  it("keeps two stores isolated (per-mount, never a singleton)", async () => {
    const askA = vi.fn().mockResolvedValue(ANSWER);
    const askB = vi.fn().mockResolvedValue({ ok: false, code: "forbidden" });
    const storeA = createAssistantStore({ ask: askA });
    const storeB = createAssistantStore({ ask: askB });

    await storeA.getState().ask("A");
    await storeB.getState().ask("B");

    expect(storeA.getState().messages).toHaveLength(2);
    expect(storeB.getState().messages).toHaveLength(1);
    expect(storeA.getState().lastError).toBeNull();
    expect(storeB.getState().lastError).toBe("forbidden");
  });
});
