# Replaceable LLM adapter (issue #21)

## Objective
Implement GitHub issue #21 end to end: a provider-independent boundary that calls a model, retains model/prompt metadata, validates the structured output against the assessment contract from Feature #20, and turns every failure into a typed error rather than a success. Delivered through the ordered Tasks #68 (implement), #69 (test), #70 (evidence).

## Constraints
- Node 24 required: prefix commands with `PATH="/opt/homebrew/opt/node@24/bin:$PATH"`.
- Artifacts/code/tests/docs in English. Conventional commits, no AI attribution.
- Feature Branch Chain with tracker PR; ~400 authored lines per work unit (heuristic).
- Provider-independent by design: the real vendor is **TBD** in `docs/planning/DEMO.md` line 132, so #21 ships no SDK, no API key and no vendor type.
- Pull-request checks must not depend on Testnet, Horizon or a live LLM provider.
- TDD: strict mode (runner: vitest via pnpm). RED observed before GREEN.
- RDD: on (global). Delivery strategy: chain (Feature Branch Chain).

## Decisions
- **D1 — The port lives in `packages/ai`, and the `apps/api` stubs are removed.** Not a preference: the workspace rule `packages-never-import-apps` forbids a package from importing an application, so a port owned by `apps/api` could never be implemented inside `packages/ai`, which is where `monorepo.md` line 71 puts "encapsular el proveedor LLM". `apps/api/src/application/ports/assistant-port.ts` and `apps/api/src/infrastructure/adapters/llm-assistant.ts` were **verified dead code** — a grep found nothing else referencing them, only each other — so replacing them is clean.
- **D2 — Model/prompt metadata is RETURNED, not persisted. No new table. (User decision.)** The adapter returns `{ assessment, metadata: { model, promptVersion, generatedAt, source } }` and the metadata travels with whatever record the caller already writes. `DEMO.md` §5 requires a recommendation to *show* model/prompt (lines 53 and 100), which this satisfies; the list of what PostgreSQL persists (line 129) does not include AI metadata, and #68 is only the adapter — there is still no use case that could execute a persistence step. **Consequence accepted:** the evidence document of Feature #20 says #21 would "persistir" model/prompt/versión. That sentence is now wrong and must be corrected in #70 rather than left standing.
- **D3 — A simulated provider ships in `src`, labelled `source: "simulated"`.** It is the only provider that exists, and shipping it is what makes the boundary executable today without inventing the vendor decision. It is not a test double: it is the demo's provider until the real one is chosen. The `source` discriminator is not decoration — it makes it impossible for a simulated evaluation to pass for a real one downstream, which is the "keep simulated behaviour explicit" requirement.
- **D4 — Provider failures are closed to two sanitized codes**, `timeout` and `provider_unavailable`. A vendor's error vocabulary never crosses the boundary, the same way Horizon's ~30 result codes never cross the Stellar one. A provider that *throws* maps to `provider_unavailable` rather than propagating an exception the caller must remember to catch.
- **D5 — The input boundary is the evidence bundle, not a prompt string.** `assessmentEvidenceBundleSchema` reuses `salesPeriodSchema` and `reviewFindingSchema` from `@vaqcrow/contracts`, and `citableReferences` derives the citable set from exactly that bundle. "Only supplied evidence is sent" therefore becomes a property of the type instead of a promise in a comment.
- **D6 — `rawOutput` is `unknown` on purpose.** A provider does not get to declare its own output valid, so validation happens on the caller's side of the boundary.
- **D7 — No provider SDK is added.** The real provider will be one more implementation of `AssessmentProviderPort`; nothing in this Feature needs to know which one.

