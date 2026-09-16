# Apply Progress: Correlation ID Contract and HTTP Propagation

## Mode

Strict TDD with Node 24.21.0 and pnpm 11.27.0.

## Completed Tasks

- [x] 1.1 Contracts RED tests
- [x] 1.2 Contracts GREEN implementation
- [x] 1.3 Contracts REFACTOR
- [x] 2.1 Fastify RED tests
- [x] 2.2 Fastify GREEN implementation
- [x] 2.3 Fastify REFACTOR
- [x] 3.1 Boundaries RED tests and fixtures
- [x] 3.2 Boundaries GREEN rules
- [x] 3.3 Boundaries REFACTOR and scope check
- [x] 4.1 Integrated tests, typechecks, and boundary evidence
- [x] 4.2 Final verification sequence

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | `packages/contracts/src/correlation-id.test.ts` | Unit and compile-time | 1/1 existing test passed; typecheck passed | 5/9 tests failed and typecheck rejected missing exports | Covered by task 1.2 | Valid parse, three invalid classes, and 1,000-value generation sample | Covered by task 1.3 |
| 1.2 | `packages/contracts/src/correlation-id.test.ts` | Unit and compile-time | 1/1 existing test passed; typecheck passed | Reused task 1.1 RED evidence | 9/9 tests passed; typecheck passed | All required contract paths passed | Covered by task 1.3 |
| 1.3 | `packages/contracts/src/correlation-id.test.ts` | Unit and compile-time | 9/9 tests passed; typecheck passed | N/A — behavior-preserving refactor | 7/7 tests passed after deduplication; typecheck passed | Required paths remained covered by 7 tests | Removed duplicate assertions; 7/7 tests passed |
| 2.1 | `apps/api/src/infrastructure/http/build-app.test.ts` | Integration | 4/4 existing API tests passed; typecheck passed | 5/8 focused tests failed on missing startup and propagation behavior | Covered by task 2.2 | Success, caller input, 404, and thrown-handler paths exercised | Covered by task 2.3 |
| 2.2 | `apps/api/src/infrastructure/http/build-app.test.ts` | Integration | 4/4 existing API tests passed; typecheck passed | Reused task 2.1 RED evidence | 8/8 focused tests passed; typecheck passed | Four lifecycle paths plus startup failure passed | Covered by task 2.3 |
| 2.3 | `apps/api/src/infrastructure/http/build-app.test.ts` | Integration | 8/8 focused tests passed; typecheck passed | N/A — behavior-preserving refactor | 8/8 focused tests passed after fixture cleanup; typecheck passed | All lifecycle paths remained covered | Centralized app cleanup; 8/8 focused tests passed |
| 3.1 | `tests/boundaries.test.ts` | Architecture and compile integration | 8/8 existing boundary tests passed; production cruise passed | 2/11 tests failed because contracts rules were absent; DOM-only barrel compilation passed | Covered by task 3.2 | Node-core, Fastify, and DOM-only consumer paths exercised | Covered by task 3.3 |
| 3.2 | `tests/boundaries.test.ts` | Architecture and compile integration | 8/8 existing boundary tests passed; production cruise passed | Reused task 3.1 RED evidence | Production cruise passed and 11/11 boundary tests passed | Both negative fixtures and portable consumer passed | Covered by task 3.3 |
| 3.3 | `tests/boundaries.test.ts` | Architecture and compile integration | 11/11 boundary tests passed | N/A — behavior-preserving refactor | Production cruise, 11/11 boundary tests, and 30/30 workspace tests passed | All boundary paths remained covered | Deduplicated violation assertions and diagnostic formatting; all tests passed |
| 4.1 | Workspace suites | Integration | Per-unit focused suites passed | N/A — evidence task | Workspace tests, typechecks, production cruise, and 11/11 boundary tests passed | Contracts, API, web, domain, and boundary paths passed | N/A — evidence task |
| 4.2 | Workspace verification | Integration | Prior commands 1–3 passed; focused contracts tests passed (2 files, 7 tests) and typecheck passed before remediation | Initial `pnpm run verify` failed because `correlation-id.test.ts:24:9` violated `no-constant-condition` | Replaced only the constant branch with `expectTypeOf`; contracts lint and the first full verification passed | Frozen-lockfile install and the final full verification passed | Static raw-string rejection remains explicit; no production behavior changed |

## Work Unit Evidence

