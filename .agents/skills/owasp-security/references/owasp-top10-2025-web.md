# OWASP Top 10:2025 — mapped to Vaqcrow

Edition in force: **OWASP Top 10:2025** (released November 2025, finalized January 2026; the next revision is expected around 2028–2029). Official source: <https://owasp.org/Top10/2025/>.

> [!warning] Do not use the 2021 order
> Several third-party blogs still publish the 2021 list (with `A03 Injection`, `A10 SSRF`). In 2025, **SSRF (CWE-918) was folded into A01** and `A03` is Software Supply Chain Failures. Where a source disagrees with `owasp.org/Top10/2025/`, the official page wins.

Stack under review: Fastify API (`apps/api`), Next.js web (`apps/web`), Supabase (Auth / RLS / Storage), Stellar + Freighter, OpenCode Go (LLM).

## A01:2025 — Broken Access Control

Highest-risk category; now absorbs SSRF. Vaqcrow's exposure: per-role authorization (`PYME`/`INVERSOR`/`ADMIN`), row ownership, and outbound fetches.

- Every new route declares its audience explicitly (public / authenticated / role) and takes the acting user **only** from the verified principal.
- Reads and writes are scoped by owner in the query, not filtered after the fact on the client. Supabase RLS is the enforcement point; a missing policy is a finding.
- `admin`/`service_role`-only tables never gain an `authenticated` grant.
- SSRF: outbound requests go to fixed hosts (Supabase Storage, Horizon/RPC, the LLM base URL, Resend). No user-supplied URL is fetched; if one must be, allowlist the scheme + host.

## A02:2025 — Security Misconfiguration

Rose to #2. Vaqcrow's exposure: config slices, grants, CORS, error surfaces.

- A new table ships RLS **and** explicit grants in one migration; no default `anon`/`authenticated` grant survives, even transiently.
- A new secret or setting is added to the config module and mirrored in `scripts/demo/preflight` in the same work unit; slices that matter **fail closed** outside `local` rather than booting with a loopback or empty default.
- Adapters map upstream errors to a sanitized shape; `message`/`details`/`hint`, stack traces, and connection strings never reach a client.
- No default credentials anywhere; secrets live only in `.env.cloud`/`.env.docker`/Railway, never in this public repo.

## A03:2025 — Software Supply Chain Failures

New in 2025; expands "Vulnerable and Outdated Components" to the whole build/distribution chain.

- A new dependency is justified, locked (`pnpm-lock.yaml` / `skills-lock.json`), and — if it is a package, not a skill — its postinstall and transitive tree checked; the WASM rasterizer (`@hyzyla/pdfium`) and LLM SDKs are the sensitive ones.
- GitHub Actions are pinned; a workflow never runs untrusted postinstall or a floating tag.
- Skills added to `.agents/skills/` are recorded and, when sourced externally, locked with a `computedHash`.

## A04:2025 — Cryptographic Failures

- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `VAQCROW_SUPERADMIN_PASSWORD`) are never logged, echoed in errors, or committed.
- All outbound traffic is TLS. Password handling is delegated to Supabase Auth — Vaqcrow never hashes or stores credentials.
- Vaqcrow is non-custodial: it never receives or stores a private key or seed phrase; the private key stays in Freighter.

## A05:2025 — Injection

Includes XSS. Vaqcrow's exposure: PostgREST filters, contract args, and rendered content.

- No string-concatenated SQL or PostgREST filters; use `supabase-js` filters/`rpc` parameters.
- Untrusted content (documents, LLM output, Markdown) is never rendered as raw HTML. A Markdown renderer runs **without** `rehype-raw` unless the output is sanitized — the direct risk in the Blog feature.
- Values passed to a Soroban call are validated against the schema; no `as any` into a contract arg.

## A06:2025 — Insecure Design

- Any change with security consequences states its threat model in one or two lines before review.
- No security control relies on the client: role checks, rate limits, and ownership live server-side.
- The AI stays advisory: it never approves, computes obligations, or moves funds; the All-or-Nothing rule is enforced by the vault contract, not by UI state.

## A07:2025 — Authentication Failures

Renamed from "Identification and Authentication Failures".

- Authentication is Supabase Auth only; no bespoke session, token, or password logic is invented.
- `ADMIN` is never self-assigned. The role comes from the verified principal, and the sign-in form's role toggle must match it (a mismatch keeps no session).
- Email confirmation is on for `PYME`/`INVERSOR`; do not weaken it in a new flow.

## A08:2025 — Software or Data Integrity Failures

- Anything crossing a trust boundary is verified before use: LLM structured output is schema-validated; client-supplied state transitions are not trusted — use conditional `UPDATE ... WHERE id=$1 AND state=$from` so a replay is idempotent instead of double-applying.
- Persisted evidence is real: transaction hashes are stored, never synthesized. A missing hash renders «Sin dato», never zero.

## A09:2025 — Security Logging & Alerting Failures

Renamed to emphasize alerting.

- A new failure path logs enough to act on, with no secret or PII in the message, and never fails silently (a provider outage is a `503 { code: "unavailable" }`, not a `200` with empty data).
- Privileged actions append to the audit log (as operator invitations already do).

## A10:2025 — Mishandling of Exceptional Conditions

New in 2025: fail-open paths, error handling, and race conditions in security checks. This is the category most likely to bite Vaqcrow.

- A security check that throws **denies**. Authorization errors are never caught and turned into "allowed".
- No swallowed exceptions in auth/authorization paths; an optional slice that fails to resolve must fail closed, not open.
- Guard against TOCTOU/races in state changes: reserve state with a conditional update and re-check the invariant inside the same statement, not in a separate read.

## Source

- OWASP Top 10:2025 — <https://owasp.org/Top10/2025/> (categories A01–A10 and the 2021→2025 changes).
