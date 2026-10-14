import { createStore, type StoreApi } from "zustand/vanilla";
import type { AssistantCitation } from "@vaqcrow/contracts";
import type { AssistantErrorCode, AssistantPort } from "@/application/assistant/assistant-port";

/**
 * Client view of one assistant exchange (#499, WU3).
 *
 * Boundary: this store holds only what the chat renders — the question, the
 * answer and its citations — plus the pending flag and the last sanitized error
 * code. It never holds the raw error or the token. The port is authoritative;
 * this store is a per-mount cache created through `AssistantStoreProvider`,
 * never a module singleton.
 *
 * Owner decision D4 is single-turn with no history: a new question replaces the
 * previous exchange, so the list never grows past one question and one answer.
 */
export interface AssistantMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  /** Empty for the user's question; the wiki pages an answer cites otherwise. */
  readonly citations: readonly AssistantCitation[];
}

export interface AssistantData {
  /** The current single-turn exchange: the question, then its answer. */
  messages: AssistantMessage[];
  /** True while a question is in flight; the input is disabled. */
  pending: boolean;
  /** The last sanitized failure code, or `null`. The code never reaches the DOM. */
  lastError: AssistantErrorCode | null;
}

export interface AssistantActions {
  /** Sends one question; an empty one or one sent while pending is a no-op. */
  ask: (question: string) => Promise<void>;
  /** Clears the exchange and the error. */
  reset: () => void;
}

export type AssistantState = AssistantData & AssistantActions;
export type AssistantStore = StoreApi<AssistantState>;

export function createAssistantStore(port: AssistantPort): AssistantStore {
  // Ids only need to be stable within this store, so a monotonic counter is enough.
  let sequence = 0;

  return createStore<AssistantState>()((set, get) => ({
    messages: [],
    pending: false,
    lastError: null,

    ask: async (question) => {
      const trimmed = question.trim();
      if (trimmed === "" || get().pending) return;

      const asked = ++sequence;
      set({
        messages: [{ id: `q-${asked}`, role: "user", text: trimmed, citations: [] }],
        pending: true,
        lastError: null
      });

      const result = await port.ask(trimmed);

      if (result.ok) {
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: `a-${asked}`,
              role: "assistant",
              text: result.answer.answer,
              citations: result.answer.citations
            }
          ],
          pending: false,
          lastError: null
        }));
        return;
      }

      set({ pending: false, lastError: result.code });
    },

    reset: () => set({ messages: [], pending: false, lastError: null })
  }));
}
