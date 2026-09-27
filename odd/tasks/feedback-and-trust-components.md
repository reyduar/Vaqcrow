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
- [x] T2 — `HashDisplay`, `DistributionCalculation`, `CustodyNote` (tests, stories, canonical copy)
- [x] T3 — `demo-step-loading` / `demo-step-error` adopt the states (tests unchanged); guide; full matrix

Route: delegated direct (writer trigger: 2+ non-trivial files per task).

## Acceptance criteria

- [x] Each component covers the states listed in #310 and renders in light and dark
- [x] Each component has a unit test and a Storybook story
- [x] Trust components use only canonical copy; the consistency guard passes
- [x] `demo-step-loading` / `demo-step-error` adopt the states with their tests unedited
- [x] `lint`, `typecheck`, `test`, `build`, `build-storybook`, `boundaries`, `test:boundaries`,
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

### T2 — RED→GREEN

| Component | RED (before implementation) | GREEN (after implementation) |
| --- | --- | --- |
| `HashDisplay` | `Failed to resolve import "./hash-display"` — module did not exist | 8/8 tests green on first implementation |
| `DistributionCalculation` | `Failed to resolve import "./distribution-calculation"` — module did not exist | 4/4 tests green on first implementation |
| `CustodyNote` | `Failed to resolve import "./custody-note"` — module did not exist | 3/3 tests green on first implementation |

