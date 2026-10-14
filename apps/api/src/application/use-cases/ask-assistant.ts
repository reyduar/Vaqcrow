import { parseAssistantAnswer } from "@vaqcrow/contracts";
import type { AssistantAnswer, AssistantCitation } from "@vaqcrow/contracts";
import {
  ASSISTANT_ACCOUNT_COPY,
  ASSISTANT_CAP_COPY,
  ASSISTANT_NO_DOCUMENTATION_COPY,
  ASSISTANT_OUT_OF_SCOPE_COPY
} from "../assistant/fixed-copy.js";
import { parseAnswerOutput, parseRouterOutput } from "../assistant/parse.js";
import { buildAnswerMessages, buildRouterMessages } from "../assistant/prompts.js";
import { parseWikiIndex, parseWikiPage } from "../assistant/wiki-markdown.js";
import type { WikiPage } from "../assistant/wiki-markdown.js";
import type { AssistantAccessPort } from "../ports/assistant-access-port.js";
import type { AssistantChatMessage, AssistantChatPort } from "../ports/assistant-chat-port.js";
import type { WikiRepositoryPort } from "../ports/wiki-repository-port.js";

/**
 * The assistant orchestrator (#499/WU2).
 *
 * The guards run in a fixed order so each one is cheap and total, and so no
 * expensive call is ever spent on a request that will be declined:
 *
 * 1. the per-user `chat_enabled` flag (D9) — off is `forbidden`;
 * 2. the rolling-window cap (D6, 5 per 24h) — over is the fixed Blog suggestion;
 * 3. the question is recorded (D5 — timestamps only, never the text);
 * 4. `index.md` is read and parsed (the router's catalogue);
 * 5. the **router** call decides `in` / `out` / `account`;
 * 6. the routed pages are read;
 * 7. the **answer** call produces the answer and its citations.
 *
 * An invalid model output — unparseable JSON, the wrong shape, an out-of-page
 * citation or a null/length-limited `content` — is retried **once**; if it is
 * still invalid the fixed no-documentation answer is returned. A provider
 * failure (`unavailable`/`timeout`) is `unavailable`, which the route maps to a
 * sanitized `503`.
 */

/** The rolling window: 5 questions per user per 24h (owner decision D6). */
export const ASSISTANT_QUESTION_CAP = 5;
export const ASSISTANT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface AskAssistantDependencies {
  readonly wiki: WikiRepositoryPort;
  /** The router model's transport (owner decision: one model per step). */
  readonly router: AssistantChatPort;
  /** The answer model's transport. */
  readonly answerer: AssistantChatPort;
  readonly access: AssistantAccessPort;
  /** Injectable clock, so the window arithmetic is deterministic in tests. */
  readonly now?: () => Date;
}

export interface AskAssistantRequest {
  readonly question: string;
  /** The verified principal's user id; never a client-supplied value. */
  readonly userId: string;
}

export type AskAssistantErrorCode = "forbidden" | "unavailable";

export type AskAssistantOutcome =
  | { readonly ok: true; readonly value: AssistantAnswer }
  | { readonly ok: false; readonly error: { readonly code: AskAssistantErrorCode } };

const FORBIDDEN: AskAssistantOutcome = { ok: false, error: { code: "forbidden" } };
const UNAVAILABLE: AskAssistantOutcome = { ok: false, error: { code: "unavailable" } };

/** A fixed answer: one of the D8 strings, with no citations. */
function fixed(answer: string): AskAssistantOutcome {
  return { ok: true, value: { answer, citations: [] } };
}

