# Design: Correlation ID Contract and HTTP Propagation

## Technical Approach

Add one Zod-backed, cross-runtime correlation-ID module to `@vaqcrow/contracts`. `buildApp()` validates Web Crypto before giving Fastify the generator. Fastify always generates `request.id`; an `onRequest` hook copies it to `x-correlation-id` before routes, errors, or 404 handling complete. No inbound identity policy is introduced.

## Architecture Decisions

| Decision | Alternatives / tradeoff | Choice and rationale |
|---|---|---|
| Contract | Plain string or handwritten brand | `z.uuidv4().brand<"CorrelationId">()` is the Zod 4 runtime/static source of truth. |
| Generator startup invariant | Per-request checks, static `node:crypto`, weak fallback | `buildApp()` checks `globalThis.crypto.randomUUID` before constructing Fastify and throws synchronously if absent. Then `generateCorrelationId` becomes `genReqId`; the callback has no unavailable-runtime branch and is non-throwing under the platform contract. |
| HTTP ownership | `requestIdHeader` or route-specific logic | Set `requestIdHeader: false`, provide `genReqId`, and register one global `onRequest` hook before routes. Caller input is therefore ignored rather than trusted. |
| Portability evidence | Import inspection or a sample app | Add a tiny fixture under `tests/fixtures/boundaries/apps/web/` importing correlation runtime exports from `@vaqcrow/contracts`. Compile it in the boundary harness with DOM libs, bundler resolution, and `types: []`; zero diagnostics proves the barrel needs no Node types or modules. |
| Delivery | Adjacent contracts/telemetry | Keep #38 schemas and #98 observability/resilience as non-goals. Stay below 400 authored changed lines; generated lockfile churn is excluded. |

## Data Flow

```text
buildApp -> validate globalThis.crypto.randomUUID -> construct Fastify
request (inbound header ignored)
  -> Fastify genReqId -> generateCorrelationId() -> request.id
  -> global onRequest -> reply.header("x-correlation-id", request.id)
  -> route/error/404 -> response with the same ID
```

## Interfaces / Contracts

`packages/contracts/src/correlation-id.ts` exposes:

```ts
export const correlationIdSchema = z.uuidv4().brand<"CorrelationId">();
export type CorrelationId = z.infer<typeof correlationIdSchema>;
export function parseCorrelationId(input: unknown): CorrelationId;
export function generateCorrelationId(): CorrelationId;
```

The module imports `{ z }` from `"zod"`. `src/index.ts` re-exports runtime names and uses `export type { CorrelationId } from "./correlation-id.js"`; all relative ESM imports retain `.js` for NodeNext. The API imports `generateCorrelationId` from `"@vaqcrow/contracts"`.

`parseCorrelationId` returns branded output or throws Zod's native `ZodError`; only acceptance/rejection is stable. `generateCorrelationId` parses the platform UUID. A local `buildApp()` assertion rejects missing `randomUUID` before Fastify accepts requests; no fallback or stable diagnostic is promised. `genReqId` relies on that invariant and has no deliberate throw path.

## File Changes

| File | Action | Description |
|---|---|---|
| `packages/contracts/src/correlation-id.ts` | Create | Schema, brand, parser, and global Web Crypto generator. |
| `packages/contracts/src/correlation-id.test.ts` | Create | Public-barrel runtime and compile-time contract tests. |
| `packages/contracts/src/index.ts` | Modify | NodeNext-safe public exports. |
| `packages/contracts/package.json` | Modify | Add `zod: "catalog:"` under `dependencies`. |
| `apps/api/src/infrastructure/http/build-app.ts` | Modify | Configure `genReqId`, disable inbound request IDs, and add the header hook before routes. |
| `apps/api/src/infrastructure/http/build-app.test.ts` | Modify | Verify startup validation, exact ID/header propagation, inbound-header non-reuse, and headers on 404/error responses. |
| `.dependency-cruiser.cjs`, `tests/boundaries.test.ts` | Modify | Prove focused contracts rules and compile the web consumer fixture with the TypeScript API. |
| `tests/fixtures/boundaries/packages/contracts/src/*.fixture.ts` | Create | Node-core and Fastify negative fixtures. |
| `tests/fixtures/boundaries/apps/web/runtime-contracts.consumer.ts` | Create | Import and use correlation runtime exports from the public package barrel. |
| `tests/fixtures/boundaries/apps/web/tsconfig.json` | Create | Isolated DOM/bundler compile config with no Node ambient types. |
| `pnpm-workspace.yaml`, `pnpm-lock.yaml` | Modify | Catalog `zod: ^4.6.5`; update contracts importer and lock resolution via `pnpm install`. |

## Testing Strategy

**RED:** First test valid v4 parsing, malformed/non-string/non-v4 rejection, 1,000 valid distinct generated values, barrel exports, and raw-string type rejection. Prove `buildApp()` rejects missing `randomUUID` before app creation. With Fastify injection prove: (1) a test route returns `request.id` equal to `x-correlation-id`; (2) a missing route returns 404 with a valid header; (3) a handler captures `request.id`, throws, and its 500 header equals the capture; (4) an inbound ID is not reused. Add failing negative boundary fixtures and the DOM-only consumer compile assertion.

**GREEN:** Add Zod/catalog metadata, the minimum contract implementation, barrel exports, Fastify options/hook, and boundary rules. **REFACTOR:** remove duplication only after focused tests pass; preserve names, hook order, and error semantics.

Verification: run contracts and API tests/typechecks, `pnpm run boundaries`, `pnpm run test:boundaries`, `pnpm run verify`, then `pnpm run install:verify` against the committed lockfile.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary changes; this only configures an existing Fastify request lifecycle.

## Migration / Rollout and Rollback

No data migration or feature flag is required. Deploy atomically with the lockfile. Roll back the Fastify wiring, contracts module/exports/tests, boundary rules/fixtures, Zod manifest/catalog entry, and lockfile changes together, then run full verification.

## Open Questions

None.