| Work Unit | Focused test command and exact result | Runtime harness command/scenario and exact result | Rollback boundary |
|---|---|---|---|
| Contracts API | `pnpm --filter @vaqcrow/contracts test` and `pnpm --filter @vaqcrow/contracts typecheck`: 2 files, 7 tests passed; typecheck passed | Same focused test: parser rejection and 1,000 generated UUID v4 values passed | Revert `packages/contracts/src/correlation-id.ts`, its test and barrel exports, Zod manifest/catalog/lock entries, and the pnpm 11 build-permission migration |
| Fastify propagation | `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/http/build-app.test.ts` and `pnpm --filter @vaqcrow/api typecheck`: 1 file, 8 tests passed; typecheck passed | Fastify `inject()` covered success, caller header, 404, and thrown-handler responses; all 8 tests passed | Revert `apps/api/src/infrastructure/http/build-app.ts` and its test changes |
| Portable boundaries | `pnpm run boundaries && pnpm run test:boundaries`: production cruise passed; 1 file and 11 tests passed | TypeScript API compiled the DOM/bundler fixture with `types: []`; zero diagnostics | Revert `.dependency-cruiser.cjs`, `tests/boundaries.test.ts`, and the new boundary fixtures |
| Integrated evidence | `pnpm run test && pnpm run typecheck && pnpm run boundaries && pnpm run test:boundaries`: all commands passed; 30 workspace tests and 11 boundary tests passed | Fastify injection, UUID generation/parsing, dependency cruising, and DOM-only compilation all passed | Revert all files listed by the three work-unit boundaries together |
| Lint remediation and final verification | `pnpm --filter @vaqcrow/contracts lint`: passed; both `pnpm run verify` executions passed; `pnpm run install:verify` passed | Both full verification runs exercised the workspace suites, including 9 API tests and 11 boundary tests; no runtime attempt was acquired or settled in this rescope | Revert only the `expectTypeOf` replacement in `packages/contracts/src/correlation-id.test.ts` to restore the pre-remediation test pattern |

## Required Verification

| Command | Observed result |
|---|---|
| `source "$HOME/.nvm/nvm.sh" && nvm use 24.21.0 >/dev/null && pnpm --filter @vaqcrow/contracts test` | Passed: 2 files, 7 tests |
| `source "$HOME/.nvm/nvm.sh" && nvm use 24.21.0 >/dev/null && pnpm --filter @vaqcrow/api test` | Passed: 2 files, 9 tests |
| `source "$HOME/.nvm/nvm.sh" && nvm use 24.21.0 >/dev/null && pnpm run test:boundaries` | Passed: 1 file, 11 tests |
| `source "$HOME/.nvm/nvm.sh" && nvm use 24.21.0 >/dev/null && pnpm run verify` | Failed during contracts lint: `correlation-id.test.ts:24:9` violates `no-constant-condition` |
| `source "$HOME/.nvm/nvm.sh" && nvm use 24.21.0 >/dev/null && pnpm run install:verify` | Not run after required-command failure |
| `source "$HOME/.nvm/nvm.sh" && nvm use 24.21.0 >/dev/null && pnpm run verify` | Not run after required-command failure |

### Authorized Rescope Verification: `lint-fix-and-final-verification`

| Command | Observed result |
|---|---|
| `source "$HOME/.nvm/nvm.sh" && nvm use 24.21.0 >/dev/null && pnpm --filter @vaqcrow/contracts lint` | Passed: ESLint completed with zero errors or warnings for `@vaqcrow/contracts` |
| `source "$HOME/.nvm/nvm.sh" && nvm use 24.21.0 >/dev/null && pnpm run verify` | Passed: 4/4 lint tasks, 6/6 typecheck tasks, 30 workspace tests, 4/4 build tasks, dependency cruise, and 11 boundary tests |
| `source "$HOME/.nvm/nvm.sh" && nvm use 24.21.0 >/dev/null && pnpm run install:verify` | Passed: frozen-lockfile install reported all 5 workspace projects already up to date |
| `source "$HOME/.nvm/nvm.sh" && nvm use 24.21.0 >/dev/null && pnpm run verify` | Passed: final cached verification completed all lint, typecheck, test, build, dependency-cruise, and 11 boundary-test stages |

## Workload

Implementation authored change is 270 lines excluding generated lockfile churn and OpenSpec progress artifacts, below the 400-line single-PR budget (`270/400`).

The authorized lint remediation removed three lines from the test file, reducing the final authored total from 273 to 270 lines. The separately reported `367/400` value was the runtime ledger's cumulative counter across apply attempts, not the final authored diff size; the final authored budget is `270/400`.

## Status

Success: 11/11 tasks complete. The authorized lint remediation preserved static raw-string rejection, and the complete required verification sequence passed.

## Deviations

The pnpm 11 build-script policy required migrating the existing `ignoredBuiltDependencies` entry to `allowBuilds.unrs-resolver: false`; this is within the planned workspace metadata file and is required for installation commands to run.
