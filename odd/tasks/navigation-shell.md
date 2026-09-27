# Navigation shell

Iteration log for issue #318, branch
`Vaqcrow#318_Task_Build_the_navigation_shell_from_the_Claude_Design_system`.

## Objective

Step 4 of the Claude Design template build order: the navigation shell as shared presentational
components — a fixed header (brand + `DEMO` + `TESTNET` + primary navigation), an account/user menu and
a footer carrying the canonical "No apto para producción" disclosure — each with a unit test and a
Storybook story in both themes.

## Problem

The template (`docs/design/template/`, git-ignored) repeats the same header across 13 of its 15 screens
and the same compact footer across every product screen. `apps/web` has **no navbar, footer, sidebar or
account menu** today: the only persistent chrome is `DemoEnvironmentHeader` (brand + badges + theme
switcher), rendered by `DemoShell` from `apps/web/src/app/(demo)/layout.tsx`. Nothing carries the
canonical "No apto para producción" disclosure in the app's own chrome.

## Why

Build order derived from the template inventory (2026-09-26): primitives (#306), feedback + trust
(#310), data display (#314), then navigation, then overlays, then adoption in the six demo routes.
`claude-design-brief.md` fixes this step as the one that makes every later view inherit one source of
truth: *"establish the system and the shell so every later view inherits one source of truth"*, with the
acceptance criterion *"El shell tiene encabezado fijo con marca + `DEMO` + `TESTNET` y footer con «No apto
para producción»"*.

## Scope

In: `DemoNavbar`, `SiteFooter`, `AccountMenu`, their tests and stories; the `Navegación/*` rows in
`docs/guides/storybook.md`.

Out, and explicitly decided with the owner (2026-09-27):
- **The admin panel's sidebar.** The only sidebar in the corpus is `Vaqcrow Admin.dc.html`, and
  `demo-ui.md` §"Navegación global" states the administration panel uses a **separate** navigation
  (`Gestión de PyMEs`, `Solicitudes`, `Usuarios`). It is not a surface the six demo routes reach.
- **The SME-onboarding horizontal stepper** (`Vaqcrow Onboarding PyME.dc.html`) — the same variant
  deliberately deferred in #314/T2, for the same reason: a materially different layout, and its screen is
  not in the six-route demo flow.
- Adopting the shell in the six demo routes, replacing `DemoEnvironmentHeader`, palette/accent changes,
  new trust wording. Adoption is step 6.

## Constraints

- Trust copy only from `apps/web/src/application/trust/` — the footer notice is the existing canonical
  disclosure, never retyped. No new wording.
- Meaning never only in colour; the active nav link carries `aria-current="page"` **and** a visible
  underline. WCAG 2.2 AA.
- Presentational only: labels, links, active state and session state are props; no network, no storage,
  no routing decisions inside the components.
- Tokens only from `globals.css` + `@heroui/styles`. The template's `--control`, `--raised`,
  `--accent-tint`, `--accent-text`, `--on-accent`, `--logo` and the `--ok-*`/`--warn-*`/`--err-*` pairs do
  not exist here. **Collision to watch:** the template's `--accent` is the purple brand
  (`--color-brand-accent`), while HeroUI's `--color-accent` is blue.
- Gotchas from #306/#310/#314, all still current: HeroUI v3 drops some ARIA/role props;
  `exactOptionalPropertyTypes` (conditional spreads, never `undefined` into an optional prop — including
  Storybook `args`); `noUncheckedIndexedAccess`; `apps/web/storybook-static/` must be deleted after
  `build-storybook` or `eslint .` breaks.
- Tests must not depend on focus-trap or portal behaviour jsdom cannot model. Assert observable DOM and
  ARIA state; for outside-click and `Escape`, drive real events and assert the resulting ARIA state and
  focus, not an internal flag.
- TDD: strict, runner `pnpm --filter @vaqcrow/web exec vitest run <path>`.
- ~400 authored lines per task is advisory only.

## Delivery

`stacked-to-main`, reused from the owner's choice for #306/#310/#314. Slices:

| PR | Branch suffix | Contents |
| --- | --- | --- |
| 1 | *(this branch)* | `DemoNavbar` + `SiteFooter` — the static shell |
| 2 | `-02-account-menu` | `AccountMenu` — the interactive account menu |

Forecast: ~450 authored lines for PR 1, ~430 for PR 2 — both near the advisory budget, and the native
review will fire on `slice_budget_reached`. If either lands materially over, the slice splits rather than
the PR growing.

## Tasks

- [x] T1 — `DemoNavbar` + `SiteFooter` (tests RED→GREEN, stories, guide rows)
- [x] T2 — `AccountMenu` (tests, story, guide row)

Route: delegated direct (writer trigger: 2+ non-trivial files per task).

## Acceptance criteria

- [ ] The header carries the brand, the `DEMO` badge, the `TESTNET` badge and a primary navigation whose
      active link is marked with `aria-current="page"` plus a visible non-colour cue
- [ ] The primary navigation collapses on small screens while `TESTNET` stays visible
- [ ] The account menu exposes `aria-haspopup`/`aria-expanded`, a `role="menu"` panel, closes on outside
      click and on `Escape`, and returns focus to its trigger
- [ ] The footer renders the canonical "No apto para producción" disclosure from the shared constants,
      plus the legal row
- [ ] Each component has a unit test and a Storybook story, rendering in light and dark
- [ ] Trust copy only from canonical constants; the consistency guards pass
- [ ] `lint`, `typecheck`, `test`, `build`, `build-storybook`, `boundaries`, `test:boundaries` pass

## Verification evidence

### T1 — `DemoNavbar` + `SiteFooter` (2026-09-27)

- Work-unit implementation commit: `f869bb8` (`feat(web): add static navigation shell`).

#### Reconciliation and TDD

- Reconciled the cancelled writer's uncommitted implementation, tests, stories, guide rows and this log.
  The implementation already met the static-shell scope, so it was preserved; the only follow-up change
  strengthened the disclosure test to assert the nav's actual visibility classes, not only its state marker.
- No preserved runner output established an earlier RED phase. Reconstructed RED for that missing
  observable contract by holding the primary nav in `hidden` after the disclosure click. The focused suite
  failed exactly one test: `DemoNavbar > collapses behind a real disclosure and toggles both aria-expanded
  and the nav state`, because the open nav still had the `hidden` class.
- Restored the state-driven `isOpen ? "flex" : "hidden"` implementation. GREEN:
  `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/demo-navbar.test.tsx src/presentation/components/site-footer.test.tsx`
  — 2 files, 16 tests passed.

#### Decisions and deviations

- `DemoNavbar` is a client component only for its narrow-screen disclosure. It owns no route, storage or
  network decision: caller props provide item labels, `href`s and the active item; the optional `actions`
  `ReactNode` slot is reserved for T2's `AccountMenu`.
- The active link has both `aria-current="page"` and the visible `border-b-2` underline. The disclosure
  button is plain DOM with `aria-expanded` and `aria-controls`; its target toggles `data-state` and
  `hidden`/`flex`, so the DOM visibility change is testable without relying on HeroUI ARIA forwarding.
- No usable Vaqcrow logo asset exists in `apps/web` (including no `apps/web/public/`), so the navbar uses
  a wordmark only. No image was fabricated.
- The template's purple accent maps to `border-brand-accent`; HeroUI blue `border-accent` is not used.
  The footer uses real `bg-surface` and `border-border` tokens.
- `SiteFooter` renders the canonical disclosure id `no-production` through `CanonicalDisclosure`; it does
  not accept or duplicate the text. Its story supplies `microcopy.testnetBadge`, not the template's
  noncanonical `Stellar Testnet · …` wording.
- Added exactly two Storybook guide rows: `Navegación/DemoNavbar` and `Navegación/SiteFooter`. Stories use
  `@storybook/nextjs-vite`, exact required titles and `satisfies Meta<typeof X>`.

#### Required checks

| Command | Observed result |
| --- | --- |
| `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/demo-navbar.test.tsx src/presentation/components/site-footer.test.tsx` | GREEN: 2 files, 16 tests passed |
| `pnpm run lint` | Passed: 5 tasks successful; one pre-existing warning in `apps/web/src/infrastructure/http/fetch-http-client.ts` (`_request` unused) |
| `pnpm run typecheck` | Passed: 8 tasks successful |
| `pnpm run test` | Passed: 8 tasks successful; web 97 files/643 tests, API 37 files/686 tests |
| `pnpm run build` | Passed: 5 tasks successful; Next.js compiled and generated 9 static pages |
| `pnpm --filter @vaqcrow/web build-storybook` | Passed: Storybook completed successfully; emitted known Vite `use client` and chunk-size warnings |
| Storybook cleanup | Deleted `apps/web/storybook-static/`; confirmed `apps/web/postcss.config.mjs` and `apps/web/AGENTS.md` unchanged |
| `pnpm run boundaries` | Passed: 433 modules and 1269 dependencies, no violations |
| `pnpm run test:boundaries` | Passed first run: 7 files, 83 tests; no host-load timeout, so no retry was needed |

#### Merge evidence

- PR #319 (`DemoNavbar` + `SiteFooter`) merged into `main` at `4a32553`; all CI checks were green
  (quality gates, Playwright, contracts and Vercel preview comments).

### T2 — `AccountMenu` (2026-09-27)

#### TDD

- RED: `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/account-menu.test.tsx`
  failed before implementation with `Failed to resolve import "./account-menu" from
  "src/presentation/components/account-menu.test.tsx". Does the file exist?`.
- GREEN: the same focused command passed with 1 file and 6 tests after implementing the component.

#### Decisions

- `AccountMenu` is presentational and caller-owned: `name`, optional `subtitle`, optional `avatarSrc`,
  and a readonly list of link/action items are props. It owns no route, network, storage or session state.
- The menu trigger is a native `button type="button"` with the critical `aria-haspopup`,
  `aria-expanded` and open-only `aria-controls` directly on the DOM. The panel and entries use native
  `role="menu"` and `role="menuitem"`; links remain anchors and actions remain buttons.
- Escape closes the panel and returns focus to the trigger. A document `pointerdown` closes it only when
  the event target is outside the relative wrapper. Selection invokes the optional callback and closes.
- With no items, the component renders the shared Avatar plus account identity as non-interactive text:
  no empty trigger and no menu panel. Avatar initials/image fallback remains delegated to `Avatar`.
- The panel is absolutely positioned inside a relative wrapper. It uses existing semantic tokens and no
  portal, focus trap, timer or popover dependency.
- Added `Navegación/AccountMenu` to the Storybook guide. Its stories cover the normal account, no
  subtitle, intentionally invalid image fallback, long name and a `play`-opened visual panel state.

#### Required checks

| Command | Observed result |
| --- | --- |
| `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/account-menu.test.tsx` | GREEN: 1 file, 6 tests passed (jsdom reports its expected non-fatal "Not implemented: navigation to another Document" message after the link click) |
| `pnpm run lint` | Passed: 5 tasks successful; one pre-existing warning in `apps/web/src/infrastructure/http/fetch-http-client.ts` (`_request` unused) |
| `pnpm run typecheck` | Passed: 8 tasks successful |
| `pnpm run test` | Passed: 8 tasks successful; web 98 files/649 tests, API 37 files/686 tests |
| `pnpm run build` | Passed: 5 tasks successful; Next.js compiled and generated 9 static pages |
| `pnpm --filter @vaqcrow/web build-storybook` | Passed: Storybook completed successfully; emitted known Vite `use client` and chunk-size warnings |
| Storybook cleanup | Deleted `apps/web/storybook-static/`; confirmed `apps/web/postcss.config.mjs` and `apps/web/AGENTS.md` unchanged |
| `pnpm run boundaries` | Passed: 437 modules and 1277 dependencies, no violations |
| `pnpm run test:boundaries` | Passed first run: 7 files, 83 tests; no host-load timeout, so no retry was needed |

## Next step

T2: implement `AccountMenu` in the stacked `-02-account-menu` slice. Do not adopt these shell components
into routes until the separate adoption step.
