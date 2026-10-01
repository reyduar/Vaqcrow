# Task #97 — Document evidence for complete vertical demo journey

## Objective

Produce the Feature-closing evidence document for Feature #30:
`docs/planning/complete-vertical-demo-journey-evidence.md`, in Spanish, following
the established evidence-corpus convention. #97 is the last Task of the three, and
the Feature cannot close without it.

## Context

Feature #30 ("Integrate the complete vertical demo journey") depends on #16, #20,
#24 and #28 — **all four are CLOSED**. Its three Tasks are #95 (Implement), #96
(Test) and #97 (this one); all three are still OPEN, so #97 closing is what
unblocks the manual closure of the Feature.

What was delivered, for traceability:

- The `#95` feature-branch chain: slices 1–8 (PRs #354–#361) plus slice 9 (PR
  #362, T6 + the preflight follow-up) and slice 10 (PR #363, Task #96).
- The tracker `#353` now carries the whole Feature (54 commits over `main`,
  `+13236/−1529` in 168 files) after the chain tip was merged into it; the
  per-PR merges cascaded inside the chain and did not reach `main` on their own.
- Work logs to draw from: `odd/tasks/complete-vertical-demo-journey.md` (the #95
  chain, T1–T6), `odd/tasks/test-complete-vertical-demo-journey.md` (#96),
  `odd/tasks/demo-preflight-and-doc-alignment.md` (the T6 follow-up),
  `odd/tasks/hosted-vault-configuration-closure.md` (the hosted vault), and the
  existing corpus under `docs/planning/`.

**Read `docs/planning/evidence-dashboard-evidence.md` first** — it is the sibling
of the document being written (Feature #29's closure doc) and its shape is the
convention: an opening blockquote stating what the document consolidates, that it
does **not** re-derive numbers already recorded in the task logs, and that it
**does not claim the Feature is closed**; then a mapping against the Feature's and
each Task's acceptance criteria, quoted verbatim, with the source of every
verification result; then the standing limits as a set; then a sweep of stale
claims. Do not invent a new structure.

## Acceptance criteria of the Feature and its Tasks — quote these verbatim

**Feature #30:**

- [ ] Connect the single synthetic SME journey from request through AI, approval, funding, confirmation and distribution.
- [ ] Required evidence and failure behavior are covered.
- [ ] No unsupported production claims or secrets are introduced.

**Task #95 (Implement):**

- [ ] Feature #30 behavior is implemented within its documented boundary.
- [ ] Integrate the single synthetic SME journey from request through AI assessment, human approval, Freighter funding, asynchronous confirmation, monthly sales, deterministic obligation, distribution, and evidence in seven minutes or less.
- [ ] Failure paths remain truthful and do not weaken security, simulation, or human-control boundaries.
- [ ] Zustand stores only cross-route client workflow state required by the complete vertical journey.
- [ ] Server state remains owned by SWR and backend-authoritative state remains outside Zustand, with no parallel representation treated as source of truth.
- [ ] Implementation evidence records the applicable skill or MCP support used—or `none`—before any Zustand-related manifest or lockfile mutation.

**Task #96 (Test):**

- [ ] Deterministic tests or bounded rehearsal checks demonstrate the core behavior of Feature #30.
- [ ] Validation, rejection, and fallback behavior is covered where applicable.
- [ ] The focused verification passes without exposing sensitive data.

**Task #97 (this one):**

- [ ] Evidence identifies Feature #30, verification commands or rehearsal steps, and observed results.
- [ ] Evidence is traceable to implementation and focused verification.
- [ ] Sensitive data and unsupported production claims are excluded.

## Verification results available, with their honest provenance

Attribute each one to how it was actually obtained. Do not upgrade a report into
a re-run.

| Result | Source, as it must be described |
|---|---|
| `pnpm run verify` exit 0 | Run in the foreground by the delegated writer of #96; the parent independently re-ran `pnpm run test:boundaries` (143 passed, 8.56s) |
| `pnpm --filter @vaqcrow/web exec playwright test` → 31 passed | Run by the delegated writer of #96; the parent re-ran `e2e/full-journey.spec.ts` alone (3 passed, 29.9s) |
| `pnpm demo:preflight --env-file .env.cloud` → exit 1, 9 failures before / 7 after the contract fix | Run by the parent against the real environment; read-only; names only, never secret values |
| `pnpm run test:db` → 6 files / 115 tests PASS | **Reported in the T6 section of `odd/tasks/complete-vertical-demo-journey.md`; not re-run for this document.** Say so |
| CI check runs on PRs #354–#363 | The runs listed on those PRs |
| The T6 slice's review was approved and its acknowledgement executed (authority burned) | The native review transaction for `review-825fe2c1f52883dd` |
| The T6-F and #96 slices have **no independent lens verdict** | Both transactions were abandoned by the operator; `captured_lens_results` was empty in each. State this plainly |

**Limits that must be stated, not smoothed over:** the `e2e-live` suite still
needs Testnet and operator credentials and was **not** run; the browser
end-to-end journey against production was **not** run; the 2026-12-16 Testnet
reset invalidates the contract addresses; a stale contribution-mirror row after a
full withdrawal is a documented known limit; a malformed campaign id answers
`503` instead of `400`; and `scripts/` is covered by neither `turbo run lint` nor
`lint:tests`.

## Stale-claim sweep (this is why the sweep exists)

Three claims were found false during this Feature and already corrected —
confirm none of them reappears anywhere, and record the sweep:

1. The platform-key ↔ factory-`owner` correspondence was recorded as unproven
   after it had been proven (2026-09-25).
2. The preflight required two variables the API treats as optional
   (`STELLAR_HORIZON_URL`, `STELLAR_RPC_URL`).
3. The obsolete `supabase/seed/demo-application.sql` was referenced after the
   journey stopped depending on it.

## Scope

In scope:

- `docs/planning/complete-vertical-demo-journey-evidence.md` (new).
- `odd/tasks/document-evidence-for-complete-vertical-demo-journey.md` — this log.

Out of scope:

- No production code, no test, no config change. If the sweep finds a document
  that contradicts the evidence corpus, **report it** rather than silently
  rewriting it; a correction belongs to its own work unit unless it is this
  document's own claim.
- Do not close any issue, and do not claim the Feature is closed.

## Constraints

- **Spanish**, neutral/professional, matching the corpus (read a sibling first).
  Obsidian syntax: `> [!info]` / `> [!warning]` / `> [!tip]` callouts, `[[wikilink|text]]`
  links, `^block-id` anchors where the corpus uses them.
- Quote every acceptance criterion verbatim; never paraphrase one.
- Name the source of every verification result. Never present a reported result
  as a re-run, and never claim a check that was not executed.
- No secrets, no PII, no seed data, no unsupported production claims. The demo is
  simulated: identity, KYC/KYB, sales history and the ARS/asset broker are
  synthetic, Stellar runs on Testnet with no economic value, and the AI is
  advisory only.
- Conventional Commits, no AI attribution.

## Tasks

- [x] **C1** — Write `docs/planning/complete-vertical-demo-journey-evidence.md`
  following the sibling's structure: the opening blockquote, the context, the
  criteria mapping for #30 and each of the three Tasks quoted verbatim with the
  source of each result, the standing limits as a set, and the stale-claim sweep.
  *Route: delegated writer.*
- [x] **C2** — Run the sweep across the corpus and record it, naming any document
  that contradicts the evidence and how it was resolved.
  *Route: delegated writer.*
- [x] **C3** — Record the actual results and the commit hash in this log.
  *Route: delegated writer.*

## Checks

```
pnpm run lint            # markdown is not linted, but the tree must stay clean
git status --short       # nothing left behind
```

The document is prose: the check that matters is that every claim in it resolves
against the repository, the task logs or the CI runs it cites. Verify a sample of
the concrete claims (a commit hash, a PR number, a test count) rather than
asserting they are right.

## Decisions (2026-09-30, user)

- Write the evidence document now, on
  `Vaqcrow#97_Task_Document_evidence_for_complete_vertical_demo_journey`, cut from
  the chain tip.
- Do not claim the Feature is closed: closure is manual and follows this unit.

## Progress

- [x] Scoping (the Feature's criteria, the three Tasks' criteria, the four closed
      dependencies, the sibling document's structure, the available results and
      their provenance).
- [x] Implementation (C1–C2).
- [x] Verification (C3).
- [x] Committed as a work unit; the evidence document's commit hash is recorded
      below.

### 2026-09-30 — implementation

- Read the sibling `docs/planning/evidence-dashboard-evidence.md` for the shape
  (opening blockquote, `1. Contexto y objetivo` … `8. Estado de entrega`), and the
  work logs (`complete-vertical-demo-journey.md` T1–T6, `test-complete-vertical-demo-journey.md`,
  `demo-preflight-and-doc-alignment.md`, `hosted-vault-configuration-closure.md`).
- Wrote `docs/planning/complete-vertical-demo-journey-evidence.md` (Spanish,
  Obsidian callouts + wikilinks) with: an opening blockquote that says what it
  consolidates and that it does **not** claim the Feature is closed; the context
  (Feature #30, its four CLOSED dependencies, the three Tasks, the chain PRs
  #354–#363 and the tracker #353); the traceable implementation; the deterministic
  coverage; the observed verification results **with each one's real provenance**;
  the mapping of the 15 criteria (Feature #30 + #95 + #96 + #97) quoted verbatim;
  the standing limits as a set; the sweep; and the delivery/review state.
- Criterion verdict: 14 met, 1 **partial** — #95's "…in seven minutes or less": the
  integration is delivered and proven deterministically, but the ≤7-minute budget
  was never measured in a hosted run (T6 prepared the preflight and the runbook;
  the timed run itself did not execute). Recorded, not smoothed.
  > [!info] Superseded (2026-10-01)
  > The budget was measured — the provider latency against the hosted environment —
  > and the criterion is now stated as **not achievable as measured**; see the
  > Correction section below. The timed full journey itself still has no end-to-end
  > measurement.
- Provenance discipline: `pnpm run verify` exit 0 and `playwright test` 31 passed
  are attributed to the delegated writer of #96, with the parent's independent
  re-runs of `pnpm run test:boundaries` (143 passed) and `e2e/full-journey.spec.ts`
  alone (3 passed) called out as re-runs; the preflight run (exit 1, 9→7 failures)
  is attributed to the parent against the real environment, read-only;
  `pnpm run test:db` 6 files / 115 tests is labelled **reported in T6, not re-run**;
  the PRs #354–#363 are cited as CI runs. No reported result is presented as a
  re-run of this document.
- Review state stated plainly: the T6 slice's native review was approved and
  acknowledged (authority burned, `review-825fe2c1f52883dd`); the T6-F and #96
  slices have **no independent lens verdict** (both transactions abandoned,
  `captured_lens_results` empty).

### 2026-09-30 — the sweep (C2)

`rg` over `docs/`, `odd/`, `AGENTS.md`, `CLAUDE.md` for the three claims:

- **Factory `owner` ↔ platform key unproven** — no live statement. Living docs
  declare it proven (`docs/architecture/cloud-demo-architecture.md:128`,
  `docs/planning/demo-run-preflight.md:134`); the historical text survives only as
  a dated record, including a retired limitation with a
  `> [!info] Retirado (2026-09-30)` callout
  (`odd/tasks/cloud-demo-architecture-and-evidence.md:58-61`).
- **Preflight requiring `STELLAR_HORIZON_URL` / `STELLAR_RPC_URL`** — no live
  statement. All docs and `AGENTS.md`/`CLAUDE.md` list both as optional with a
  canonical Testnet default; `scripts/demo/preflight/preflight.mjs:16` says they
  are deliberately absent and `tests/demo-preflight.test.ts` asserts it.
- **`supabase/seed/demo-application.sql`** — the directory no longer exists; living
  docs say it was eliminated (`docs/planning/demo-run-preflight.md:22`) or carry a
  retirement callout (`docs/planning/campaign-vault-web-journey-evidence.md:46`).
  Remaining mentions are dated iteration-log records of work done when it existed.
- **Result: clean.** The one borderline item is a dated iteration log that
  describes the seed's effect in the present tense at the time of an earlier fix
  (`odd/tasks/implement-ai-failure-routing-to-manual-review.md:392`); it is a
  historical record, not a live claim, and it is reported back rather than
  rewritten (a correction of another document belongs to its own work unit).

### Claim verification (sample actually looked at)

- Commit hashes: every hash cited in the document and in §3 resolves as a commit
  (`git cat-file -t` over 31 hashes → all `commit`).
- PRs: `gh pr view` for #354–#363 → all MERGED, with the head branches matching the
  chain; the tracker #353 → MERGED, `+13236 / −1529`, 168 files, 54 commits
  (matches the scope's numbers).
- Issues: `gh issue view` → #16/#20/#24/#28 CLOSED; #30/#95/#96/#97 OPEN.
- Paths: every file path cited in §3 exists in the working tree (checked).
- Acceptance criteria: the 15 quotes match `gh issue view 30/95/96/97` verbatim.
- Dropped/softened: no claim was dropped. The T6 review transaction id
  `review-825fe2c1f52883dd` is an internal tooling record, not a repository
  artifact; it is cited as recorded (the document says so) rather than asserted as
  independently re-verifiable.

## Verification evidence

- `git status --short` before staging → only the two in-scope files untracked;
  after the work-unit commit, only the log remains (staged and committed).
- `pnpm run lint` → **5 successful, 5 total** (turbo), **0 errors**, the single
  pre-existing warning in `apps/web/src/infrastructure/http/fetch-http-client.ts`
  (`_request` unused), unrelated and untouched. Markdown is not linted; the tree
  is clean.
- Work-unit commit for the evidence document:
  **`ef59fe0`** — `docs(planning): add the complete vertical demo journey evidence`
  (1 file, +140). This log is recorded in the follow-up commit.
- Readback: every concrete claim in the document was resolved against the
  repository, the task logs or `gh` before it was written; the sweep is clean.

## Correction — 2026-10-01 (the provider latency is measured)

The evidence document claimed the ≤7-minute criterion had **never been measured**.
That was true when written and false as of 2026-10-01, when the provider's latency
was measured against the hosted environment. The three stale-claim items of the
sweep do not cover it — it is this document's own claim — so it was corrected here.
A "never measured" statement in a document whose purpose is traceability is exactly
the defect class the Feature already fixed twice.

### The measurement

Measured on 2026-10-01 against `https://api-production-c07f.up.railway.app`, via the
**non-persisting** `POST /assessments` probe (that route runs only the provider: it
has no repository dependency and writes nothing):

- Probe at the then-effective default timeout → `504 {"code":"timeout"}` after **30.69 s**.
- Probe after raising the timeout → **200 OK** after **93.79 s** (a real, complete
  assessment: risk band, reasons with evidence references, an anomaly, missing-data items).
- Second probe after raising the timeout → `504 {"code":"timeout"}` after **120.56 s**.
- The successful assessment's own `metadata.model` names `glm-5.3-flash`.

The provider is **healthy**: it returns a complete assessment; the problem is
latency, not availability or credentials. `LLM_TIMEOUT_MS` was **unset** on the
hosted API service, so the code default of **30 s** applied and every assessment
failed; it is now **120000**, the code's maximum
(`apps/api/src/application/config/llm-config.ts`: default 30_000, min 1_000, max
120_000). The latency therefore cannot be fixed by raising the timeout further. The
assessment is the **second of six** journey steps: 93.79 s is about **22 %** of a
420 s budget, and exceeding 120 s is about **29 %** or more, in one step. The
criterion is therefore stated as **not achievable as measured** on the hosted
provider path — not as "failing", and not as a PASS.

### Decision — no model change

The configured model is already the **flash** tier. A heavier model was considered
and **deliberately not adopted**: a flash-tier model already taking 93.79 s means
the model's weight is not the cause. Recorded as a decision, not an open question.
The operator's first rehearsal attempt (application
`9054287c-b474-4a5e-b814-6a0a54afd123`) failed at that step for exactly this
reason; the failure is recorded durably as a sanitized handoff, and by design a new
`handoffId` against a durable record returns `409 correlation_conflict`, so that
application cannot be reused — a rehearsal needs a fresh request.

### Files corrected (Spanish, corpus conventions)

- `docs/planning/complete-vertical-demo-journey-evidence.md` — the #95-5 criterion
  row's status reason; a new §5 latency row; §2 "Reproducción local" (the hosted
  runs are now the preflight **and** the latency probe); §7 limits (the browser run
  stays limit 2, a new AI-latency limit 3 carries the numbers, the former 3–7 become
  4–8); the criteria-summary sentence; §7.1 (three → four claims, item 4 added); and
  the "Próximo paso" paragraph.
- `docs/planning/demo-run-preflight.md` — §4 gains an Obsidian `> [!warning]`
  callout: the hosted assessment takes on the order of one to two minutes and can
  exceed the timeout; `LLM_TIMEOUT_MS=120000` is set on the hosted service (the
  code's maximum); and a failed assessment **burns the application**, so the
  operator must start a fresh request rather than retrying the same one.

No code, test, config or `.env` file was touched; `LLM_TIMEOUT_MS` was not changed
here (it is already set on the hosted service).

- Work-unit commit: **`ccedb3d`** — `docs(planning): correct the seven-minute claim with the measured AI latency`
  (3 files: the two planning docs and this log). This follow-up commit inserts the hash.
