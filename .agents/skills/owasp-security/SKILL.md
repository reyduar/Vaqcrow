---
name: owasp-security
description: "Trigger: security review, OWASP, vulnerability, hardening, prompt injection. Audit Vaqcrow changes against OWASP Top 10:2025 + LLM 2026."
license: Apache-2.0
metadata:
  author: "reyduar"
  version: "1.0"
---

# OWASP Security Review

## Activation Contract

Load before declaring done any change that touches authentication, authorization, RLS or grants, request/input parsing, file upload or download, rendering of untrusted content, LLM prompts or model output, secrets or configuration, outbound HTTP, or Stellar transaction building. Also load on "review security", "check for vulnerabilities", "harden this".

## Hard Rules

- Judge against **OWASP Top 10:2025** (web) and **OWASP Top 10 for LLM Applications 2026** (items LLM01, LLM02, LLM06, LLM10; add LLM03 once the AI gains tools). These editions are fixed — never enforce the 2021 list.
- Report every finding with its category id (`A01:2025`, `LLM01:2026`), file, and line.
- Treat all external input as hostile: body, query, headers, uploaded documents, PDF/image pixels, fetched Markdown or wiki pages, LLM output, Horizon/RPC responses.
- The acting user and role come only from the verified principal — never from a body or query field. Row access is enforced by Supabase RLS, never by client-side filtering.
- Fail closed (A10:2025): a security check that throws must deny. Catch blocks around authorization must not swallow, and must never treat an error as success.
- Record the pass/fail result, with findings, in `odd/tasks/<slug>.md`.

## Decision Gates

| If the change adds… | Then check |
| --- | --- |
| A table or column | RLS on + explicit grants in the same migration; no surviving default `anon`/`authenticated` grant |
| A secret or config value | Config module **and** `scripts/demo/preflight`, same work unit; never in the repo |
| A dependency | Justify, lock, inspect postinstall and transitive (A03:2025) |
| A parsed request field | Validate shape before use; reject unknown/extra |
| Output from an LLM | Validate with a schema; never execute or trust it as markup |
| Rendered Markdown or HTML | No raw-HTML execution without sanitization |
| Outbound HTTP | Fixed allowlist of hosts; no user-supplied URL |

## Execution Steps

1. List the categories the diff can reach, using the table above.
2. Walk the matching per-category checks: `references/owasp-top10-2025-web.md` always; `references/owasp-top10-2026-llm.md` for AI code.
3. For each hit, note category, `file:line`, severity, and the smallest fix.
4. A real finding gets its own issue — do not widen scope silently.
5. Write the result line in the work log.

## Output Contract

Return a findings list `category | file:line | problem | fix`, or an explicit "no findings". Always name the two editions used.

## References

- `references/owasp-top10-2025-web.md` — the ten web categories mapped to this stack.
- `references/owasp-top10-2026-llm.md` — the relevant LLM Top 10 2026 items mapped to this stack.
