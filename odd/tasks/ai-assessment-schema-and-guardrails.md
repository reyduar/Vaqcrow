# AI assessment schema and guardrails (issue #20)

## Objective
Implement GitHub issue #20 end to end: the structured AI assessment contract (strict shape that rejects unknown fields, invalid types and uncited claims) plus the guardrails that make a model response admissible — every cited reference resolves against the evidence actually supplied, the allowed action set is closed to human review, and free text is untrusted data. Delivered through the ordered Tasks #65 (implement), #66 (test), #67 (evidence).

## Constraints
- Node 24 required: prefix commands with `PATH="/opt/homebrew/opt/node@24/bin:$PATH"`.
- Artifacts/code/tests/docs in English. Conventional commits, no AI attribution.
- Feature Branch Chain with tracker PR; ~400 authored lines per work unit (heuristic).
- Provider-independent by design: Feature #21 owns the LLM adapter, timeout typing and model/prompt persistence. #20 ships no provider, no network and no business calculation.
- TDD: strict mode (runner: vitest via pnpm). RED observed before GREEN, every cycle.
- Pull-request checks must not depend on Testnet, Horizon or a live LLM provider.
- RDD: on (global). Delivery strategy: chain (Feature Branch Chain).

## Decisions
- **D1 — REVERSED. The capability lives in `packages/ai`, not in `packages/contracts`.** The first attempt put the contract in `packages/contracts`; the user challenged it and was right. `docs/architecture/monorepo.md` line 71 assigns "validar salidas estructuradas" to `packages/ai`, and line 70 forbids `packages/contracts` from carrying "lógica de negocio escondida en DTOs" — which is exactly what a cross-dataset guardrail is. Root cause of the error: I let an implementation accident (Stellar adapters collapsed into `apps/api/src/infrastructure/adapters/`) outweigh the written responsibility table, and those are not equivalent — Stellar there is an I/O adapter, this is pure logic. The pre-existing `humanDecisionCommandSchema.superRefine` is not a counter-example either: that is internal self-consistency of one schema (approved ⇒ limit present), not a rule that depends on an external dataset.
- **D2 — Vocabulary follows `docs/planning/DEMO.md` §5**, the documented model output: `assessmentId`, `riskBand`, `confidence`, `reasons[].{claim,evidenceRefs}`, `anomalies[].{type,evidenceRef,severity}`, `missingData`, `recommendedAction`, `questions`. The web fixture (`apps/web/src/application/assessment/simulated-assessment.ts`) uses a different, UI-local shape; it stays untouched and is not the contract.
- **D3 — `assessmentId` is an `asm_`-prefixed opaque id**, not a branded UUIDv4 like the backend-owned entity ids. It is model output, so it must not be able to masquerade as a backend identifier.
- **D4 — `recommendedAction` is a closed single-value enum `["human_review"]`.** The strongest honest encoding of "the AI does not approve": there is no representable action other than handing the case to a person.
- **D5 — Rejection is total, not first-failure.** `validateAssessmentEvidence` returns every unresolvable reference with its path, so the rejection is auditable rather than opaque.
- **D6 — Scope boundary.** `model`/`prompt`/version metadata is intentionally absent from this contract; persisting it is #21's stated requirement, not #20's.
- **D7 — `packages/ai` imports the evidence-reference vocabulary from `packages/contracts`.** That is dependency direction (`monorepo.md` line 88: `packages/ai` may implement normalized contracts), not a mixing of concerns; `packages/contracts` keeps owning the portable, consumer-facing schemas.
- **D8 — The new unit gets a machine-checked boundary: `web-never-imports-ai`.** `monorepo.md` line 85 does not list `packages/ai` among `apps/web`'s allowed dependencies, so the rule carries no type-only exemption — the package holds runtime validation logic, not just types. Added with a fixture, following the repo's discipline that a rule without a fixture is a rule that can silently stop protecting anything.
- **D9 — The API image stays a single deployable; it gains one workspace member.** `packages/ai` is a `private: true` internal library bundled into the existing `apps/api` image, exactly like `packages/domain`. It does NOT become a second deployable. `apps/api/Dockerfile` is an explicit allowlist, so the package had to be added there (deps manifest, node_modules, source, build step, production dist) or the image would break the moment #21 imports it.

