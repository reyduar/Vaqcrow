# Feedback and trust display components

Iteration log for issue #310, branch
`Vaqcrow#310_Task_Build_the_feedback_and_trust_display_components_from_the_Claude_Design_system`.

## Objective

Step 2 of the Claude Design template build order: feedback states and trust display components as
shared presentational components, each with a unit test and a Storybook story in both themes.

## Problem

Loading and error are plain text (`demo-step-loading.tsx`, `demo-step-error.tsx`); skeleton, empty
state, error with retry, progress bar, Testnet hash display, the deterministic distribution
calculation block and the vault custody note do not exist, although the template uses them across
`Sistema`, `Explorar PyMEs`, `Detalle PyME` and `Portafolio` (`docs/design/template/`, git-ignored).

## Why

The template inventory (2026-09-26) put feedback and trust components right after the primitives
(#306): the trust ones encode the product rules and must not be deferred.

## Scope

In: `Skeleton`, `EmptyState`, `ErrorState`, `ProgressBar`, `HashDisplay`, `DistributionCalculation`,
`CustodyNote`, their tests and stories; `demo-step-loading` / `demo-step-error` adopting the new
states with their tests unchanged; `docs/guides/storybook.md` coverage table.

Out: palette/accent change, data display, navigation, overlays, new pages, new trust wording.

## Constraints

- Every trust text comes from `apps/web/src/application/trust/` (`disclosures.ts`,
  `step-disclosures.ts`) — no new wording. The canonical consistency guard in `tests/` must keep
  passing.
- Presentational only: values are props; no calculation, network or wallet access.
- Field-primitive rule from #306: helper text stays visible next to an error.
- HeroUI v3 (load the `heroui-react` skill / MCP docs); `exactOptionalPropertyTypes` → conditional
  spreads; HeroUI may drop ARIA props (`render` override or a wrapper).
- TDD: strict (global CLAUDE.md), runner `pnpm --filter @vaqcrow/web exec vitest run <path>`.
- ~400 authored lines per task is advisory only.

## Delivery

Strategy: `ask-on-risk`; forecast above 400 authored lines. Chain strategy reused from the owner's
choice for #306 (2026-09-26): `stacked-to-main`. Slices: PR 1 = T1 (this branch), PR 2 = T2
(`-02-trust-components`), PR 3 = T3 (`-03-adopt-states`).

## Tasks

- [x] T1 — `Skeleton`, `EmptyState`, `ErrorState`, `ProgressBar` (tests RED→GREEN, stories)
- [ ] T2 — `HashDisplay`, `DistributionCalculation`, `CustodyNote` (tests, stories, canonical copy)
- [ ] T3 — `demo-step-loading` / `demo-step-error` adopt the states (tests unchanged); guide; full matrix

Route: delegated direct (writer trigger: 2+ non-trivial files per task).

## Acceptance criteria

- [ ] Each component covers the states listed in #310 and renders in light and dark
- [ ] Each component has a unit test and a Storybook story
- [ ] Trust components use only canonical copy; the consistency guard passes
- [ ] `demo-step-loading` / `demo-step-error` adopt the states with their tests unedited
- [ ] `lint`, `typecheck`, `test`, `build`, `build-storybook`, `boundaries`, `test:boundaries`,
      `test:e2e` pass

## Verification evidence

### T1 — RED→GREEN

| Component | RED (before implementation) | GREEN (after implementation) |
| --- | --- | --- |
| `Skeleton` | `Failed to resolve import "./skeleton"` — module did not exist | 4/4 tests green on first implementation |
| `EmptyState` | `Failed to resolve import "./empty-state"` — module did not exist | 4/4 tests green on first implementation |
| `ErrorState` | `Failed to resolve import "./error-state"` — module did not exist | 3/3 tests green on first implementation |
| `ProgressBar` | `Failed to resolve import "./progress-bar"` — module did not exist | 4/5 green on first implementation; 5/5 after switching `aria-valuetext` to react-aria's `valueLabel` prop (see design decisions) |

RED command: `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/skeleton.test.tsx src/presentation/components/empty-state.test.tsx src/presentation/components/error-state.test.tsx src/presentation/components/progress-bar.test.tsx` — all four suites failed on the missing-module import before any component existed.
GREEN command: same command, `Test Files 4 passed (4)` / `Tests 16 passed (16)` after implementation.

One REFACTOR-phase finding, confirmed empirically (not guessed) by reading `react-aria/dist/private/progress/useProgressBar.mjs`:
- **`ProgressBar`'s `aria-valuetext` is recomputed and overwritten by react-aria.** `useProgressBar` always derives `aria-valuetext` from `formatOptions` unless its own `valueLabel` prop is already truthy, then merges its own `progressBarProps` in last (`mergeProps(DOMProps, renderProps, progressBarProps)`), so a plain `aria-valuetext` prop passed on the root gets silently overwritten with the percentage-based text (observed: `"63%"` instead of the custom string). Fixed by forwarding the caller's formatted text through react-aria's own `valueLabel` prop instead, which `useProgressBar` uses verbatim as `aria-valuetext` when present.

A second lint-only finding, also fixed during REFACTOR: `usePrefersReducedMotion`'s initial `matchMedia` read was originally a synchronous `setState` inside the effect body, which `pnpm run lint` flagged (`react-hooks/set-state-in-effect`, promoted to error) as an avoidable cascading render. Moved the initial read into `useState`'s lazy initializer; the effect now only subscribes to the `change` event.

### T1 — Verification matrix

| Command | Result |
| --- | --- |
| `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/skeleton.test.tsx src/presentation/components/empty-state.test.tsx src/presentation/components/error-state.test.tsx src/presentation/components/progress-bar.test.tsx` | 4 files / 16 tests passed |
| `pnpm run lint` | 0 errors (1 pre-existing unrelated warning in `fetch-http-client.ts`, same as #306) |
| `pnpm run typecheck` | passed, 8/8 tasks |
| `pnpm run test` | 87/87 files, 556/556 tests passed — no timeout flake this run |
| `pnpm run build` | 5/5 tasks passed |
| `pnpm --filter @vaqcrow/web build-storybook` | built successfully (all 4 new stories compiled: `skeleton.stories`, `empty-state.stories`, `error-state.stories`, `progress-bar.stories`); `storybook-static/` deleted afterwards |
| `pnpm run boundaries` | no dependency violations (403 modules, 1179 dependencies cruised) |
| `pnpm run test:boundaries` | 7 files / 83 tests passed |

`apps/web/postcss.config.mjs` and `apps/web/AGENTS.md` were checked after `build-storybook` — neither was rewritten this run.

### T1 — Design decisions

- **`Skeleton` is one `role="status"` region wrapping decorative shapes**, not a compound component: a single `<span class="sr-only">{label}</span>` announces the loading state, and the visual shapes sit in one `aria-hidden="true"` container — an `aria-hidden` ancestor already removes the whole subtree from the accessibility tree, so no per-shape `aria-hidden` is needed. `shapes` is an ordered list of `"line" | "block" | "card"` so a caller composes a skeleton screen (e.g. two title lines plus a funding block) from one component.
- **Reduced motion is enforced twice, JS + CSS.** `usePrefersReducedMotion` (local to `skeleton.tsx`) reads `matchMedia("(prefers-reduced-motion: reduce)")` and forces HeroUI's `animationType="none"` — this is what the unit tests assert (mocking `window.matchMedia`), since jsdom implements no CSS media queries at all. A CSS-only backstop was also added to `globals.css` (`@media (prefers-reduced-motion: reduce) { .skeleton--shimmer, .skeleton--shimmer::before, .skeleton--pulse { animation: none; } }`) for any render path where `matchMedia` is unavailable (SSR) — HeroUI's own shimmer/pulse classes do not check this preference on their own.
- **`EmptyState` is deliberately not HeroUI's own `EmptyState`.** `combo-box.tsx` already imports a component of that exact name from `@heroui/react`, but it is a minimal "no results" placeholder scoped to a `ListBox` popover (used via `renderEmptyState`), not a general section-level state. Our `EmptyState` (title/body/optional icon/optional action) is a separate module (`./empty-state`) with no relation to it; the name collision only matters if both were ever imported in the same file, which they are not.
- **`ErrorState` composes the shared `Button`, not `TrustBanner`.** `TrustBanner` is the disclosure-banner compound (variant/title/body/badge/link) from Feature #17; `ErrorState` needed a required `onRetry` action and no disclosure semantics, so it stayed a small standalone component reusing only `Button`, matching the issue's explicit shape (title, message, retry).
- **`ProgressBar.formatValue` over HeroUI's `formatOptions`**, same reasoning T2 already established for `Slider`: `Intl.NumberFormatOptions` cannot express "$630.000 de $1.000.000" or an XLM amount. The formatted text drives both the visible `ProgressBar.Output` and, via `valueLabel`, the real `aria-valuetext` (see the REFACTOR note above).
- **Success colour requires an explicit, caller-confirmed `isGoalReached`**, never inferred from `value >= goal` — an overfunded-but-unconfirmed campaign must not silently read as a success state. Default `color` is `"accent"`. `value`/`goal` are passed straight through to HeroUI's `minValue`/`maxValue`/`value` (react-aria's own `clamp` bounds the internal percentage/fill to 0–100%); this component never mutates them itself, so an overfunded value still reports its real numbers through `formatValue`.

### Progress (2026-09-27)

T1 complete: `Skeleton`, `EmptyState`, `ErrorState`, `ProgressBar` implemented under
`apps/web/src/presentation/components/` with strict TDD (RED confirmed via missing-module
import failures for all four; GREEN confirmed after implementation, with one REFACTOR-phase
correction from real, empirically-observed react-aria behaviour — `ProgressBar`'s
`aria-valuetext` needing react-aria's own `valueLabel` prop instead of a direct override — plus
one lint-only `react-hooks/set-state-in-effect` fix in `Skeleton`'s reduced-motion hook). Each
component has a Storybook story (`Estados/Skeleton`, `Estados/EmptyState`, `Estados/ErrorState`,
`Estados/ProgressBar`) covering the states listed in scope, using only synthetic data. A CSS-only
reduced-motion backstop for `Skeleton` was added to `apps/web/src/app/globals.css`. Full
verification matrix above; every command passed clean on this run, including the two
flake-prone ones (`pnpm run test`, `pnpm run test:boundaries`).

## Next step

Commit T1, assess for review, open PR 1.
