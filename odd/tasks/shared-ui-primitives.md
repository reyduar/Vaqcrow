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
- [x] T2 — `Select`/`ComboBox`, `Slider`, `ChipToggleGroup`, `Avatar` (tests, stories)
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

### T2 — RED→GREEN

| Component | RED (before implementation) | GREEN (after implementation) |
| --- | --- | --- |
| `Avatar` | `Failed to resolve import "./avatar"` — module did not exist | 4/4 tests green on first implementation |
| `ChipToggleGroup` | `Failed to resolve import "./chip-toggle-group"` — module did not exist | 5/5 tests green on first implementation |
| `Slider` | `Failed to resolve import "./slider"` — module did not exist | 3/4 green on first implementation; 4/4 after correcting the range-thumb test's expected accessible name (see REFACTOR note) |
| `Select` | `Failed to resolve import "./select"` — module did not exist | 3/3 tests green on first implementation |
| `ComboBox` | `Failed to resolve import "./combo-box"` — module did not exist | 1/3 green on first implementation; 3/3 after switching the test's open-popover gesture (see REFACTOR note) |

RED command: `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/avatar.test.tsx src/presentation/components/chip-toggle-group.test.tsx src/presentation/components/slider.test.tsx src/presentation/components/select.test.tsx src/presentation/components/combo-box.test.tsx` — all five suites failed on the missing-module import before any component existed.
GREEN command: same command, `Test Files 5 passed (5)` / `Tests 19 passed (19)` after implementation.

