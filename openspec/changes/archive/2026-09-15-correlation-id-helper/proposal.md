# Proposal: Correlation ID Contract and HTTP Propagation (#116)

## Intent

Define one opaque, runtime-validatable correlation identifier in `packages/contracts` and adopt it at the Fastify boundary so each response exposes its server-generated request ID, without absorbing broader schema or observability work.

## Scope

### In Scope
- Declare Zod 4 as a direct contracts runtime dependency reusable by #38.
- Export a branded UUID-v4 schema, type, parser, and generator.
- Configure Fastify `genReqId` with that generator and return `request.id` as `x-correlation-id`.
- Prove generation, validation, rejection, and HTTP propagation through strict test-first development.

### Out of Scope
- Domain states, event/API/adapter schemas owned by #38.
- Tracing, telemetry, resilience, or observability owned by #98.
- Caller-supplied IDs, inbound trust policy, or related HTTP errors.
- Stabilizing Zod error details as a project-owned public contract.

## Capabilities

### New Capabilities
- `correlation-id`: Covers creation, validation, opaque typing, and API response propagation.

### Modified Capabilities
None.

## Approach

- Define the contract in a dedicated module.
- Keep the contracts barrel portable: do not expose a static `node:crypto` import path to web consumers.
- Keep Fastify integration in `apps/api/src/infrastructure/http/build-app.ts`; do not enable `requestIdHeader`.
- Use RED-GREEN-REFACTOR tests before implementation. This proposal does not authorize apply.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/contracts` | Modified | Add Zod, the contract, exports, and tests. |
| `apps/api/src/infrastructure/http` | Modified | Generate request IDs and propagate the response header. |
| `pnpm-workspace.yaml`, `pnpm-lock.yaml` | Modified | Catalog and lock the direct Zod 4 dependency. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Caller controls request identity | Low | Generate server-side; leave `requestIdHeader` disabled. |
| Node-only import breaks web consumers | Medium | Preserve a cross-runtime barrel and test package consumers/builds. |
| Zod behavior becomes accidental API | Medium | Guarantee parser success/rejection only, not error internals. |
| Scope expands into #38 or #98 | Low | Enforce the explicit non-goals above. |

## Rollback Plan

Remove Fastify wiring, correlation-ID exports/tests, and Zod/catalog entries together; restore the lockfile and verify the repository.

## Dependencies

- Issue #110 Fastify scaffold is complete.
- Zod 4 becomes the coordinated validator choice for subsequent #38 work.

## Success Criteria / Acceptance Mapping

| Issue #116 criterion | Evidence required |
|----------------------|-------------------|
| Type and generator exported | Contracts public-API and generation tests pass. |
| Schema/parser rejects malformed input | Valid and invalid parser tests pass. |
| API threads one request ID without framework leakage | Fastify injection proves `request.id` equals `x-correlation-id`; boundary checks pass. |
| Unit coverage for required behavior | Strict-TDD tests and repository verification pass. |