## Tasks
- [x] T1 (#68) Implement the provider boundary — RED observed (8 failing, `citableReferences is not a function`), GREEN 8/8 in `packages/ai/src/run-assessment.test.ts`.
- [x] T2 (#69) Contract and timeout matrix in `packages/ai/src/run-assessment.contract.test.ts` (39 tests). **It found a real defect in T1 and closed it** — see Progress. Mutation-proved afterwards.
- [ ] T3 (#70) Evidence document `docs/planning/replaceable-llm-adapter-evidence.md`.

## Progress / evidence
- 2026-09-22: Feature branch `Vaqcrow#21_Feat_Implement_replaceable_LLM_adapter` created off `main` (`4702e5d`); Task branch `Vaqcrow#68_Task_Implement_replaceable_LLM_adapter`.
- 2026-09-22: T1 RED→GREEN. New files in `packages/ai/src/`: `assessment-evidence.ts`, `assessment-provider-port.ts`, `run-assessment.ts`, `simulated-assessment-provider.ts`, plus the barrel and a focused test. `@types/node` added to the package's devDependencies for `setTimeout` typing — acceptable because `DEMO.md` line 143 makes `packages/ai` backend-only.
- 2026-09-22: `pnpm run verify` **EXIT=0**: `@vaqcrow/ai` 3 test files green, contracts 8, api 21, web 65, domain 1; `boundaries` clean over 288 modules / 768 dependencies; `test:boundaries` 6 files. The one lint warning is pre-existing in `apps/web`.
- One typecheck failure was found and fixed during the cycle (`TS2552: Cannot find name 'AssessmentProviderOutcome'` — a missing type import), which is exactly what the gate is for.
- 2026-09-22: T2. The matrix produced a **genuine RED** — not a manufactured one — and that is the point of an ordered test Task:

  | Scenario | Observed before the fix |
  |---|---|
  | A provider attaches `message`/`retryAfterMs` to its own error object | The orchestration returned the provider's object **as-is**, so a vendor message, a path and a token-shaped string reached the caller. The repository forbids an adapter leaking `message`/`details`/`hint`. |

  Fixed in `sanitizeProviderFailure`: the failure is rebuilt from the single allowed field, and an unrecognised code fails closed to `provider_unavailable`. The same class of hole on the *success* path was closed at the same time — metadata is now validated against `assessmentMetadataSchema`, so a provider cannot append a field to what an operator is shown.

- 2026-09-22: 89 tests pass (39 new here). The matrix was then mutation-tested against a verified byte-identical restore:

  | Mutation | Effect on the suite |
  |---|---|
  | provider error passed through again (sanitization reverted) | **1 failed** / 88 passed |
  | metadata validation dropped | **1 failed** / 88 passed |
  | timeout race removed | **3 failed** / 86 passed |
  | evidence guardrail skipped | **4 failed** / 85 passed |
  | none (baseline) | 89 passed |

- 2026-09-22: `pnpm run verify` **EXIT=0** on the T2 tree: `@vaqcrow/ai` 4 test files green, contracts 8, api 21, web 65, domain 1; `boundaries` clean over 289 modules / 772 dependencies; `test:boundaries` 6 files. The one lint warning is pre-existing in `apps/web`.

## Next step
T3 (#70) on branch `Vaqcrow#70_Task_Document_evidence_for_replaceable_LLM_adapter`, stacked on the Feature branch.

## Advisories (non-blocking, must be carried forward)
- **The Feature #20 evidence document is now partly wrong.** It states that #21 would persist model/prompt/version; per D2 that is not what was built. Correct it in #70 — do not leave the claim standing.
- **The real provider is still undecided** (`DEMO.md` line 132 `TBD`, and line 412 lists choosing it as a P0 demo-prep item). Nothing in #21 blocks on it, but the live rehearsal does.
- **Docker image NOT rebuilt** since `packages/ai` was added as a workspace member (carried from Feature #20). Docker is unavailable in this environment.
- **`test:boundaries` depends on built `dist/`** (carried from Feature #20): it resolves `@vaqcrow/*` through each package's `package.json` → `dist/`, so running it alone on a clean tree fails. Safe inside `pnpm run verify` because `build` runs first.
- **Metadata is strict on purpose.** A third-party adapter that appends a field to its metadata (say `latencyMs`) now fails as `invalid_output` rather than passing it through. That is the intended fail-closed behaviour: the port's metadata type is the contract, so a new field means changing the contract, not smuggling it.

## Method note (learned the hard way, worth keeping)
- **`git checkout -- <file>` is destructive to uncommitted work, and it silently broke a verification run here.** While mutation-testing T1's fix, the restore step used `git checkout -- run-assessment.ts`, which restored **HEAD's** version — discarding the uncommitted fix — so the "baseline" afterwards reported 2 failures and looked like flakiness. It was not flakiness; the fix had been deleted. The correct pattern for mutating a file with uncommitted changes is to copy it aside (`cp` to a temp path) and restore from that copy, then verify the restore with `cmp`. Both were done on the second pass, and the mutation numbers below come from that clean run.
