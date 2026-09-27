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
- [ ] T2 — `BarChart` with accessible table, `Timeline` (tests, stories)
- [ ] T3 — `TransactionStatusList`; guide; full matrix

Route: delegated direct (writer trigger: 2+ non-trivial files per task).

## Acceptance criteria

- [ ] Each component covers the states listed in #314 and renders in light and dark
- [ ] Each component has a unit test and a Storybook story
- [ ] Trust copy only from canonical constants; the consistency guard passes
- [ ] `lint`, `typecheck`, `test`, `build`, `build-storybook`, `boundaries`, `test:boundaries` pass

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

## Next step

Commit T1, assess for review, open PR 1.
