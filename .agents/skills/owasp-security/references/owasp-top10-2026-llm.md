# OWASP Top 10 for LLM Applications 2026 — mapped to Vaqcrow

Edition in force: **OWASP Top 10 for LLM Applications 2026** (v1.0, published 2026-08-03). Official source: <https://genai.owasp.org/llm-top-10/>.

The full list has ten items; only the ones reachable by Vaqcrow's AI code are enforced here (the AI evaluation of documents and the RAG help assistant). The line between "model as component" (this list) and "model as actor" (the OWASP Agentic Top 10) matters: while the AI has no tools, only this list applies.

Where this AI runs in the code: `apps/api/src/application/config/llm-config.ts` (OpenCode Go), the completeness/relevance pass, and the future help assistant.

## LLM01:2026 — Prompt Injection

Highest risk; now also covers cross-modal injection (instructions hidden in an image or audio).

- Question text, wiki pages, uploaded documents, and rasterized PDF/image pixels are all untrusted input. Instructions inside any of them must not change the assistant's rules — keep the system rules in a fixed, separate layer and never let retrieved content overwrite them.
- The document/relevance pass sends a rasterized page to a vision model: an image can carry text like "ignore previous instructions". Keep that pass' output advisory and schema-bound.
- Code guards, not prompt text, enforce the limits: out-of-scope → fixed decline; no covering page → fixed "no documentation" answer.

## LLM02:2026 — Sensitive Information Disclosure

- Never place a secret (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, super-admin password) into a prompt, and never log a prompt or response that can carry one.
- The relevance pass reads the owner's uploaded documents; its output must not echo private document content back beyond the judgement it returns.
- Return only what the user is entitled to see.

## LLM06:2026 — Unbounded Consumption

Cost and availability exhaustion, accidental or malicious.

- Rate-limit per user (the help assistant needs one before it ships); cap tokens and cap the number of calls per request (the router + answer design is a two-call budget by construction).
- `LLM_VISION_MODEL` is required with no default, so the API cannot silently fall back to an unbounded or unintended model.

## LLM10:2026 — Improper Output Handling

Output is untrusted: it must not be executed or trusted as markup.

- Validate every structured LLM response with a schema (zod) before use; invalid output → one retry, then the safe fallback answer.
- Assistant answer text that contains Markdown is rendered as the same untrusted content as any other Markdown: no raw-HTML execution.
- Never treat model output as a command, a code change, or a decision that moves funds or changes state.

## LLM03:2026 — Excessive Agency (only once the AI gains tools)

Today the AI is advisory only: it never approves, computes obligations, or moves funds, so this item is not yet reachable. If a future change gives the assistant tools (search, actions, memory with side effects), load this item and re-review: the blast radius is whatever the tools can do.

## Source

- OWASP GenAI LLM Top 10 (2026 edition) — <https://genai.owasp.org/llm-top-10/>.
