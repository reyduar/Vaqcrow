# Cover the root `tests/` directory with lint and typecheck (issue #189)

## Objective

Close the static-analysis gap recorded as an accepted limitation by Feature #15. The root `tests/`
directory was executed by `pnpm run test:boundaries` on every pull request, but never reached by
`pnpm run lint` or `pnpm run typecheck`: both are `turbo run <task>`, which only walks pnpm workspaces
(`apps/*`, `packages/*`). A lint or type error introduced in a root test file could therefore pass
the documented gate.

## Why

The gate exists so an error cannot hide. The files under `tests/` verify the repository's own gates
and dependency boundaries — they are precisely the files whose silent breakage would be least
visible. Issue #189 tracks fixing the gap instead of continuing to carry it as a limitation.

## Scope

- In scope: the 7 root test files under `tests/`.
- Deliberately out of scope: `tests/fixtures/boundaries/**` (see Decisions).
- Out of scope: workspace configuration. No `apps/*/tsconfig.json` or `packages/*/tsconfig.json` was
  changed, and the new file is deliberately **not** named `tsconfig.json`.

Numbers were measured on the branch base, not taken from the issue, which was written at an older
commit: the issue said 26 `.ts` files (4 tests, 22 fixtures); the tree holds **35** `.ts` files —
7 tests plus 28 fixtures/stubs. One further issue claim did not survive measurement: `npx eslint
tests/` linted **31 files, 0 errors, 0 warnings** before this change (the fixtures were already being
linted, because ESLint's default config ignores only `node_modules`). The exclusion below is a
deliberate decision, not a pre-existing state.

## Decisions

1. **`tsconfig.tests.json`, never `tsconfig.json`.** A root `tsconfig.json` is what Vite, esbuild and
   editors auto-discover as *the* project for files outside `tests/`. The `.tests.` name keeps the new
   project scoped and inert for every other tool.
2. **`module: "ESNext"` + `moduleResolution: "Bundler"`, not the base `NodeNext`.** The root tests run
   under Vitest/Vite, whose resolution is bundler-style and accepts the extensionless relative imports
   the files already use (`../apps/web/e2e/support/local-hosts`). `NodeNext` demands a `.js`
   extension — i.e. rewriting the test files, which the task forbids. `apps/web/tsconfig.json` already
   uses exactly this pair, so it mirrors the consumer that owns those files.
3. **`allowJs: true`.** `tests/boundaries.test.ts` imports `../.dependency-cruiser.cjs`, and without
   `allowJs` TypeScript reports `TS7016: Could not find a declaration file`. With it, TypeScript reads
   the file's `/** @type {import('dependency-cruiser').IConfiguration} */` annotation and types
   `config` for real — which is how the genuine `TS2375` below surfaced. Nothing is loosened: `strict`,
   `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` all remain on.
4. **`tests/fixtures/boundaries/**` is excluded from both gates.** The fixtures are invalid by design:
   each one imports exactly what the rule it verifies forbids, and the provider stubs only resolve
   inside a faked `node_modules`. A gate that judged them would be judging the fixture's intent, not a
   defect, so a future rule change would break the gate for no real reason.
5. **The exclusion is declarative, and proven.** The tsconfig carries `exclude`; ESLint carries a
   global `ignores` entry (a config entry, not a CLI `--ignore-pattern`); and
   `tests/testing-and-ci-gates.test.ts` asserts the scripts, their presence in `verify`, the tsconfig
   `include`/`exclude` and the ESLint ignore. It is load-bearing, not cosmetic: dropping `exclude`
   produces **14 errors** from the fixtures (observed below).

The new `tsconfig.tests.json`:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowJs": true
  },
  "include": ["tests/**/*.ts"],
  "exclude": ["tests/fixtures/boundaries/**"]
}
```

## Tasks

- [x] T1 `tsconfig.tests.json` with the smallest option set that typechecks the 7 test files
- [x] T2 ESLint global `ignores` entry for `tests/fixtures/boundaries/**`, rationale inline
- [x] T3 Root scripts `lint:tests` / `typecheck:tests`, both added to `verify`
- [x] T4 Meta-test asserting the coverage and the exclusion (both gates)
- [x] T5 Evidence document: the limitation replaced with its resolution
- [x] T6 RED-A / RED-B probes, negative case, exclusion proof, full `pnpm run verify`

## Real type error the gate surfaced

The first `pnpm run typecheck:tests` run failed — on `tests/boundaries.test.ts`, not on the fixtures:

```text
tests/boundaries.test.ts(45,7): error TS2375: Type '{ forbidden: IForbiddenRuleType[] | undefined; }' is not assignable to type 'IFlattenedRuleSet' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of the target's properties.
  Types of property 'forbidden' are incompatible.
    Type 'IForbiddenRuleType[] | undefined' is not assignable to type 'IForbiddenRuleType[]'.
      Type 'undefined' is not assignable to type 'IForbiddenRuleType[]'.
```

`IConfiguration.forbidden` is optional, so `config.forbidden` is `IForbiddenRuleType[] | undefined`;
under `exactOptionalPropertyTypes: true` an explicit `undefined` cannot be assigned to the optional
`ruleSet.forbidden`. Real, if latent: if `forbidden` were ever removed from `.dependency-cruiser.cjs`,
the cruise would run with no rules and the boundary assertions would pass vacuously.

Fixed at the minimum the config requires — the 3 call sites now read `config.forbidden ?? []`. No
restructuring and no strictness flag weakened.

## RED / GREEN evidence

**RED-A — type error inside a root test file.**
Probe: `const RED_PROBE_TYPE_ERROR: number = "not a number";` appended to
`tests/trust-disclosures-canonical-consistency.test.ts`.

```text
$ pnpm run typecheck:tests
$ tsc -p tsconfig.tests.json --noEmit
tests/trust-disclosures-canonical-consistency.test.ts(81,7): error TS2322: Type 'string' is not assignable to type 'number'.
[ELIFECYCLE] Command failed with exit code 2.
```

**RED-B — lint error inside a root test file.**
Probe: `const RED_PROBE_LINT_ERROR = "unused";` in the same file.

```text
$ pnpm run lint:tests
$ eslint tests/

/Users/arielduarte/Workspaces/Vaqcrow/tests/trust-disclosures-canonical-consistency.test.ts
  81:7  error  'RED_PROBE_LINT_ERROR' is assigned a value but never used  @typescript-eslint/no-unused-vars

✖ 1 problem (1 error, 0 warnings)

[ELIFECYCLE] Command failed with exit code 1.
```

**Negative case and the exclusion proof.** With both probes removed, the fixtures present and the
exclusion in place, both commands pass. To show the exclusion is what makes that true — rather than
assuming it — `exclude` was removed temporarily:

```text
$ (exclude dropped from tsconfig.tests.json) npx tsc -p tsconfig.tests.json --noEmit
tests/fixtures/boundaries/apps/api/src/application/imports-fastify.fixture.ts(1,21): error TS2307: Cannot find module 'fastify' or its corresponding type declarations.
... 14 errors total: 11 × TS2307 (the faked provider modules) + 3 × TS2584 (`document`, DOM lib absent in the web fixture)
exit 2
```

With `exclude` restored: `lint:tests` exit 0 and `typecheck:tests` exit 0. Every probe was removed
afterwards and the tree contains no leftovers (`grep -rn 'RED_PROBE' tests/` returns nothing).

**GREEN — the full documented gate.**

```text
$ pnpm run verify
...
 Tasks:    8 successful, 8 total
✔ no dependency violations found (438 modules, 1293 dependencies cruised)
 Test Files  7 passed (7)
      Tests  84 passed (84)
VERIFY_EXIT=0
```

`verify` now runs, in order: `lint`, `typecheck`, `lint:tests`, `typecheck:tests`, `test`, `build`,
`boundaries`, `test:boundaries`. The root suite is 84 tests (was 83; the new meta-test adds one).

## Verification results

| Command | Observed result |
|---|---|
| `pnpm run lint:tests` | exit 0 — 7 files linted, 0 errors, 0 warnings |
| `pnpm run typecheck:tests` | exit 0 |
| `pnpm run verify` | exit 0 — full chain, root suite 7 files / 84 tests |
| RED-A (`pnpm run typecheck:tests` with a type error) | exit 2, `TS2322` at the probe |
| RED-B (`pnpm run lint:tests` with an unused const) | exit 1, `@typescript-eslint/no-unused-vars` at the probe |
| Exclusion dropped from `tsconfig.tests.json` | exit 2, 14 errors from `tests/fixtures/boundaries/**` |

## Files

- `tsconfig.tests.json` — new; the root test project (see Decisions 1–3).
- `package.json` — `lint:tests`, `typecheck:tests`, and `verify` now chains both.
- `eslint.config.mjs` — new global `ignores` entry for `tests/fixtures/boundaries/**`.
- `tests/boundaries.test.ts` — `config.forbidden ?? []` at the 3 `ruleSet` call sites (real `TS2375`).
- `tests/testing-and-ci-gates.test.ts` — one meta-test over the scripts, `verify`, the tsconfig
  `include`/`exclude` and the ESLint ignore.
- `tests/config-secret-boundaries.test.ts`, `tests/stellar-non-custody.test.ts`,
  `tests/web-holds-no-network-passphrase.test.ts`,
  `tests/trust-disclosures-canonical-consistency.test.ts` — docstring notes updated (see Deviations).
- `docs/planning/deterministic-testing-and-ci-gates-evidence.md` — §5 bullet replaced with the
  resolution; §9 item 5 re-stated as the deliberate fixture exclusion.

## Deviations from the implementation spec

1. **§9 of the evidence document was also updated.** The spec named only the §5 bullet, but §9
   ("Riesgos y limitaciones aceptadas") item 5 stated the same limitation; leaving it would have
   contradicted the new §5 and the issue's Definition of Done, which asks for the limitation to be
   removed from the standing-limitations list. It now documents the residual deliberate exclusion.
2. **Four test-file docstring notes were updated.** `config-secret-boundaries.test.ts`,
   `web-holds-no-network-passphrase.test.ts`, `stellar-non-custody.test.ts` and
   `trust-disclosures-canonical-consistency.test.ts` each claimed "there is no root tsconfig ... this
   file gets no static analysis". This change makes that false. Comments only, no behavior; the same
   false claim the spec asked to remove from the evidence document.
3. **The meta-test also asserts the ESLint `ignores` entry.** The spec asked for the tsconfig
   `exclude` assertion; acceptance criterion 3 requires the exclusion from *both* gates, so the
   `eslint.config.mjs` text is asserted too. One added line, no existing assertion weakened.

## Delivery

Pending — the orchestrator commits this branch
(`Vaqcrow#189_Task_Cover_the_root_tests_directory_with_lint_and_typecheck`).