Two REFACTOR-phase findings, both confirmed empirically by running the real component against jsdom rather than guessed:
- **Slider range-thumb accessible name**: React Aria's `useSliderThumb` combines a per-thumb `aria-label` with the group's `<Label>` via a self-referencing `aria-labelledby` (the thumb's own id is listed first, which resolves to its own `aria-label` since aria-labelledby recursion is cut at the self-reference, then the group label id is appended) — a documented accessible-naming technique for otherwise unlabelable native `<input type="range">` elements. The computed name is `"<label> (<mínimo|máximo>) <label>"`, not just the per-thumb text. The test was corrected to assert the real (and legitimately more informative) concatenated name instead of the originally assumed string.
- **ComboBox popover opening gesture in jsdom**: `fireEvent.click` on the trigger button (which worked for `Select`) left the popover closed (`aria-expanded="false"`) for `ComboBox`, because its trigger renders with `tabindex="-1"` and is not meant to be a separate press target the same way. `fireEvent.focus` followed by `fireEvent.keyDown(input, { key: "ArrowDown" })` — the standard combobox "open on focus + arrow" gesture — opens it reliably; tests were written against that gesture.

### T2 — Verification matrix

| Command | Result |
| --- | --- |
| `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/avatar.test.tsx src/presentation/components/chip-toggle-group.test.tsx src/presentation/components/slider.test.tsx src/presentation/components/select.test.tsx src/presentation/components/combo-box.test.tsx` | 5 files / 19 tests passed |
| `pnpm run lint` | 0 errors (same 1 pre-existing unrelated warning in `fetch-http-client.ts` as T1) |
| `pnpm run typecheck` | passed, 8/8 tasks (after removing two incorrect `Key`-from-`"react"` casts on `Select`/`ComboBox` value props — `react`'s `Key` includes `bigint`, `@react-types/shared`'s narrower `Key` does not, and `exactOptionalPropertyTypes` caught the mismatch; and after removing an explicit `defaultValue: undefined` story arg and an unnarrowed array-index read in a Slider story) |
| `pnpm run test` | 77/83 files passed on the full concurrent run; 6 files timed out at vitest's 5000ms default under host load: the two already-documented pre-existing flakes (`ai-assessment-panel.test.tsx`, `demo-shell.test.tsx`) plus four of T2's own popover/thumb-interaction tests (`slider.test.tsx`, `chip-toggle-group.test.tsx`, `combo-box.test.tsx`, `select.test.tsx` — one test each, the rest of each file passed). Re-run in isolation: `pnpm --filter @vaqcrow/web exec vitest run "src/presentation/components/demo-shell.test.tsx" src/presentation/components/ai-assessment-panel.test.tsx src/presentation/components/slider.test.tsx src/presentation/components/chip-toggle-group.test.tsx src/presentation/components/combo-box.test.tsx src/presentation/components/select.test.tsx` → 6 files / 24 tests passed. Matches the documented known environmental flake, extended (predictably) to the new popover-heavy interaction tests, which run measurably slower than the plain-button tests. |
| `pnpm --filter @vaqcrow/web build-storybook` | built successfully (all 5 new stories compiled: `avatar.stories`, `chip-toggle-group.stories`, `slider.stories`, `select.stories`, `combo-box.stories`); `storybook-static/` deleted afterwards |
| `pnpm run boundaries` | no dependency violations (391 modules, 1146 dependencies cruised) |
| `pnpm run test:boundaries` | 7 files / 83 tests passed |
| `pnpm run build` (parent spot check) | 5/5 tasks passed |

`apps/web/postcss.config.mjs` and `apps/web/AGENTS.md` were checked after `build-storybook` — neither was rewritten this run.

### T2 — Design decisions

- **`Avatar`'s "required alt"**: interpreted as a guarantee the primitive itself always provides, not an optional pass-through — `alt` is computed from the required `name` prop (`isDecorative ? "" : name`), never left to the caller to omit. The initials fallback (Radix's `Avatar.Fallback`, shown automatically whenever the image is missing or fails — verified empirically: jsdom never resolves `new Image().src` to a loaded state, so the fallback path is exercised by ordinary rendering, not mocked) is itself `aria-hidden`; the accessible name comes from `role="img"`/`aria-label={name}` on the root instead, so a two-letter initials string is never what a screen reader announces. `isDecorative` drops all of that (empty alt, no exposed name) for the case where the caller already renders the same name as visible text beside the avatar.
- **`ChipToggleGroup` uses `isDetached`, not `ToggleButtonGroup.Separator`**: the template's sector/risk-profile filters are gapped, individually pill-shaped buttons (`border-radius:999px`, no connecting divider), matching HeroUI's `isDetached` variant — not the connected/segmented style the docs' separator anatomy implies. React Aria's `ToggleButton` already sets `aria-pressed` on the underlying `<button>` with no extra wiring. Selected state also renders a visible `aria-hidden` checkmark icon (react-icons/io5 `IoCheckmarkOutline`, matching the template's `checkmark-outline`) next to the label, so selection is never colour-only.
- **`Slider`'s `formatValue` over HeroUI's `formatOptions`**: HeroUI's native `formatOptions` is `Intl.NumberFormatOptions`-only, which cannot express a non-ISO unit like "XLM". A caller-supplied `formatValue: (value: number) => string` covers both the XLM-amount case and the close-date case (a day-count value formatted as a calendar date), and drives both the visible `Slider.Output` text and (indirectly, per the REFACTOR note above) the accessible name.
- **`Select`/`ComboBox` value props take plain `string`, no `Key` cast**: both primitives' own props type `value`/`defaultValue` as `string | null`/`string`, which is directly assignable to HeroUI's `Key | null`/`Key` (`@react-types/shared`'s `Key = string | number`) with no cast needed — casting via `React`'s own (wider, `bigint`-inclusive) `Key` type actively breaks `exactOptionalPropertyTypes`, per the typecheck fix above.
- **`ComboBox`'s empty state**: `ListBox`'s `renderEmptyState` renders `EmptyState` with the caller-supplied `emptyResultsText` (default: "No se encontraron resultados.") as its visible child, so a non-matching filter never leaves the popover blank.

### Progress (2026-09-27)

T2 complete: `Avatar`, `ChipToggleGroup`, `Slider`, `Select`, `ComboBox` implemented under `apps/web/src/presentation/components/` with strict TDD (RED confirmed via missing-module import failures for all five; GREEN confirmed after implementation, with two REFACTOR-phase corrections made from real, empirically-observed jsdom/React-Aria behaviour rather than assumptions — the Slider range-thumb accessible-name concatenation, and the ComboBox popover-opening gesture). Each component has a Storybook story (`Primitivas/Avatar`, `Primitivas/ChipToggleGroup`, `Primitivas/Slider`, `Primitivas/Select`, `Primitivas/ComboBox`) covering the states listed in scope, using only synthetic Argentine-city/PyME fixture data (initials/placeholder avatars, no real photos). Full verification matrix above; the only failures were the documented host-load timeout flake (six files, cleared in isolation).

## Next step

Commit T2, assess for review, open PR 2.
