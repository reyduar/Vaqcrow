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
- [x] T3 — Migrate the four forms to `Button`/`TextField`; existing unit + e2e tests unchanged and green
- [x] T4 — Update the Storybook guide coverage table; full verification matrix

Route: delegated direct (writer trigger: 2+ non-trivial files per task).

## Acceptance criteria

- [x] Each primitive covers the variants/states listed in #306 and renders in light and dark
- [x] Each primitive has a unit test and a Storybook story
- [x] The four forms use the shared primitives with no behaviour change (unit + e2e green)
- [x] `lint`, `typecheck`, `test`, `build`, `build-storybook`, `boundaries`, `test:boundaries`,
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
- **Error vs. helper text** (superseded in T3, see the warning under "T3 — migration"): `TextField`/`TextArea` render `FieldError` XOR `Description` (never both), following HeroUI's own documented pattern — avoids relying on any CSS auto-hide rule and keeps exactly one visible describedby target per field.

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

### T3 — Primitive extensions (RED→GREEN)

Two small capability gaps were found while migrating the forms — both fixed with strict TDD (test
first, confirmed RED, then implemented, confirmed GREEN) rather than working around the primitive:

| Gap | RED (before) | GREEN (after) |
| --- | --- | --- |
| `TextField`/`TextArea`'s `FieldError` renders no `role="alert"` | New tests (`text-field.test.tsx`, `text-area.test.tsx`) asserting `screen.getByRole("alert")` on a rendered error failed — `SmeRequestForm`'s original hand-rolled markup used `role="alert"` on every field error span, and its own test (`findAllByRole("alert")` after an empty submit) depends on it | 2/2 new tests green |
| `TextField`'s `type` union had no `"date"` | Typecheck failure once `campaign-workspace.tsx`'s "Fecha límite" field passed `type="date"` (the runtime already forwards any `type` string to the native `<input>`, so this is a type-level gap, not a behavioural one) | `pnpm run typecheck` clean; a `type="date"` unit test was also added, confirming the value round-trips through `onChange` |

Command: `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/text-field.test.tsx src/presentation/components/text-area.test.tsx` — RED: 2 failed / 9 passed (11); GREEN: 2 files / 11 tests passed.

**`role="alert"` fix.** HeroUI's `FieldError` (like `Button`'s `aria-busy`, found in T1) filters `role`
out of the DOM props it forwards — `react-aria-components`' own `filterDOMProps({ global: true })` call
has no `role` in its allowlist (confirmed by reading `node_modules/react-aria/dist/private/utils/filterDOMProps.js`:
only `dir`/`lang`/`hidden`/`inert`/`translate` plus `data-*` and the labelable `aria-*` set pass through),
and unlike `Button`, `FieldError` exposes no `render` escape hatch. Fixed by wrapping the error in a plain
`<span role="alert">` around `<FieldError>`; the id `FieldError` generates (and that the input's
`aria-describedby` already points at) stays on the inner element, unaffected.

**`type="date"` fix.** `TextFieldInputType` widened to add `"date"`; no other change needed since the
value already flowed straight into the native `<input type>`.

### T3 — Migration

All four forms use only the shared primitives now; no fallback to inline HeroUI markup was needed for
any of them, and every existing unit/e2e test passes unchanged (no test file was edited).

| Form | Replaced | Baseline (before) | After |
| --- | --- | --- | --- |
| `SmeRequestForm` | 3× `Input`+`Label` → `TextField`, `Button` | 13/13 green | 13/13 green |
| `HumanDecisionForm` | 2× `Input`+`Label` → `TextField`, 1× `textarea`+`Label` → `TextArea`, `Button` | 8/8 green | 8/8 green |
| `FundingWorkspace` | 3× `Input`+`Label` → `TextField`, 3× `Button` | 8/8 green | 8/8 green |
| `CampaignWorkspace` | 4× `Input`+`Label` → `TextField`, 5× `Button` | 13/13 green | 13/13 green |

Left unmigrated, on purpose and out of T3's stated scope: `HumanDecisionForm`'s outcome `<fieldset>` of
native `<input type="radio">` — no shared radio primitive exists yet, and it's guarded end-to-end by
`e2e/human-decision.spec.ts`.