RED command: `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/hash-display.test.tsx src/presentation/components/distribution-calculation.test.tsx src/presentation/components/custody-note.test.tsx` — all three suites failed on the missing-module import before any component existed.
GREEN command: same command, `Test Files 3 passed (3)` / `Tests 15 passed (15)` after implementation — no REFACTOR-phase correction was needed for any of the three (unlike T1's `ProgressBar`/`Skeleton` findings).

### T2 — Verification matrix

| Command | Result |
| --- | --- |
| `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/hash-display.test.tsx src/presentation/components/distribution-calculation.test.tsx src/presentation/components/custody-note.test.tsx` | 3 files / 15 tests passed |
| `pnpm --filter @vaqcrow/web exec vitest run src/application/trust` | 3 files / 45 tests passed |
| `pnpm exec vitest run tests/trust-disclosures-canonical-consistency.test.ts` (repo root) | 4 tests passed |
| `pnpm run lint` | 0 errors (1 pre-existing unrelated warning in `fetch-http-client.ts`, same as T1) |
| `pnpm run typecheck` | passed, 8/8 tasks |
| `pnpm run test` | 90/90 files, 571/571 tests passed — no timeout flake this run |
| `pnpm run build` | 5/5 tasks passed |
| `pnpm --filter @vaqcrow/web build-storybook` | built successfully (all 3 new stories compiled: `hash-display.stories`, `distribution-calculation.stories`, `custody-note.stories`); `storybook-static/` deleted afterwards |
| `pnpm run boundaries` | no dependency violations (412 modules, 1203 dependencies cruised) |
| `pnpm run test:boundaries` | 7 files / 83 tests passed |

`apps/web/postcss.config.mjs` and `apps/web/AGENTS.md` were checked after `build-storybook` — neither was rewritten this run.

### T2 — Design decisions

- **`HashDisplay` truncates `value.slice(0, 10) + "…" + value.slice(-8)`**, matching the template's own hash treatment (`Vaqcrow Sistema.dc.html`: `fullHash.slice(0, 10) + '…' + fullHash.slice(-8)`). A value too short to benefit (`length <= 19`) renders in full instead, with no duplicate `sr-only` copy (nothing to disambiguate). The full value stays available two ways: the `title` attribute on the wrapping `<span>`, and — only when actually truncated — a `sr-only` span carrying the untruncated text next to the `aria-hidden` visible glyph, so assistive tech is never handed the value twice for an already-short id.
- **Copy state is three-way (`idle | copied | failed`), not a boolean.** `navigator.clipboard?.writeText` is optional-chained so an unavailable Clipboard API (no `navigator.clipboard`, or `writeText` missing) fails the same visible path as a rejected promise, rather than throwing. The confirmation (`"Copiado"`) lives in a permanent `aria-live="polite"` region rather than toggling the copy button's own label — `Button` (T1/#306) has no `aria-label` passthrough in its prop surface, so the button's accessible name comes from its children text; giving it a dynamic `Copiar ${label}` (e.g. "Copiar hash de transacción") disambiguates multiple `HashDisplay` instances on one screen without needing an `aria-label` escape hatch.
- **The TESTNET badge is unconditional, not a prop.** `HashDisplay` always renders `Badge` with `microcopy.testnetBadge` — the exact pair `campaign-workspace.tsx`/`funding-workspace.tsx` already use for the same context — rather than accepting caller-supplied Testnet copy, keeping the canonical-copy rule enforceable at the type level (there is no prop through which a caller could substitute different wording).
- **`DistributionCalculation` renders an HTML `<table>` with `<caption>`, not a `<dl>`.** The task explicitly asks for "an accessible caption"; `<caption>` is a table's native accessible-name mechanism (confirmed via the `getByRole("table", { name: … })` test), while a definition list has no built-in caption element — reaching for a table over a `<dl>` here was a direct answer to that literal requirement, not a stylistic choice. `inputs`/`rounding`/`total` are all pre-formatted strings; the component contains no arithmetic and no number formatting, matching the T1 `ProgressBar`/`Slider` precedent of pushing all formatting to the caller. It renders no `Badge` and imports nothing from `ai-assessment-panel.tsx`, verified by a test asserting the absence of `[data-variant="risk"]` and any "Evaluación de IA" text — the explicit "must be visually distinct from AI panels" requirement.
- **`CustodyNote` is a two-line composition over `CanonicalDisclosure`**, not a new disclosure renderer: it always renders `contract-custody` and, only when `includeSigner` is true, also renders `non-custody` — mirroring how `step-disclosures.ts` pairs `testnet`/`non-custody`/`contract-custody` at the `funding` step (the one step where a wallet signer is in context). No markup is duplicated from `TrustBanner`/`CanonicalDisclosure`.

### T2 — Canonical constants used

| Component | Canonical constant(s) | Source |
| --- | --- | --- |
| `HashDisplay` | `microcopy.testnetBadge` | `apps/web/src/application/trust/disclosures.ts` |
| `DistributionCalculation` | `microcopy.deterministicCalculation` | `apps/web/src/application/trust/disclosures.ts` |
| `CustodyNote` | `disclosures["contract-custody"]`, `disclosures["non-custody"]` (via `CanonicalDisclosure`) | `apps/web/src/application/trust/disclosures.ts` |

No new trust wording was introduced; every canonical text a T2 component needed already existed in `disclosures.ts` — no open question to record.

### Progress (2026-09-27)

T2 complete: `HashDisplay`, `DistributionCalculation`, `CustodyNote` implemented under
`apps/web/src/presentation/components/` with strict TDD (RED confirmed via missing-module
import failures for all three; GREEN confirmed after implementation on the first pass, no
REFACTOR-phase correction needed). Each has a Storybook story under `Confianza/<Name>`
(`Confianza/HashDisplay`, `Confianza/DistributionCalculation`, `Confianza/CustodyNote`) using
only synthetic data (a fake 64-hex-char tx hash and a fake `CDLZ…` contract id, never a real
key or seed). Full verification matrix above; every command passed clean on this run, including
the two flake-prone ones (`pnpm run test`, `pnpm run test:boundaries`).

### T3 — adoption

**`demo-step-loading`** now renders `<Skeleton label="Loading step…" />` instead of a plain
`<section role="status" aria-live="polite"><p>Loading step…</p></section>`. `Skeleton`'s own
`role="status"` div already carries the ARIA-implicit `aria-live="polite"` that role grants, so
dropping the explicit attribute is not a behaviour change. The visible text moved into `Skeleton`'s
`sr-only` announcement span; `screen.getByText("Loading step…")` still finds it because `sr-only`
uses clip/absolute positioning, not `display:none` (confirmed by `Skeleton`'s own T1 test using the
same pattern). Default `shapes = ["line"]` renders one decorative, `aria-hidden` line — no visible or
accessible difference from before. Its unit test (`demo-step-loading.test.tsx`) and caller test
(`app/(demo)/loading.test.tsx`) both pass unedited.

**`demo-step-error`** now renders `<ErrorState title="Something went wrong loading this step."
onRetry={onRetry} retryLabel="Retry" />`, unwrapped (no extra `<section role="alert">`) — `ErrorState`
already renders its own single `role="alert"` region, so wrapping it again would have produced two
nested `alert` regions and broken `screen.getByRole("alert")` (single-match query). The original text
was one line with no separate title/detail split; `ErrorState` required both `title` and `message` as
non-empty strings, which would have forced either an empty second paragraph or genuinely new UI copy
neither one true to "same visible texts, no new wording". Extended `ErrorState.message` to optional
(RED→GREEN below) instead: when omitted, `ErrorState` renders only the title paragraph, and the
original single line of text now flows through unchanged. `retryLabel="Retry"` reproduces the
original "Retry" button text exactly (default is `"Reintentar"`). Its unit test
(`demo-step-error.test.tsx`) and both caller tests (`app/(demo)/error.test.tsx`, isolated real
`DemoRouteError` fallback; `app/(demo)/error.recovery.test.tsx`, a real React error boundary catching
a render-time throw and recovering on retry) all pass unedited.

Nothing was left un-adopted: both components now compose the shared states with no behaviour change
observable to any existing test, and no new component extension beyond the one documented below.

**`ErrorState.message` optional (RED→GREEN).** Added a test asserting that with no `message` prop,
`ErrorState` renders only the title, the alert role still resolves to exactly one match, and no
`<p class="text-sm">` element exists in the DOM — RED failed with `expected document not to contain
element, found <p class="text-sm" />` (message was unconditionally rendered as `""`). Implementation:
`message` became `readonly message?: string` and its `<p>` is now `{message ? <p
className="text-sm">{message}</p> : null}`. GREEN: 4/4 `error-state.test.tsx` tests passed, including
the three pre-existing ones unedited.

### T3 — Verification matrix

| Command | Result |
| --- | --- |
| Baseline (before edits): `demo-step-loading.test.tsx`, `demo-step-error.test.tsx`, `app/(demo)/error.test.tsx`, `app/(demo)/error.recovery.test.tsx`, `app/(demo)/loading.test.tsx` | 5 files / 10 tests passed |
| `error-state.test.tsx` RED (new optional-`message` test, before the `ErrorState` change) | 1 failed / 3 passed — `expected document not to contain element, found <p class="text-sm" />` |
| `error-state.test.tsx` GREEN (after the `ErrorState` change) | 4/4 passed |
| After edits: same 5 caller/component files + `error-state.test.tsx` + `skeleton.test.tsx` | 7 files / 18 tests passed, all pre-existing tests unedited |
| `pnpm run lint` | 0 errors (1 pre-existing unrelated warning in `fetch-http-client.ts`, same as T1/T2) |
| `pnpm run typecheck` | passed, 8/8 tasks |
| `pnpm run test` | 90/90 files, 572/572 tests passed (571 + 1 new `ErrorState` test) — no timeout flake this run |
| `pnpm run build` | 5/5 tasks passed |
| `pnpm --filter @vaqcrow/web test:e2e` | 17/17 Playwright specs passed |
| `pnpm --filter @vaqcrow/web build-storybook` | built successfully; `storybook-static/` deleted afterwards |
| `pnpm run boundaries` | no dependency violations (412 modules, 1205 dependencies cruised) |
| `pnpm run test:boundaries` | 1 timeout on first run (`boundary fixtures stay outside build/typecheck/boundaries globs > the real \`boundaries\` script glob … never reaches the fixtures`, 6816ms vs. the 5000ms default under host load — the documented environmental flake) — re-run in isolation with `-t` still hit the same 5000ms budget at 5576ms; re-run again with `--testTimeout=30000` on the same unmodified test passed at 2370ms, confirming pure timing, not a regression. 82/83 passed on the full first run, 1/1 passed in the timed isolation re-run. |

`apps/web/postcss.config.mjs` and `apps/web/AGENTS.md` were checked after `build-storybook` — neither
was rewritten this run.

### T3 — Design decisions

- **`ErrorState.message` became optional rather than inventing new detail copy for
  `demo-step-error`.** The alternative (keep `message` required, pass an empty string) would have
  rendered a genuinely empty `<p class="text-sm">` — harmless to the tests but not a clean read of
  "same visible texts", and would have left a meaningless empty paragraph in the DOM. Making the prop
  optional and skipping the paragraph entirely when absent is the minimal extension the task
  anticipated, mirrors the `onRetry`-optionality example already called out in the task brief, and
  keeps `ErrorState`'s two-line title+detail design intact for every existing caller (all of which
  still pass `message`).
