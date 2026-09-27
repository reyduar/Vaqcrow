# Shared UI primitives from the Claude Design system

Iteration log for issue #306, branch
`Vaqcrow#306_Task_Build_the_shared_UI_primitives_from_the_Claude_Design_system_with_Storybook_stories`.

## Objective

Turn the loose HeroUI usage in `apps/web` into shared, themed primitives that match the component
catalog of the Claude Design template (`docs/design/template/Vaqcrow Sistema.dc.html`, git-ignored),
each with a Storybook story in both themes.

## Problem

`Button`, `Input` and `Label` from `@heroui/react` are used inline in four forms
(`sme-request-form`, `human-decision-form`, `funding-workspace`, `campaign-workspace`) with no shared
component, so states (loading, disabled reason, error, unit suffix, SIMULADO) are re-solved per form.
Select, TextArea, Slider, the pressed-chip filter group and Avatar do not exist, and Storybook only
covers `Badge`, `TrustBanner` and `CanonicalDisclosure`.

## Why

Step 1 of the build order derived from the template inventory (2026-09-26): primitives first, then
feedback + trust components, data display, navigation and overlays.

## Scope

In: `Button`, `TextField`, `TextArea`, `Select`/`ComboBox`, `Slider`, `ChipToggleGroup`, `Avatar`,
their unit tests and stories; the existing forms migrated to `Button`/`TextField` with no behaviour
change; `docs/guides/storybook.md` "Qué está cubierto hoy" updated.

Out: palette change (the template accent `#8A05BE` is Nubank's brand violet and must be replaced by an
own accent — a separate decision), feedback/data/navigation/overlay components, new pages, any change
to disclosure copy, contract, API or trust rules.

## Constraints

- HeroUI v3 (load the `heroui-react` skill / MCP docs before writing); Tailwind v4; tokens only from
  `globals.css` + `@heroui/styles`.
- `.dependency-cruiser.cjs`: `presentation/` may import `packages/contracts` only as type-only.
- Meaning never only in colour; keyboard operable; WCAG 2.2 AA.
- TDD: strict, runner `pnpm --filter @vaqcrow/web exec vitest run <path>` (source: global
  CLAUDE.md "Strict TDD Mode: enabled").
- ~400 authored lines per task is advisory only.

## Delivery

Strategy: `ask-on-risk`. Forecast above 400 authored lines (7 primitives + stories + tests + form
migration). Chain strategy chosen by the owner (2026-09-26): `stacked-to-main` — one PR per slice
against `main`, merged in order. Slices: PR 1 = T1 (this branch), PR 2 = T2 (`-02-more-primitives`),
PR 3 = T3+T4 (`-03-migrate-forms`).

## Tasks

- [x] T1 — `Button` + `TextField` + `TextArea` (tests RED→GREEN, stories)
- [ ] T2 — `Select`/`ComboBox`, `Slider`, `ChipToggleGroup`, `Avatar` (tests, stories)
- [ ] T3 — Migrate the four forms to `Button`/`TextField`; existing unit + e2e tests unchanged and green
- [ ] T4 — Update the Storybook guide coverage table; full verification matrix

Route: delegated direct (writer trigger: 2+ non-trivial files per task).

## Acceptance criteria

- [ ] Each primitive covers the variants/states listed in #306 and renders in light and dark
- [ ] Each primitive has a unit test and a Storybook story
- [ ] The four forms use the shared primitives with no behaviour change (unit + e2e green)
- [ ] `lint`, `typecheck`, `test`, `build`, `build-storybook`, `boundaries`, `test:boundaries`,
      `test:e2e` pass

## Verification evidence

### T1 — RED→GREEN

| Component | RED (before implementation) | GREEN (after implementation) |
| --- | --- | --- |
| `Button` | `Failed to resolve import "./button"` — module did not exist | 7/7 tests green |
| `TextField` | `Failed to resolve import "./text-field"` — module did not exist | 5/5 tests green |
| `TextArea` | `Failed to resolve import "./text-area"` — module did not exist | 3/3 tests green |

RED command: `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/button.test.tsx src/presentation/components/text-field.test.tsx src/presentation/components/text-area.test.tsx` (all three suites failed on the missing-module import before any component existed).
GREEN command: same command, `Test Files 3 passed (3)` / `Tests 15 passed (15)` after implementation.