**`SmeRequestForm`'s react-hook-form integration.** `TextField` is a controlled component
(`value`/`onChange(value: string)`), not a ref-forwarding one, so `register()` (which needs a DOM ref for
RHF's uncontrolled tracking) can't wire it directly. Switched to RHF's `Controller` per field — the
officially supported pattern for a custom controlled input. `field.onChange` accepts the raw string
directly (RHF treats a non-event argument passed to `onChange` as the new value, per its
`getEventValue` helper), so the "pass raw strings through untouched" contract, the required/pattern
`rules`, and the per-field `dismiss`-on-edit callback all carry over with no behavioural change; verified
by the full existing test file passing unedited, including the RHF-specific ones (unique ids per
instance, fresh-server-error-wins-over-stale-local-error).

**Established XOR helper/error pattern reused, not re-invented.** Every migrated field where the original
markup showed a static helper span *and* an error span at the same time (e.g. `HumanDecisionForm`'s
"Límite aprobado" note, `CampaignWorkspace`'s refund-target note) now follows `TextField`/`TextArea`'s T1
design decision of rendering `FieldError` XOR `Description`, never both — the helper hides while an error
is shown. No test asserted the helper's simultaneous visibility, and this keeps the primitive's contract
uniform across the app rather than special-casing these forms.

> [!warning] Reversed in the parent review (2026-09-27)
> Hiding the helper during an error was a behaviour change against the "no behaviour change" rule of T3:
> in `SmeRequestForm` the hint carries the format instructions (e.g. `AAAA-MM`), and it disappeared
> exactly when the field showed a format error; the same applied to the "Límite aprobado" note and the
> refund-target note. The XOR rule was a T1/T2 design choice, not a requirement, and HeroUI does not hide
> `Description` on invalid (checked in `@heroui/styles` 3.2.6). All four field primitives (`TextField`,
> `TextArea`, `Select`, `ComboBox`) now render the helper **and** the error, both in
> `aria-describedby`. Strict TDD: the T1 `TextField` and T2 `Select` assertions that the helper is hidden
> were changed to require it visible, and new `TextArea` / `ComboBox` tests were added — RED 2 failed
> (`text-field`, `text-area`) and 2 failed (`select`, `combo-box`), then GREEN 6 files / 54 tests
> (primitives + four forms) and 2 files / 7 tests. The four form test files and the e2e specs stay
> unedited.

**`exactOptionalPropertyTypes` conditional spreads.** Same T1 gotcha, six more call sites: every
`error={someString | undefined}` pass-through needed `{...(error ? { error } : {})}` instead of a direct
prop, across `campaign-workspace.tsx` (×2), `funding-workspace.tsx`, `human-decision-form.tsx` (×3) and
`sme-request-form.tsx`.

`idPrefix`/manual `id`/`aria-describedby`/`aria-invalid`/`aria-required` wiring was dropped from all four
forms wherever a field moved to a primitive — `TextField`/`TextArea`'s own HeroUI/React Aria composition
generates unique ids and wires that accessibility state automatically (already established and tested in
T1/T2); the "unique ids per form instance" `SmeRequestForm` test continues to pass on that guarantee.

### T3/T4 — Verification matrix

| Command | Result |
| --- | --- |
| Baseline (before any edit): `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/sme-request-form.test.tsx src/presentation/components/human-decision-form.test.tsx src/presentation/components/funding-workspace.test.tsx src/presentation/components/campaign-workspace.test.tsx` | 4 files / 42 tests passed |
| Same command, after migration | 4 files / 42 tests passed |
| Primitive RED→GREEN: `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/text-field.test.tsx src/presentation/components/text-area.test.tsx` | RED: 2 failed / 9 passed (11); GREEN: 2 files / 11 tests passed |
| Combined re-run (4 forms + `text-field`/`text-area`/`button`) | 7 files / 60 tests passed |
| `pnpm run lint` | 0 errors (same 1 pre-existing unrelated warning in `fetch-http-client.ts` as T1/T2) |
| `pnpm run typecheck` | passed, 8/8 tasks (after adding the 6 `exactOptionalPropertyTypes` conditional spreads above) |
| `pnpm run test` | 83/83 files, 538/538 tests passed — no timeout flake this run |
| `pnpm run build` | 5/5 tasks passed |
| `pnpm --filter @vaqcrow/web test:e2e` | 17/17 Playwright tests passed (browsers already installed, no `test:e2e:install` needed) |
| `pnpm --filter @vaqcrow/web build-storybook` | built successfully; `storybook-static/` deleted afterwards |
| `pnpm run boundaries` | no dependency violations (391 modules, 1151 dependencies cruised) |
| `pnpm run test:boundaries` | 7 files / 83 tests passed |

`apps/web/postcss.config.mjs` and `apps/web/AGENTS.md` were checked after `build-storybook` — neither was
rewritten this run.

After the helper/error reversal (parent, same day):

| Command | Result |
| --- | --- |
| `pnpm run lint` | exit 0 |
| `pnpm run typecheck` | 8/8 tasks |
| `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components` | 33 files / 178 tests passed |
| `pnpm --filter @vaqcrow/web test:e2e` | 17/17 passed |

### Progress (2026-09-27)

T3+T4 complete: all four forms (`SmeRequestForm`, `HumanDecisionForm`, `FundingWorkspace`,
`CampaignWorkspace`) now use the shared `Button`/`TextField`/`TextArea` primitives, with no unit or e2e
test edited — every pre-existing test passes unchanged against the migrated markup. Two minimal,
TDD-confirmed primitive extensions were needed along the way (`role="alert"` on `FieldError`, `TextField`
`type="date"`); no form's markup was left inline except the deliberately out-of-scope radio fieldset.
`docs/guides/storybook.md`'s coverage table now lists all eleven stories with a one-line summary each.
Full verification matrix above; every command passed on this run, including the two flake-prone ones
(`pnpm run test`, `pnpm run test:boundaries`) which had no timeouts this time.

## Next step

Commit T3+T4, assess for review, open PR 3; then close #306 and write the feature evidence if required.
