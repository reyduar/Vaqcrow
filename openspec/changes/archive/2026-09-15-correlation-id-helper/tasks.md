# Tasks: Correlation ID Contract and HTTP Propagation

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 320–380 authored; lockfile churn excluded |
| 400-line budget risk | Medium |
| Chained PRs recommended | No — forecast fits one PR |
| Suggested split | Single PR; auto-chain Units 1 → 2 → 3 only above 400 authored lines |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Contracts API | PR 1 | `pnpm run test --filter=@vaqcrow/contracts` | Parser and 1,000-generation tests | Contracts module, exports, dependency metadata |
| 2 | Fastify propagation | PR 1 | `pnpm run test --filter=@vaqcrow/api` | Fastify `inject()` lifecycle scenarios | `build-app.ts` and tests |
| 3 | Portable boundaries | PR 1 | `pnpm run test:boundaries` | `pnpm exec tsc -p tests/fixtures/boundaries/apps/web/tsconfig.json --noEmit` | Rules, harness, fixtures |

## Phase 1: Work Unit 1 — Contracts (RED → GREEN → REFACTOR)

- [x] 1.1 **RED:** Create `packages/contracts/src/correlation-id.test.ts` for barrel exports, raw-string type rejection, v4 parsing, invalid inputs, and 1,000 valid distinct generations; run focused tests and typecheck.
- [x] 1.2 **GREEN:** Add Zod and lock resolution in `pnpm-workspace.yaml`, `packages/contracts/package.json`, and `pnpm-lock.yaml`; implement `packages/contracts/src/correlation-id.ts` and NodeNext exports in `packages/contracts/src/index.ts`.
- [x] 1.3 **REFACTOR:** Remove test/implementation duplication without changing names or Zod error semantics; rerun contracts tests and typecheck.

## Phase 2: Work Unit 2 — Fastify API (RED → GREEN → REFACTOR)

- [x] 2.1 **RED:** Extend `apps/api/src/infrastructure/http/build-app.test.ts` for missing `crypto.randomUUID`, request/header identity on success, 404 and 500, and caller-header non-reuse; run focused API tests.
- [x] 2.2 **GREEN:** Update `apps/api/src/infrastructure/http/build-app.ts` to validate Web Crypto before construction, set `requestIdHeader: false`, use `generateCorrelationId` as `genReqId`, and register the global header hook before routes.
- [x] 2.3 **REFACTOR:** Consolidate fixture setup while preserving synchronous startup failure and hook order; rerun API tests and typecheck.

## Phase 3: Work Unit 3 — Boundaries and Web Fixture (RED → GREEN → REFACTOR)

- [x] 3.1 **RED:** Add Node/Fastify negative fixtures under `tests/fixtures/boundaries/packages/contracts/src/`, plus `tests/fixtures/boundaries/apps/web/runtime-contracts.consumer.ts` and `tests/fixtures/boundaries/apps/web/tsconfig.json`; extend `tests/boundaries.test.ts` for violations and DOM/bundler compilation.
- [x] 3.2 **GREEN:** Add focused contracts boundary rules to `.dependency-cruiser.cjs`; run `pnpm run boundaries` and `pnpm run test:boundaries` until negative fixtures fail safely and the DOM consumer resolves the barrel.
- [x] 3.3 **REFACTOR:** Deduplicate boundary harness setup, confirm no #38 schemas or #98 observability behavior entered the diff, then rerun boundary and root tests.

## Phase 4: Integrated Evidence

- [x] 4.1 Run `pnpm run test`, `pnpm run typecheck`, `pnpm run boundaries`, and `pnpm run test:boundaries`; retain per-unit results.
- [x] 4.2 Run `pnpm run verify`, `pnpm run install:verify`, then final `pnpm run verify`; stay within 400 authored lines or use the planned auto-chain split.