- **`demo-step-error` never re-wraps `ErrorState` in its own `role="alert"`.** `ErrorState` already
  owns that region; nesting a second one would have produced two `alert` landmarks and broken every
  `getByRole("alert")` single-match assertion across `demo-step-error.test.tsx`, `error.test.tsx` and
  `error.recovery.test.tsx` (a real error-boundary recovery test, most sensitive to structural
  drift).
- **`demo-step-loading` keeps `Skeleton`'s default single `"line"` shape** rather than composing a
  richer skeleton (e.g. `["line", "line", "block"]` as in the `CardWithLines` story) — the route-level
  loading fallback covers an unknown step shape, so a single generic line placeholder is the honest
  minimum; a step-specific richer skeleton was out of scope for T3 (no such requirement in the issue
  or the original component).

### Progress (2026-09-27)

T3 complete: `demo-step-loading` now renders through `Skeleton`, `demo-step-error` now renders through
`ErrorState`, with no behaviour change to either component's external contract — every pre-existing
unit test (`demo-step-loading.test.tsx`, `demo-step-error.test.tsx`) and every caller test
(`app/(demo)/loading.test.tsx`, `app/(demo)/error.test.tsx`, `app/(demo)/error.recovery.test.tsx`)
passed unedited, both before and after the change. One minimal, TDD'd extension was needed:
`ErrorState.message` became optional so a single-line error (no separate detail text) does not force
either an empty paragraph or new UI copy. `docs/guides/storybook.md`'s "Qué está cubierto hoy" table
now lists all eleven stories present in the repo (four pre-existing `Primitivas/*` untouched, plus the
`Estados/*` and `Confianza/*` rows from T1/T2 that were missing from the table). Full verification
matrix above; every command passed, including one documented pure-timing flake in
`pnpm run test:boundaries` (re-run in isolation and with a longer timeout, both reported).

## Next step

Commit T3, assess for review, open PR 3; then close #310.
