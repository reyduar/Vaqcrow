# Data display components

Iteration log for issue #314, branch
`Vaqcrow#314_Task_Build_the_data_display_components_from_the_Claude_Design_system`.

## Objective

Step 3 of the Claude Design template build order: data display components as shared presentational
components, each with a unit test and a Storybook story in both themes.

## Problem

The template (`Sistema`, `Explorar PyMEs`, `Detalle PyME`, `Informes`, `Portafolio`, in the git-ignored
`docs/design/template/`) uses a campaign card, KPI tiles, a bar chart with an accessible table, a visual
timeline and a transaction status list. None exist as shared components: `sales-evidence-table.tsx` is
table-only and `demo-progress` / `demo-step-nav` are text-only.

## Why

Build order from the template inventory (2026-09-26): primitives (#306), feedback + trust (#310), then
data display, navigation and overlays.

## Scope

In: `KpiTile`, `CampaignCard`, `BarChart`, `Timeline`, `TransactionStatusList`, their tests and stories;
`docs/guides/storybook.md` coverage table.

Out: adopting them in existing screens, navigation, overlays, palette/accent, new trust wording.

## Constraints

- Trust copy only from `apps/web/src/application/trust/` — e.g. `microcopy.submittedNotConfirmed`, the
  synthetic sales series notice, `SIMULADO`. The template's "Sin retorno garantizado" is **not**
  canonical: do not introduce it; report missing copy instead of inventing it.
- "Sent / pending" never uses the success colour; only a confirmed state may read as success.
- Presentational only: values are props; bar heights from provided values are the only computation.
- Load the `dataviz` skill before chart code; `heroui-react` skill / MCP for HeroUI APIs.
- Gotchas from #306/#310: HeroUI may drop ARIA props; `exactOptionalPropertyTypes`; react-aria
  overwrites `aria-valuetext` unless `valueLabel` is set.
- TDD: strict, runner `pnpm --filter @vaqcrow/web exec vitest run <path>`.
- ~400 authored lines per task is advisory only.

## Delivery

`stacked-to-main`, reused from the owner's choice for #306 and #310. Slices: PR 1 = T1 (this branch),
PR 2 = T2 (`-02-chart-and-timeline`), PR 3 = T3 (`-03-transaction-status`).

## Tasks

- [x] T1 — `KpiTile`, `CampaignCard` (tests RED→GREEN, stories)
- [x] T2 — `BarChart` with accessible table, `Timeline` (tests, stories)
- [x] T3 — `TransactionStatusList`; guide; full matrix

Route: delegated direct (writer trigger: 2+ non-trivial files per task).

## Acceptance criteria

- [x] Each component covers the states listed in #314 and renders in light and dark
- [x] Each component has a unit test and a Storybook story
- [x] Trust copy only from canonical constants; the consistency guard passes
- [x] `lint`, `typecheck`, `test`, `build`, `build-storybook`, `boundaries`, `test:boundaries` pass

## Verification evidence

### T1 — RED→GREEN

| Component | RED (before implementation) | GREEN (after implementation) |
| --- | --- | --- |
| `KpiTile` | `Failed to resolve import "./kpi-tile"` — module did not exist | 8/8 tests green on first implementation |
| `CampaignCard` | `Failed to resolve import "./campaign-card"` — module did not exist | 21/24 green on first implementation; 24/24 after a test fix (see REFACTOR note) |

RED command: `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/kpi-tile.test.tsx src/presentation/components/campaign-card.test.tsx` — both suites failed on the missing-module import before either component existed.
GREEN command: same command, `Test Files 2 passed (2)` / `Tests 24 passed (24)` after implementation.

One REFACTOR-phase finding, a test bug rather than a component bug: the `it.each(["low","medium","high"])` risk-tone test originally passed `riskLabel="Riesgo"`, which collided with `CampaignCard`'s own fixed `<dt>Riesgo</dt>` label — `screen.getByText("Riesgo")` then matched two elements. Fixed by using a distinguishable `riskLabel` ("Riesgo del nivel") in that test; no component change was needed.

Two REFACTOR-phase `exactOptionalPropertyTypes` fixes (same T1/#306 gotcha, still current):
- `CampaignCard`'s action-button branch forwarded `onPress={action.onPress}` directly to `Button`, whose `onPress` is typed as `() => void` (not `() => void | undefined`); fixed with the conditional-spread pattern (`{...(action.onPress ? { onPress: action.onPress } : {})}`).
- `KpiTile.stories.tsx`'s `WithoutNote`/`WithoutIcon` stories originally set `note: undefined`/`icon: undefined` in `args`, which fails the same flag; fixed by rendering those two stories with an explicit `render: () => <KpiTile .../>` (props omitted entirely) instead of trying to null out an inherited `meta.args` default.

### T1 — Verification matrix

| Command | Result |
| --- | --- |
| `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/kpi-tile.test.tsx src/presentation/components/campaign-card.test.tsx` | 2 files / 24 tests passed |
| `pnpm run lint` | 0 errors (1 pre-existing unrelated warning in `fetch-http-client.ts`, same as #306/#310) |
| `pnpm run typecheck` | passed, 8/8 tasks (after the two `exactOptionalPropertyTypes` fixes above) |
| `pnpm run test` | 92/92 files, 596/596 tests passed — no timeout flake this run |
| `pnpm run build` | 5/5 tasks passed |
| `pnpm --filter @vaqcrow/web build-storybook` | built successfully (`kpi-tile.stories`, `campaign-card.stories` both compiled); `storybook-static/` deleted afterwards |
| `pnpm run boundaries` | no dependency violations (418 modules, 1226 dependencies cruised) |
| `pnpm run test:boundaries` | 7 files / 83 tests passed — no timeout flake this run |

`apps/web/postcss.config.mjs` and `apps/web/AGENTS.md` were checked after `build-storybook` — neither was rewritten this run.

### T1 — Design decisions

- **`KpiTile` is one `<dl>`**, not a compound component: a single `<dt>` (the label) plus one or two `<dd>` (the caller-formatted value, and the optional caller-formatted note) keeps the label/value association native, mirroring the "labelled group via native semantics" approach `DistributionCalculation` (#310/T2) took with `<table>`/`<caption>` instead of adding `aria-label`/`id` wiring.
- **The SIMULADO marker is a `simuladoLabel?: string` prop**, not a boolean, reusing `Badge`/`SyntheticValue`'s (Feature #17) established rule that the label is always sourced by the caller from the fixture record itself — never hardcoded inside the presentational component.
- **`CampaignCard`'s heading is a dynamically-selected native tag (`h2`–`h6`)**, not HeroUI's `Card.Title` — `Card.Title` always renders as `h3` (confirmed via the HeroUI v3 MCP docs), which cannot satisfy the "heading level configurable" requirement. The rest of the card uses plain `<article>`/`<dl>` markup with the project's own Tailwind tokens (`border-border`, `text-muted`), matching every other T1/T2 (#310) presentational component (`ErrorState`, `EmptyState`, `HashDisplay`, `DistributionCalculation`) rather than HeroUI's `Card`/`Surface` compounds.
- **`CampaignCard` reuses `ProgressBar` verbatim** for the funding bar (label/value/goal/formatValue/isGoalReached all pass straight through), so the "success colour only on an explicit, caller-confirmed goal" rule from #310/T1 carries over with no re-implementation.
- **Risk tone is derived from a closed `riskLevel: "low"|"medium"|"high"` enum, mapped to `BadgeTone` `info`/`caution`/`critical`** — matching the template's own `R = { Bajo: info, Medio: warn, Alto: err }` mapping (`Vaqcrow Explorar PyMEs.dc.html`). Since `BadgeTone` has no `success` member (Feature #17 design decision, still enforced), no risk level can read as success at the type level, not just by convention. The visible risk text (`riskLabel`) is still a required, caller-formatted string — the enum only selects tone/icon, never the words.
- **Revenue-share/risk `<dt>` labels ("Revenue share", "Riesgo") are fixed inside `CampaignCard`**, not caller props — they are the two column headers of one fixed `<dl>` layout lifted verbatim from the template's "Compuestos" card, while every `<dd>` value stays caller-formatted (`revenueShareTerms`, `riskLabel`). This mirrors `DistributionCalculation`'s established split between fixed structural labels ("Redondeo") and caller-formatted row content.
- **The optional `action` is a discriminated union (`{ label, href }` or `{ label, onPress }`)**, rendering HeroUI's own `Link` for the href case (matching the template's `<a>` CTA to the PyME detail page) or the shared `Button` for the onPress case (e.g. a "favorite" toggle) — never both on one instance, so the component never has to guess which the caller means.

### Progress (2026-09-27)

T1 complete: `KpiTile`, `CampaignCard` implemented under `apps/web/src/presentation/components/` with strict TDD (RED confirmed via missing-module import failures for both; GREEN confirmed after implementation — `KpiTile` clean on the first pass, `CampaignCard` needed one test-only fix for a text collision, plus two REFACTOR-phase `exactOptionalPropertyTypes` fixes, the same recurring #306 gotcha). Both compose existing shared primitives (`Badge`, `ProgressBar`, `Button`, HeroUI's `Link`) rather than duplicating their behaviour. Each has a Storybook story (`Datos/KpiTile`, `Datos/CampaignCard`) using only synthetic data — `CampaignCard`'s stories reuse the frozen `panaderiaHorizonte` fixture (Feature #17) for the SME identity fields, with fictional revenue-share/risk/close-date strings consistent with the template's own synthetic campaigns; presentation importing `application/fixtures` is unrestricted by `.dependency-cruiser.cjs` (confirmed by reading the config), matching the existing precedent in `assessment-workspace.tsx`. Full verification matrix above; every command passed clean on this run, no timeout flake in either `pnpm run test` or `pnpm run test:boundaries`.

### Open questions

None. No new trust wording was needed: `KpiTile`/`CampaignCard` use only caller-supplied strings (never reading `disclosures.ts`/`microcopy` directly), and the one recurring literal ("SIMULADO") already exists as an established, reused literal across the codebase (`Badge`, `SyntheticValue`, `panaderia-horizonte.ts`'s `SIMULADO_LABEL`), not a text this task introduced.

### T2 — RED→GREEN

| Component | RED (before implementation) | GREEN (after implementation) |
| --- | --- | --- |
| `BarChart` | `Failed to resolve import "./bar-chart"` — module did not exist | 12/12 tests green on first implementation |
| `Timeline` | `Failed to resolve import "./timeline"` — module did not exist | 7/7 tests green on first implementation |

RED command: `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/bar-chart.test.tsx src/presentation/components/timeline.test.tsx` — both suites failed on the missing-module import before either component existed.
GREEN command: same command, `Test Files 2 passed (2)` / `Tests 19 passed (19)` after implementation — no component-side REFACTOR fix was needed for either.

One REFACTOR-phase `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes`-adjacent fix, test-only: `timeline.test.tsx` indexed `screen.getAllByRole("listitem")[n]` and passed the result straight into `within(...)`, which types as `HTMLElement | undefined` under this project's strict `tsconfig`; `within()`'s parameter is typed `HTMLElement`, not `HTMLElement | undefined`, so `pnpm run typecheck` (not the RED/GREEN vitest run, which has no such check) caught it. Fixed with a non-null assertion (`items[0]!`) at each of the four call sites — the array length is fixed by the local `STEPS` fixture, so the assertion is safe. No `bar-chart.test.tsx` fix was needed.

### T2 — Verification matrix

| Command | Result |
| --- | --- |
| `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/bar-chart.test.tsx src/presentation/components/timeline.test.tsx` | 2 files / 19 tests passed |
| `pnpm run lint` | 0 errors (same pre-existing unrelated warning in `fetch-http-client.ts` as T1/#306/#310) |
| `pnpm run typecheck` | passed, 8/8 tasks (after the `timeline.test.tsx` non-null-assertion fix above) |
| `pnpm run test` | 94/94 files, 615/615 tests passed — no timeout flake this run |
| `pnpm run build` | 5/5 tasks passed |
| `pnpm --filter @vaqcrow/web build-storybook` | built successfully (`bar-chart.stories`, `timeline.stories` both compiled); `storybook-static/` deleted afterwards |
| `pnpm run boundaries` | no dependency violations (424 modules, 1239 dependencies cruised) |
| `pnpm run test:boundaries` | first run: 2 of 83 tests hit the documented host-load 5000 ms timeout (`Stellar SDK split across workspaces > resolves both SDKs...` and `boundary fixtures stay outside build/typecheck/boundaries globs > the real boundaries script glob...`, both pre-existing `tests/boundaries.test.ts` scaffolding tests unrelated to this task's files); re-run via `pnpm run test:boundaries` again reproduced a different pair timing out (confirms "different each run" per the known-flake note); re-run once more in isolation, `npx vitest run tests/boundaries.test.ts` from the repo root, gave 25/25 passed in 10.4 s with no timeout |

`apps/web/postcss.config.mjs` and `apps/web/AGENTS.md` were checked after `build-storybook`; neither was rewritten this run.

### T2 — Design decisions

- **Dataviz skill invoked before writing any chart code, per this task's instruction.** Read `choosing-a-form.md`/`color-formula.md`/`marks-and-anatomy.md` guidance inline; ran `scripts/validate_palette.js` against the project's own existing `--color-chart-*` tokens (`globals.css`, Feature #17) rather than choosing new ones, per the explicit "use those — do not introduce a new palette" instruction. Light-mode `--color-chart-primary`/`--color-chart-anomaly` (`#2563eb`/`#b91c1c`) pass every categorical check cleanly (lightness, chroma, CVD separation ΔE 31.3/36.2, contrast). `--color-chart-missing` (`#94a3b8`) is a low-chroma neutral absence marker, not a categorical series colour, so it was checked as a lone status colour instead of run through the categorical validator: its ~2.5:1 contrast against the canvas is below the ~4.5:1 needed for body text, so `BarChart` uses it only for the placeholder's decorative dashed border/background, never for the "Sin dato" text itself (`text-muted` is used there — an existing, already-proven-contrast token). Dark-mode `--color-chart-primary`/`--color-chart-anomaly` (`#a9ccff`/`#ffb3ae`, light pastels sized for a dark surface) fail the validator's categorical lightness/chroma bands but pass CVD separation, the normal-vision floor and surface contrast; since they are pre-existing Feature #17 tokens out of this task's scope to change, and `BarChart` already carries the required secondary encoding (the visible "Atípico" text marker, never colour alone) for the one case (`anomalous`) where that pair's identity matters, this was accepted as-is rather than reworked.
- **No legend.** `BarChart` is always a single series (one bar per period); per the skill's own rule, "a single series needs no legend box — the title names it." Status (`missing`/`anomalous`) is conveyed by direct visible text markers ("Sin dato"/"Atípico") instead, both in the aria-hidden visual and in the accessible table's Estado column — never colour alone, matching the skill's "status colors ship with icon + label" rule and this codebase's existing "no success-only-by-colour" convention.
- **The accessible table sits inside a collapsed `<details><summary>Ver tabla accesible</summary>`**, matching the template's own markup exactly (`Vaqcrow Sistema.dc.html`'s "Ventas mensuales" card) rather than always-visible — the task text offered either option contingent on what the skill said, and the skill's own accessibility pass only requires "a table view exists," not that it be undisclosed by default; `<details>` content is still present in the DOM (and in the accessibility tree) regardless of its open/closed state, so nothing is hidden from assistive tech, only from the default visual layout.
- **The visual bar chart is one `aria-hidden="true"` region** (mirroring `Skeleton`'s established "aria-hidden ancestor removes the whole subtree" pattern from #310/T1) with the accessible `<table>` as its complete text alternative — not per-element `aria-hidden`, and not a second parallel set of `aria-live`/`aria-label` wiring on the visual bars themselves.
- **Missing points never render a zero-height bar.** A `missing` point swaps the bar for a fixed-height dashed placeholder box with "Sin dato" text, structurally distinct from a real (if small) bar — this was a hard requirement in the task text and is asserted directly by a RED→GREEN test (`queryByText(/^\$?\s?0$/)` absent).
- **The grow animation is a CSS-only `motion-reduce:transition-none` Tailwind variant**, not a JS-computed toggle like `Skeleton`'s `usePrefersReducedMotion` hook (#310/T1). `Skeleton` needed JS because it also picks HeroUI's `animationType` prop value; `BarChart`'s bars are plain `<div>`s with a CSS `height` transition, so Tailwind's built-in `prefers-reduced-motion` media-query variant covers the requirement with no extra hook, matching the project's own "CSS-only backstop" pattern already documented in `globals.css` for `Skeleton`. The test asserts the utility class is present rather than mocking `matchMedia`, since there is no JS state to assert against.
- **`BarChart`'s heading level is configurable (`headingLevel?: 2 | 3 | 4 | 5 | 6`, default 3)**, reusing `CampaignCard`'s (#314/T1) exact `HEADING_TAGS` pattern for API consistency across `Datos/*` components — not a literal task requirement, but a small, low-risk extension of an already-established pattern in this same component family.
- **`Timeline` is vertical-only.** The template has a second, horizontal stepper variant (`Vaqcrow Onboarding PyME.dc.html`), but it uses a materially different layout (a flex row with per-item `flex`-sized segments and an inline horizontal connecting bar between circular nodes) rather than this component's `<ol>` grid with a vertically-stacked connecting line — adding both was judged not "cheap" per the task's own conditional instruction, so only vertical was built. Recorded here per that instruction, rather than left implicit.
- **`Timeline`'s `done`/`current` dot colours reuse the existing `--color-trust-*` tokens** (`trust-neutral`/`trust-info`), not a new "success" green — consistent with this codebase's standing rule (Feature #17/#310) that no `BadgeTone` has a `success` member. `done` is conveyed by its checkmark icon plus the visible "Completado" text, never colour alone; `current` is bold-weighted text plus "Paso actual", also never colour alone.
- **State text is always visible** ("Completado"/"Paso actual"/"Pendiente"), not `sr-only` — the task offered either; visible was chosen so a sighted user (including a colourblind one, per the dataviz skill's own non-negotiable) never has to rely on the dot's colour alone to tell `done` from `current` from `pending`.

### Progress (2026-09-27)

T2 complete: `BarChart`, `Timeline` implemented under `apps/web/src/presentation/components/` with strict TDD (RED confirmed via missing-module import failures for both; GREEN confirmed after implementation on the first pass for both components — the only REFACTOR-phase fix was a test-only `noUncheckedIndexedAccess` non-null assertion in `timeline.test.tsx`, caught by `typecheck`, not by the RED/GREEN vitest run). The `dataviz` skill was read and applied before any chart code was written, per this task's explicit instruction; its `validate_palette.js` was run against the project's own pre-existing `--color-chart-*` tokens rather than any new palette (see design decisions above for the light/dark results). Both components compose no new npm dependency — `BarChart`'s bars are plain SVG-free CSS (`<div>`s sized by inline `height` percentage), matching `apps/web/package.json`'s existing dependency set (no charting library present or added). Each has a Storybook story (`Datos/BarChart`, `Datos/Timeline`) using only synthetic data — `BarChart`'s story maps the frozen `panaderiaHorizonte` fixture (Feature #17) directly to `BarChartPoint[]`, reusing its `status` field verbatim and its canonical `microcopy.salesSynthetic` notice text for the `WithNotice` story; `Timeline`'s story uses literal demo-step copy consistent with the template's own "Recorrido de la demo"/"nextSteps" text, not sourced from any canonical constant (none exists for this generic step-copy). Full verification matrix above; `pnpm run test` was clean with no timeout flake, `pnpm run test:boundaries` hit the documented pre-existing host-load flake on two `tests/boundaries.test.ts` scaffolding tests unrelated to this task's files (confirmed clean in isolation, 25/25).

### T2 — Open questions

None. No new trust wording was needed: `BarChart`'s `notice` slot is caller-supplied (the story passes `microcopy.salesSynthetic` verbatim; the component never hardcodes it), and `Timeline`'s status/step copy ("Completado", "Paso actual", "Pendiente") is ordinary UI microcopy, not a trust disclosure sourced from `docs/planning/DEMO.md` §12 or `demo-ui.md` §2 — no canonical constant exists or was needed for it.

### T3 — RED→GREEN

| Component | RED (before implementation) | GREEN (after implementation) |
| --- | --- | --- |
| `TransactionStatusList` | `Failed to resolve import "./transaction-status-list"` — module did not exist | 11/11 tests green on first implementation; 12/12 after the parent's contrast fix added one more test |

RED command: `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/transaction-status-list.test.tsx` — the suite failed on the missing-module import before the component existed.
GREEN command: same command, `Test Files 1 passed (1)` / `Tests 12 passed (12)`.

### T3 — Verification matrix

| Command | Result |
| --- | --- |
| `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/transaction-status-list.test.tsx` | 1 file / 12 tests passed |
| `pnpm run lint` | 0 errors (same pre-existing unrelated warning in `fetch-http-client.ts` as T1/T2/#306/#310) |
| `pnpm run typecheck` | passed, 8/8 tasks |
| `pnpm run test` | 95/95 files, 627/627 tests passed — no timeout flake this run |
| `pnpm run build` | 5/5 tasks passed |
| `pnpm --filter @vaqcrow/web build-storybook` | built successfully (`transaction-status-list.stories` compiled); `storybook-static/` deleted afterwards |
| `pnpm run boundaries` | no dependency violations (427 modules, 1248 dependencies cruised) |
| `pnpm run test:boundaries` | 7 files / 83 tests passed — no timeout flake this run |

`apps/web/postcss.config.mjs` and `apps/web/AGENTS.md` were checked after `build-storybook` — neither was rewritten this run.

### T3 — Design decisions

- **No new state colour exists, and none was invented.** There is no `success` `BadgeTone` and no `--color-ok-*` token (Feature #17 decision, still enforced), so `sent`/`confirmed`/`failed` map onto `trust-caution`/`trust-info`/`trust-critical`. The template's `--ok-s`/`--warn-s`/`--err-s`/`--text2`/`--control` tokens do not exist here at all and were not introduced.
- **The state colour lives on the surface and the icon, never on a text run** (parent correction, see the accessibility finding below). The `<li>` carries the tint and border; the icon carries the colour; the label and detail inherit the page foreground. This is exactly what `Timeline` (#314/T2) already does with its coloured dot and neutral text, so the family stays consistent.
- **The canonical pending sentence is owned by the component, not the caller.** `microcopy.submittedNotConfirmed` is imported from `@/application/trust/disclosures` and rendered only for `sent` — never a prop, never retyped. The test imports `microcopy` and asserts the same constant, so the assertion cannot drift from the source. This is the `StepTrustDisclosures` precedent (a component rendering canonical copy directly), not `KpiTile`'s caller-supplied-strings precedent.
- **`aria-live="polite"` sits on a plain `<ol>`**, not routed through a HeroUI component — HeroUI v3 drops some ARIA props (the recurring #306/#310 gotcha), so the attribute is asserted present in the DOM by a test.
- **`HashDisplay` is deliberately not composed.** The API exposes no transaction-hash prop, and the only hash-like value in the template markup is a caller-formatted *account* label inside `detail`. Composing it would add surface this component never renders. Recorded in the module doc.
- **The template's terminal chips were folded into the list.** The template draws its third `<ol>` item muted/dashed while waiting for Horizon and prints the real outcomes in a separate chip grid ("Confirmada. Ledger …" / "Fallida. Saldo insuficiente"). Issue #314 fixes the list itself as signed → sent-pending → confirmed, so `confirmed`/`failed` became list states; a caller that has not yet seen confirmation omits the `confirmed` item, and appending it is what `aria-live` announces.
- **`headingLevel` reuses the `HEADING_TAGS` pattern** from `CampaignCard`/`BarChart` verbatim (default `3`), keeping `Datos/*` APIs consistent.

### T3 — Accessibility finding (parent spot check, fixed before commit)

The first implementation gave the `<li>` a `text-trust-*` colour and put the detail line at `opacity-80`, both inherited from the `Badge` tone vocabulary. Measured over the state's own `/10` tint in light mode, that lands under the 4.5:1 AA floor this issue requires for 13–14px text:

| State | state colour as text on its own `/10` tint | detail at `opacity-80` | page foreground on the same tint |
| --- | --- | --- | --- |
| `signed` | 6.52 ok | 4.11 fail | 16.25 |
| `sent` | 4.38 fail | 3.19 fail | 16.48 |
| `confirmed` | 4.50 fail (borderline) | 3.27 fail | 16.44 |
| `failed` | 5.46 ok | 4.10 fail | 15.95 |

Fix: the tint/border/icon keep the state colour and every text run inherits the page foreground, with the `opacity-80` dropped; hierarchy is carried by weight and size instead. A regression test scans every element for an `opacity-*` utility and asserts the sent item recolours no text, so the pattern cannot come back silently.

**Out of scope, not fixed here:** `Badge` (`badge.tsx`) has the same `bg-trust-X/10 text-trust-X` pairing, so `caution`/`info` badges measure 4.38:1 / 4.50:1 as text. That is pre-existing Feature #17 code, not this task's, and changing the shared `TONE_CLASSES` would touch every badge in the app — it belongs in its own change.

### T3 — Open questions

None. No new trust wording was needed: the only canonical text this component renders is `microcopy.submittedNotConfirmed`, which already exists; the per-state labels ("Firmada en Freighter", "Enviada · pendiente de confirmación", "Confirmada en el ledger", "Fallida") are ordinary UI microcopy, the same category as `Timeline`'s "Completado"/"Paso actual".

### Progress (2026-09-27)

T3 complete: `TransactionStatusList` implemented under `apps/web/src/presentation/components/` with strict TDD (RED confirmed via a missing-module import failure; GREEN on the first implementation pass at 11/11, then 12/12 after the parent's contrast fix). The component renders the signed → sent → confirmed progression with `aria-live="polite"`, folds the template's terminal chips in as `confirmed`/`failed`, owns the canonical `microcopy.submittedNotConfirmed` sentence, and keeps every text run on the page foreground so the state colour can never push contrast under AA. Story `Datos/TransactionStatusList` with six stories on synthetic data. `docs/guides/storybook.md`'s coverage table gained the whole missing `Datos/*` group (KpiTile, CampaignCard, BarChart, Timeline, TransactionStatusList) — the group had no rows at all before this task. Full verification matrix above; every command passed clean, no timeout flake in `pnpm run test` or `pnpm run test:boundaries`.

## Next step

T3 committed; assess for review, then open PR 3 (closes #314). After that: template step 4 (navigation), step 5 (overlays, transaction-review modal first), then adoption in the six demo routes.
