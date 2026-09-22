# Production LLM provider adapter (issue #226)

## Objective
Implement the adapter that consumes the typed LLM configuration, calls the selected model, and makes the AI assessment path real instead of simulated. This closes the gap that Feature #21's evidence document and #223's iteration log both named as the next step and that was never tracked as an issue until now.

## Constraints
- Node 24 required: prefix commands with `PATH="/opt/homebrew/opt/node@24/bin:$PATH"`.
- Artifacts/code/tests/docs in English. Conventional commits, no AI attribution.
- No vendor SDK: the provider's API is JSON over HTTP.
- Pull-request checks never reach a live provider: the transport is injected.
- The live check is credential-gated and excluded from `pnpm run test` and `pnpm run verify`.
- No real credential is committed; `.env.local` is gitignored and stays local.

## Decisions
- **D1 — The adapter lives in `packages/ai` and receives the configuration as arguments.** A package may not import an application, so the configuration cannot be fetched from `apps/api`; `apps/api` constructs the adapter from its already-validated config. The dependency direction stays `apps/api → packages/ai`.
- **D2 — The adapter is a pure transport.** It sends the request and hands back the model's answer as **untrusted raw output** plus its provenance. It does not validate the assessment — that belongs on the caller's side of the port — and it invents no error vocabulary: the four codes it can produce are the ones the port already declares.
- **D3 — The credential is a plain string here, unwrapped at the point of use.** This package cannot know the application's `Secret` type, so `apps/api` calls `reveal()` at construction and nowhere else. The adapter never logs it and never returns it.
- **D4 — Text→JSON normalization belongs to the orchestration, not the adapter.** A chat provider answers with **text**; the contract describes an object. `runAssessment` now parses a string output before validating it, and passes an unparseable string through so the contract rejects it as `invalid_output`. An adapter that "helpfully" parsed would be an adapter that decided what a valid answer looks like.
- **D5 — Markdown fences are deliberately NOT stripped.** The prompt asks for one JSON object and nothing else; an answer wrapped in a fence is not that, and forgiving it here would hide a prompt or model regression behind leniency. Covered by a test.
- **D6 — The prompt is versioned in the package.** `ASSESSMENT_PROMPT_VERSION` travels in the retained metadata because `DEMO.md` §5 requires a recommendation to show its model and prompt. The text is the one the bake-off measured; changing it invalidates those measurements.
- **D7 — The bake-off now runs the production path.** It calls the same adapter, the same prompt and the same validation, varying only the model. Measuring and live-verifying became the same act, and the duplication of a second inline prompt is gone.

## Tasks
- [x] T1 The adapter, the versioned prompt, and 13 deterministic tests with an injected transport. RED observed (12 failing) → GREEN.
- [x] T2 Consolidate the bake-off onto the production path.
- [x] T3 Live verification against the real provider.

## Progress / evidence
- 2026-09-22: T1. New files `packages/ai/src/assessment-prompt.ts` and `packages/ai/src/opencode-go-provider.ts`. `pnpm run verify` **EXIT=0**: `@vaqcrow/ai` 5 test files (105 tests), contracts 8, api 22, web 65, domain 1; `boundaries` clean over 294 modules / 795 dependencies.
- 2026-09-22: **A previously-merged test expectation was wrong, and this Task revealed it.** The #69 contract matrix classified "the response as a JSON string" as `invalid_output`. That was only tenable while no real provider existed: a JSON string is exactly what a chat provider returns, so the case was mis-classified, not merely inconvenient. It was replaced with a genuinely malformed case (a string that is not JSON), and a new normalization suite asserts the accepted shape, the fence rejection, and that a JSON text answer still faces the evidence guardrail. The matrix did not shrink: 39 tests became 42.
- 2026-09-22: `pnpm run verify` **EXIT=0** on the final tree, numbers above.

### Live verification (2026-09-22, real subscription)

The production path — `createOpenCodeGoProvider` → `runAssessment` — was run against the real endpoint for three models. **All three returned an admissible assessment with zero invented references**, which is the strongest available proof that the adapter, the prompt, the contract and the evidence guardrail work together:

| Model | Outcome | Invented refs | Latency | Result |
|---|---|---|---|---|
| glm-5.3-flash | valid | false | 21,566 ms | medium / 0.72 |
| mimo-v2.6-flash | valid | false | 18,679 ms | medium / 0.55 |
| deepseek-v4-flash | valid | false | 59,437 ms | high / 0.6 |

## Advisories (non-blocking, must be carried forward)
- **LATENCY IS NOT STABLE, AND THIS CORRECTS THE MODEL RECOMMENDATION.** The same model and the same prompt measured **5.6 s** on the first bake-off and **21.6 s** here for `glm-5.3-flash` — a factor of four. The ranking is not stable either: `mimo-v2.6-flash` was fastest in this run, `glm-5.3-flash` in the previous one. Two samples are not a selection basis. **The configured 15 s timeout is too tight and will fail intermittently**, and a timeout degrades to human review rather than to an answer. Before the demo: raise `LLM_TIMEOUT_MS`, take several samples per model, and warm the model — or stop depending on a live call for the demo segment.
- **The adapter has been verified live once**, not continuously. Its deterministic tests are the regression net; the live path is manual by design.
- **The prompt has no automatic change detection.** Bumping `ASSESSMENT_PROMPT_VERSION` when the text changes is a human obligation, and forgetting it makes the retained provenance a lie.
- **`apps/api` still does not construct the adapter.** Nothing calls a model from the application yet: this Task delivers the adapter and proves it works, not its wiring into a use case or an endpoint. That wiring is the next unit.
- **Go is scoped to coding-agent traffic and is monitored for abuse.** Our workload is a financial risk assessment; whether Go or Zen is the right subscription remains unresolved.