export async function askAssistant(
  dependencies: AskAssistantDependencies,
  input: AskAssistantRequest
): Promise<AskAssistantOutcome> {
  const now = dependencies.now ?? ((): Date => new Date());

  try {
    const enabled = await dependencies.access.isChatEnabled(input.userId);
    if (!enabled.ok) return UNAVAILABLE;
    if (!enabled.value) return FORBIDDEN;

    const askedAt = now();
    const windowStart = new Date(askedAt.getTime() - ASSISTANT_WINDOW_MS);
    const recent = await dependencies.access.countRecentQuestions(input.userId, windowStart);
    if (!recent.ok) return UNAVAILABLE;
    if (recent.value >= ASSISTANT_QUESTION_CAP) return fixed(ASSISTANT_CAP_COPY);

    // Recorded before the model call: the cap is an abuse control, and a write
    // that cannot be recorded fails closed rather than spending provider budget.
    const recorded = await dependencies.access.recordQuestion(input.userId, askedAt);
    if (!recorded.ok) return UNAVAILABLE;

    const indexFile = await dependencies.wiki.readIndex();
    if (!indexFile.ok) return UNAVAILABLE;
    // A missing/bundled index is a server-side fault, never "no documentation".
    if (indexFile.value === undefined) return UNAVAILABLE;

    const index = parseWikiIndex(indexFile.value);
    if (index.length === 0) return fixed(ASSISTANT_NO_DOCUMENTATION_COPY);
    const routable = new Set(index.map((entry) => entry.id));

    const routed = await completeParsed(
      dependencies.router,
      buildRouterMessages(input.question, index),
      parseRouterOutput
    );
    if (routed.kind === "unavailable") return UNAVAILABLE;
    if (routed.kind === "no_documentation") return fixed(ASSISTANT_NO_DOCUMENTATION_COPY);

    const scope = routed.value.scope;
    if (scope === "out") return fixed(ASSISTANT_OUT_OF_SCOPE_COPY);
    if (scope === "account") return fixed(ASSISTANT_ACCOUNT_COPY);

    // Only ids the index lists can select a page, even if the router invented one.
    const selectedIds = [...new Set(routed.value.pages)].filter((id) => routable.has(id));
    if (selectedIds.length === 0) return fixed(ASSISTANT_NO_DOCUMENTATION_COPY);

    const pages = await readPages(dependencies.wiki, selectedIds);
    if (pages === undefined) return UNAVAILABLE;
    if (pages.length === 0) return fixed(ASSISTANT_NO_DOCUMENTATION_COPY);

    const selected = new Set(pages.map((page) => page.id));
    const answered = await completeParsed(
      dependencies.answerer,
      buildAnswerMessages(input.question, pages),
      (raw) => withinSelected(parseAnswerOutput(raw), selected)
    );
    if (answered.kind === "unavailable") return UNAVAILABLE;
    if (answered.kind === "no_documentation") return fixed(ASSISTANT_NO_DOCUMENTATION_COPY);

    return {
      ok: true,
      value: parseAssistantAnswer({
        answer: answered.value.answer,
        citations: buildCitations(answered.value.citations, pages)
      })
    };
  } catch {
    return UNAVAILABLE;
  }
}

type ParsedOutcome<T> =
  | { readonly kind: "value"; readonly value: T }
  | { readonly kind: "no_documentation" }
  | { readonly kind: "unavailable" };

/**
 * One model call with a single retry. A transport failure short-circuits to
 * `unavailable`; an unusable output (a parse/schema failure, or whatever
 * `parse` additionally rejects) is retried once and then `no_documentation`.
 */
async function completeParsed<T>(
  chat: AssistantChatPort,
  messages: readonly AssistantChatMessage[],
  parse: (raw: string) => T
): Promise<ParsedOutcome<T>> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await chat.complete(messages);
    if (!result.ok) {
      if (result.error.code === "invalid_output") continue;
      return { kind: "unavailable" };
    }

    try {
      return { kind: "value", value: parse(result.value) };
    } catch {
      // An unusable output: fall through to the retry.
    }
  }

  return { kind: "no_documentation" };
}

/** Rejects an answer whose citations include a page the router did not select. */
function withinSelected(output: { readonly answer: string; readonly citations: readonly string[] }, selected: ReadonlySet<string>): {
  readonly answer: string;
  readonly citations: readonly string[];
} {
  for (const id of output.citations) {
    if (!selected.has(id)) throw new Error("citation outside the routed pages");
  }
  return output;
}

/** Reads each selected page, dropping a missing/unparsable one; `undefined` on an I/O error. */
async function readPages(
  wiki: WikiRepositoryPort,
  ids: readonly string[]
): Promise<readonly WikiPage[] | undefined> {
  const pages: WikiPage[] = [];

  for (const id of ids) {
    const raw = await wiki.readPage(id);
    if (!raw.ok) return undefined;
    if (raw.value === undefined) continue;

    const page = parseWikiPage(id, raw.value);
    if (page !== undefined) pages.push(page);
  }

  return pages;
}

/** Maps the model's cited ids to the wire citations, with title and screen. */
function buildCitations(ids: readonly string[], pages: readonly WikiPage[]): readonly AssistantCitation[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const citations: AssistantCitation[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    const page = byId.get(id);
    if (page === undefined || seen.has(id)) continue;
    seen.add(id);
    citations.push({ id: page.id, title: page.title, screen: page.screen ?? null });
  }

  return citations;
}
