# LLM provider configuration and model selection (issue #223)

## Objective
Close the gap Feature #21 declared about itself: its acceptance criterion "call the **selected** model through a replaceable adapter" was marked PASS **with the caveat that no model had been selected**, because choosing provider/model is a P0 demo-prep item (`docs/planning/DEMO.md` line 412). This unit declares the provider in the typed configuration contract and selects the model from measurement rather than reputation.

## Constraints
- Node 24 required: prefix commands with `PATH="/opt/homebrew/opt/node@24/bin:$PATH"`.
- Artifacts/code/tests/docs in English. Conventional commits, no AI attribution.
- Provider-independent by design: no vendor SDK is installed, because the provider's API is JSON over HTTP.
- The bake-off is a live check and is excluded from `pnpm run test` and `pnpm run verify`.
- No real credential is committed; `.env.local` is gitignored and stays local.

## Decisions
- **D1 — The provider is a closed set of one.** `LLM_PROVIDER` accepts only `opencode-go`, rejected by construction rather than by convention, the same reasoning as `STELLAR_NETWORK`. Adding a provider is a deliberate code change, not a configuration.
- **D2 — The model is required with no default.** Which model underwrites a loan application is a decision; a silent fallback would hide it. The `opencode-go/<id>` prefix gets its own error message because it is the single most likely mistake — that form belongs to OpenCode's own config, while the API wants the bare id.
- **D3 — Only the OpenAI-compatible `/v1/chat/completions` dialect is modelled.** The provider also serves MiniMax and Qwen on an Anthropic-native `/v1/messages` endpoint. Modelling both would double the code path for no demo benefit, so the selected models must come from the chat-completions group.
- **D4 — `x-opencode-session` and a custom `user-agent` are mandatory.** Not a nicety: without the session header the endpoint returns `400 MissingSessionID`. The provider's documentation asks every client to identify itself rather than arrive as a generic SDK, and traffic is monitored.
- **D5 — Model selected: `glm-5.3-flash`.** Fastest of the seven measured (5.6 s against 39.5 s for `deepseek-v4-pro`), cheapest price tier, most generous monthly limit. The original choice, `deepseek-v4-pro`, is **retracted**: it was proposed before any measurement and the data contradicts it.

## Tasks
- [x] T1 The typed LLM configuration slice, its accept/reject/fallback matrix, and `.env.example`.
- [x] T2 The credential-gated bake-off harness, and the lint gap it exposed.
- [x] T3 Run the bake-off against the live endpoint and select the model from the results.

## Progress / evidence
- 2026-09-22: T1 and T2 delivered as PR [#224](https://github.com/reyduar/Vaqcrow/pull/224) (commits `a64e8d1`, `5ab4ae6`). `pnpm run verify` **EXIT=0**: `@vaqcrow/api` 22 test files (164 tests in the config directory), contracts 8, ai 4, web 65, domain 1; `boundaries` clean over 291 modules / 785 dependencies.
- 2026-09-22: The lint config had a real gap — Node globals were declared only for `**/*.{ts,tsx}`, so any `.mjs` entry point reported `process`, `console`, `fetch` and `AbortSignal` as undefined. Closed.
- 2026-09-22: Two of my own test expectations were wrong and the suite caught them: the missing-key list (seven now, not four) and a blank model being asserted as `invalid` when the contract correctly reports `missing`.
- 2026-09-22: `8951902` added the mandatory `x-opencode-session` header and a custom user agent to the bake-off.

### Live verification (2026-09-22, real subscription)

Authentication was verified independently of the harness: `GET /v1/models` → **HTTP 200** in 0.8 s. A minimal `chat/completions` probe **without** the session header returned `400 {"type":"MissingSessionID"}`; the identical probe **with** it returned `200` in 2.2 s.

Bake-off results — one sample per model, one fixed prompt, the 8-period synthetic series. Every model returned schema-valid JSON with **zero invented references**:

| Model | Schema | Invented refs | Latency | Tokens |
|---|---|---|---|---|
| **glm-5.3-flash** | valid | 0 | **5,603 ms** | 1,177 |
| mimo-v2.6-flash | valid | 0 | 11,674 ms | 1,642 |
| deepseek-v4-flash | valid | 0 | 17,301 ms | 4,507 |
| longcat-2.0 | valid | 0 | 31,139 ms | 3,095 |
| deepseek-v4-pro | valid | 0 | 39,508 ms | 4,095 |
| kimi-k3 | valid | 0 | 47,285 ms | 2,280 |
| glm-5.3 | valid | 0 | 47,726 ms | 4,728 |

That all seven are admissible is the strongest possible result for the contract and the evidence guardrail: admissibility does not discriminate, so the choice reduces to latency and cost, which is what it should be.

The first bake-off run used the configuration default of 15 s and **all three candidates timed out**. That is not a harness bug: these are reasoning models and the `pro` tier is simply slow on this task. It did establish that the 15 s default is too short for the `pro` tier — and that a cold first request can be far slower than a warm one.

## Next step
The production provider adapter: it consumes this configuration, sends the two mandatory headers, and must not treat an empty `content` as a valid answer.

## Advisories (non-blocking, must be carried forward)
- **Reasoning models return `reasoning_content` alongside `content`, and reasoning tokens are billed.** With a low `max_tokens` the `content` comes back **empty** with `finish_reason: "length"`. The production adapter must not treat an empty content as a valid assessment; it is a malformed output.
- **Warm the model before a live demo.** Latency was measured once per model with no cold/warm control. A first request in cold state can be a multiple of the warm figure, and a timeout degrades to human review rather than to an answer.
- **The provider's documentation is mid-migration to v2 and contradicts itself** — the model list and even DeepSeek V4 Pro's limits differ between `/docs/go/` and `/v2/docs/console/go`. The live `/v1/models` endpoint remains the source of truth; never hardcode the list.
- **Go is scoped to coding-agent traffic and is monitored for abuse** ("Send typical coding agent traffic"). Our workload is a financial risk assessment. **Zen** (pay-as-you-go) is the provider's general product; whether Go is the right subscription for this path is unresolved and worth confirming before the demo depends on it.
- **The deploy service must carry the three keys before this merges**, or the API will not start. Verified state: project `vaqcrow-api`, service `api`, environment `production`, 7 variables and none of them LLM.