Two REFACTOR-phase fixes made during GREEN, both confirmed empirically (not guessed) with a throwaway debug test rendering HeroUI's raw `Button`:
- HeroUI's `Button` drops an `aria-busy` prop passed directly (its `ButtonRoot` spreads `{...rest}` onto `react-aria-components`' `Button`, whose `filterDOMProps` allowlist does not include `aria-busy`). Fixed via the documented `render` escape hatch: `render={(props) => <button {...props} type={type} aria-busy={...} />}`. The `render` override also drops `type` back to its default, so `type` is re-applied explicitly inside it too.
- `apps/web/tsconfig.json` has `exactOptionalPropertyTypes: true`. Forwarding our own optional props (`className`, `onPress`, `aria-describedby`) straight through to HeroUI's typed props (which are declared as `T`, not `T | undefined`) fails under that flag whenever the local value is `undefined`. Fixed by only including those keys via conditional spread (`{...(x ? { x } : {})}`) instead of always passing the key, and by defaulting `fullWidth` to `false` in the three primitives so a plain boolean is always forwarded.

### T1 — Verification matrix

| Command | Result |
| --- | --- |
| `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/button.test.tsx src/presentation/components/text-field.test.tsx src/presentation/components/text-area.test.tsx` | 3 files / 15 tests passed |
| `pnpm run lint` | 0 errors (1 pre-existing unrelated warning in `fetch-http-client.ts`) |
| `pnpm run typecheck` | passed, 8/8 tasks |
| `pnpm run test` | 75/78 files passed on first run; 3 files timed out at vitest's 5000ms default (`src/app/(demo)/layout.test.tsx`, `src/presentation/components/ai-assessment-panel.test.tsx`, `src/presentation/components/demo-shell.test.tsx` — none touched by T1). Re-run in isolation: `pnpm --filter @vaqcrow/web exec vitest run "src/app/(demo)/layout.test.tsx" src/presentation/components/ai-assessment-panel.test.tsx src/presentation/components/demo-shell.test.tsx` → 3 files / 10 tests passed. Matches the documented known environmental flake. |
| `pnpm --filter @vaqcrow/web build-storybook` | built successfully (2118 modules); `storybook-static/` deleted afterwards |
| `pnpm run boundaries` | no dependency violations (376 modules, 1111 dependencies cruised) |
| `pnpm run test:boundaries` | 7 files / 83 tests passed |
| `pnpm run build` (parent spot check) | 5/5 tasks passed |

`apps/web/postcss.config.mjs` and `apps/web/AGENTS.md` were checked after `build-storybook` — neither was rewritten this run.

### Design decisions

- **Disabled reason**: `Button`'s `disabledReason` renders as a visible `<span>` under the button (not a tooltip), linked via `aria-describedby` using a `useId()`-generated id, only when `isDisabled && disabledReason` — an `isLoading`-only disable never shows a reason (that state already has its own visible label change).
- **Loading state**: `isLoading` forces `isDisabled` and HeroUI's `isPending`, swaps `children` for `loadingLabel ?? "Cargando…"`, and adds an `aria-hidden` `Spinner` (marking the spinner `aria-hidden` avoids its own `aria-label="Loading"` leaking English text into the button's computed accessible name, discovered via the RED run).
- **SIMULADO tag placement in `TextField`**: reuses `Badge` (not the whole `SyntheticValue` wrapper) inside HeroUI's `InputGroup.Suffix`, contiguous to the input holding the value — `SyntheticValue` renders the value as a separate `<span>`, which would duplicate the value already inside the read-only `<input>`.
- **Unit suffix announcement**: the suffix `<span>`/`Badge` sit in an `id`-carrying `InputGroup.Suffix`, and that id is passed as `aria-describedby` on the underlying `<input>` so the unit (e.g. "XLM") is included in the input's accessible description, not just visually adjacent.
- **Error vs. helper text**: `TextField`/`TextArea` render `FieldError` XOR `Description` (never both), following HeroUI's own documented pattern — avoids relying on any CSS auto-hide rule and keeps exactly one visible describedby target per field.

### Progress (2026-09-26)

T1 complete: `Button`, `TextField`, `TextArea` implemented under `apps/web/src/presentation/components/` with strict TDD (RED confirmed via missing-module import failures, GREEN confirmed after implementation, two REFACTOR fixes for HeroUI's DOM-prop filtering and `exactOptionalPropertyTypes`), each with a Storybook story (`Primitivas/Button`, `Primitivas/TextField`, `Primitivas/TextArea`) covering the states listed in scope. Full verification matrix above; only the pre-documented host-load flake was hit, and it cleared in isolation.

## Next step

Commit T1, assess for review, open PR 1.