## Tasks
- [x] T1 (#65) Implement assessment contract and evidence guardrail in `packages/ai` — RED observed (6 failing, `parseAiAssessment is not a function`), GREEN 6/6 in `packages/ai/src/ai-assessment.test.ts`.
- [x] T2 (#65) Wire `packages/ai` into the workspace and the API image: package scaffolding, root devDependency, `pnpm-lock.yaml`, `apps/api/Dockerfile`, `web-never-imports-ai` rule + fixture. Delivered as PR #214, merged into the Feature branch as `f7cd8bd`.
- [x] T3 (#66) Golden matrix in `packages/ai/src/ai-assessment.golden.test.ts` (36 tests): valid, missing, anomalous, malformed and injection-bearing outputs, plus evidence-reference rejection and the no-path-to-approval boundary. **Mutation-proved, not asserted**: see Progress.
- [ ] T4 (#67) Evidence document `docs/planning/ai-assessment-schema-and-guardrails-evidence.md`.

## Progress / evidence
- 2026-09-22: Feature and Task branches created off `main` (`ffa1876`). Dependencies #12 and #15 verified closed on GitHub before starting.
- 2026-09-22: T1 RED→GREEN. Committed as `5af524e`, then **amended** once D1 was reversed — the commit was unpushed and unreviewed, and leaving a commit that adds the contract to `contracts` followed by one that moves it out is churn, not reviewable history. The decision history survives here instead.
- 2026-09-22: T2. Tracker PR #215 opened, but only **after** S1 was merged: GitHub rejects a PR whose head has no commits of its own (`No commits between main and <feature branch>`). S1 merged into the Feature branch as `f7cd8bd`; `main` untouched at `ffa1876`. Merge verified by read-back, not assumed.
- 2026-09-22: `pnpm run verify` **EXIT=0** on the S1 tree: 7 workspaces green (contracts 8 test files, ai 1, api 21, web 65), `boundaries` clean over 282 modules, `test:boundaries` 25/25 including the new `web-never-imports-ai` rule. The single lint warning is pre-existing in `apps/web`. CI on PR #214 agreed: all four checks SUCCESS.
- 2026-09-22: Docker build order proven load-bearing, not assumed: with `packages/contracts/dist` removed, `pnpm --filter @vaqcrow/ai build` fails with `TS2307: Cannot find module '@vaqcrow/contracts'`; after building contracts it compiles. This is why the Dockerfile builds `ai` after `contracts`.
- 2026-09-22: T3. 42 tests pass (36 golden + 6 from T1). The golden suite was then **mutation-tested** to prove it is not passing vacuously — each mutation was applied to `src/ai-assessment.ts`, observed, and reverted with the diff confirmed empty:

  | Mutation | Effect on the suite |
  |---|---|
  | `strictObject` → `object` (unknown fields become legal) | **10 failed** / 32 passed |
  | `evidenceRefs` `.min(1)` dropped (uncited claims become legal) | **2 failed** / 40 passed |
  | action set widened to include `"approved"` | **2 failed** / 40 passed |
  | none (baseline) | 42 passed |

## Next step
T4 (#67) on branch `Vaqcrow#67_Task_Document_evidence_for_AI_assessment_schema_and_guardrails`, stacked on the Feature branch.

## Advisories (non-blocking, must be carried forward)
- **Docker image NOT rebuilt after the Dockerfile change.** The `docker` CLI/daemon is unavailable in this environment, so the image build is unverified. The Dockerfile change is mechanical (one workspace member following the `packages/domain` pattern) and its only load-bearing property — build order — was verified directly, but the image itself must be rebuilt before trusting the deploy path. Do not claim the image builds.
- **Boundary fixture tests depend on built `dist/`.** `tests/boundaries.test.ts` resolves `@vaqcrow/*` through each package's `package.json` → `dist/`, so removing a package's `dist` makes its rule silently not fire. In `pnpm run verify` this is safe because `build` runs before `test:boundaries`; running `test:boundaries` alone on a clean tree will fail. Observed, not inferred.
- **Root devDependency is requirement, not preference.** The fixture resolves `@vaqcrow/ai` only because it is a root devDependency, the same design decision #39 made for `contracts` and `domain`.
