# Adopt the Claude Design shell and transaction-review modal in the demo routes

Iteration log for issue #323, branch
`Vaqcrow#323_Task_Adopt_the_Claude_Design_shell_and_transaction_review_modal_in_the_demo_routes`
(slice 2 stacked on `-02-review-modal-in-funding`).

## Objective

Step 6 of the Claude Design template build order: adopt the shared components built in steps 1–5 in the
six demo routes. The navigation shell (`DemoNavbar`, `SiteFooter`, `AccountMenu`) replaces today's
chrome in the `(demo)` route-group layout, and the `TransactionReviewModal` gates the Freighter
signature in the funding route, so the demo looks and behaves like the template.

## Problem

Steps 1–5 are merged (primitives #306, feedback/trust #310, data #314, navigation shell #318,
transaction-review modal #321) and exercised only in Storybook — **no route uses them yet**.
`(demo)/layout.tsx` → `DemoShell` → `DemoEnvironmentHeader` (brand + badges + theme switcher), step
heading, `DemoProgress`, page, `DemoStepNav`; no footer, so the canonical "No apto para producción"
disclosure is missing from the app chrome. `funding` (`campaign-workspace.tsx`) signs inline: "Aportar"
calls `contribute` straight away, breaking `claude-design-brief.md:218` (*"ninguna acción abre Freighter
sin intención legible y confirmación explícita"*).

## Why

- `docs/design/claude-design-brief.md:218` (review before signing) and `:572` (submitted is never shown
  as confirmed).
- `docs/design/demo-ui.md:1173` (Pantalla 4: acknowledgement, wrong network blocks signing) and §8
  (pantallas 2–6).
- Issue #323's functional/technical requirements; the template source is
  `docs/design/template/Vaqcrow Onboarding PyME.dc.html` (git-ignored).

## Scope

In:
- Slice 1 — shell adoption in `(demo)`: `DemoShell` renders `DemoNavbar` + `SiteFooter`; `AccountMenu`
  and the theme switcher live in the navbar's actions slot; `DemoEnvironmentHeader` is retired.
- Slice 2 — `TransactionReviewModal` gates the funding signature in `campaign-workspace.tsx`.

Out (decided by the issue, not re-litigated):
- The modal in `distribution` (belongs to #28 / #89–#91), the filter drawer, the pages outside the six
  demo routes, new trust wording, palette/accent changes.
- Wiring only: no new visual components. Gaps found in the step 1–5 components are **recorded, not
  patched ad hoc**.

## Constraints

- Trust copy only from `apps/web/src/application/trust/`. The `prohibited-terms` guard and the
  disclosure/consistency guards keep passing on all six routes.
- Layering: `presentation/` keeps type-only contract imports; wallet access stays in
  `infrastructure/wallet`.
- Existing route/component tests updated, not deleted; the Playwright E2E keeps passing (selectors
  adjusted where the chrome/flow changed).
- TDD: strict — runner `pnpm --filter @vaqcrow/web exec vitest run <path>`; RED before GREEN.
- ~400 authored changed lines per task is advisory only.

## Delivery

Two stacked slices, as the issue suggests: slice 1 in the base branch; slice 2 in
`…-02-review-modal-in-funding`, stacked on slice 1. Forecast ~150 (slice 1) + ~200 (slice 2) authored
lines; each slice stays under the 400-line review budget, so neither splits further.

## Decisions

- **D1 — `DemoEnvironmentHeader` is removed.** The navbar renders brand + `DEMO` + `TESTNET` and the
  theme switcher drops into its `actions` slot, so the header has nothing left to cover. Its unit test
  is removed with it (a removed component has no test); this is the allowed "removed" branch of the
  issue, not a deleted test hiding a failure.
- **D2 — `AccountMenu` is non-interactive (`items={[]}`).** Name `Sesión de demostración`, subtitle
  `Inversor` (owner decision 2026-09-28; the template's `userRole` for the investor is `INVERSOR`). There
  is no real session, so no person name and no "Cerrar sesión" — no auth claims. No nav/auth copy is
  invented.
- **D3 — `SiteFooter` legal row reuses existing strings:** `copyright="Vaqcrow · 2026"` (owner decision
  2026-09-28: the "Trabajo Fin de Máster" marker is dropped from the demo chrome) and
  `environment={microcopy.testnetBadge}`.
- **D4 — Nav items are the six `demoSteps` labels verbatim** (English), current one marked
  `aria-current="page"` by the navbar. No translated labels are introduced.
- **D5 — One error owner at a time.** While the review modal is open it owns the contribute/signing
  failure; the workspace `errorBanner` does not re-render that same error (it stays for every other
  operation and for failures outside a review). Wallet state mapping (existing canonical copy only):
  - `wallet_rejected` → `signingStatus: "signature-rejected"` + the canonical
    `campaignVaultErrorOfKind("wallet_rejected").message`.
  - `wallet_network_mismatch` → `isWrongNetwork: true` + `microcopy.wrongNetwork` (`demo-ui.md:1173`).
  - every other contribute failure (missing wallet, refused, unavailable, …) →
    `signingStatus: "verification-rejected"` + the canonical `error.message`.
  Recorded gap: `TransactionReviewModal` has no dedicated "wallet unavailable" state; `verification-
  rejected` is the closest existing prop, and inventing a state is out of scope.
  Consequence for the E2E: the wrong-network case now asserts the modal's canonical
  `microcopy.wrongNetwork` instead of the workspace banner's wallet message; the rejection/refused
  messages are unchanged, only relocated to the dialog.
- **D8 — The review's error is scoped by a baseline.** The review stores the `error` value observed when
  it opened and only treats a *different* error as its own, so a stale error from a previous operation
  never appears inside a fresh review.
- **D6 — No acknowledgement checkbox.** `demo-ui.md:1173`'s checkbox label is not in
  `application/trust/`; supplying it would be new copy, which the issue puts out of scope. Recorded gap.
- **D7 — Modal title reuses the existing form label** `Aportar a la campaña`, and the intent rows reuse
  field labels already present in the corpus: `Contrato de la bóveda` and `Cuenta de origen` from
  `microcopy.preSignCheck`'s own wording ("cuenta, red, el contrato de la bóveda, el activo y el
  monto"), plus `Función` with the literal operation `contribute`. No trust or marketing copy is added;
  field labels are not the trust corpus.

## Verification

- `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, `pnpm run build`, `pnpm run boundaries`,
  `pnpm run test:boundaries`.
- `pnpm --filter @vaqcrow/web run build-storybook` (delete `apps/web/storybook-static/` after).
- Playwright `apps/web/e2e/guided-journey.spec.ts` and `apps/web/e2e/campaign-vault.spec.ts` against the
  local stack.

## Tasks

Slice 1 — shell adoption:
- [x] T1.1 `DemoShell` renders `DemoNavbar` (items from `demoSteps`, `current` → `aria-current="page"`,
  `actions` = `ThemeSwitcher` + `AccountMenu`), keeps the step heading/`DemoProgress`/`DemoStepNav`, and
  renders `SiteFooter`.
- [x] T1.2 Retire `DemoEnvironmentHeader` (+ its test); nothing it showed is lost.
- [x] T1.3 Update `demo-shell.test.tsx`, `layout.test.tsx`, `trust-disclosures.integration.test.tsx` and
  the guided-journey E2E selectors for the new chrome.

Slice 2 — funding review:
- [x] T2.1 "Aportar" opens `TransactionReviewModal` with the real intent; the modal closes on Cancelar.
- [x] T2.2 "Firmar en Freighter" runs the existing `contribute`; the modal reflects signing / rejected /
  wrong-network, stays open while signing, never shows a signature as confirmed, and closes on success.
- [x] T2.3 Update `campaign-workspace.test.tsx` and the campaign-vault E2E (contribute + error paths).

Route: delegated direct (writer trigger: 2+ non-trivial files per slice).

## Progress

### Slice 1 — shell adoption (commit `b7ed356`)

Route: delegated direct (writer trigger: 2+ non-trivial files). Strict TDD RED→GREEN.

RED: `src/presentation/components/demo-shell.test.tsx` — `Unable to find an accessible element with the
role "navigation" and name "Principal"` (2 tests), before `DemoShell` rendered the navbar.

GREEN (observed):
- `vitest run src/presentation/components/demo-shell.test.tsx` → 3 passed.
- `vitest run "src/app/(demo)/trust-disclosures.integration.test.tsx"` → 7 passed.
- `vitest run "src/app/(demo)/layout.test.tsx"` → 1 passed (unchanged).
- `pnpm --filter @vaqcrow/web run test` → 98 files / 683 tests passed.
- `pnpm run verify` → 5 tasks successful; `dependency-cruiser` clean (438 modules); boundary fixture
  suite 7 files / 83 tests passed.
- `playwright test e2e/guided-journey.spec.ts` → 4 passed (self-hosted stub API + `next dev`, no Docker).

Gap recorded (not patched, per the issue): `TrustBanner` (`trust-banner.tsx:75`) renders an inner
`<header>` inside an `Alert.Root` that carries `role="note"`. Because `role="note"` is not sectioning
content, that `<header>` also maps to the ARIA `banner` role, so every disclosure banner — and now the
`SiteFooter`'s `no-production` disclosure — is an extra `banner` landmark. Multiple banners pre-existed
on the disclosure-bearing routes; the footer adds one more. The E2E/shell assertions scope to the
navbar's brand link instead of `getByRole("banner")`. Follow-up: give the disclosure title row a
non-landmark element (or `role="presentation"`).

Stale doc reference (out of `apps/web` scope): `docs/planning/trust-disclosures-and-synthetic-fixtures-evidence.md:119`
still names `DemoEnvironmentHeader`.

Review receipt (slice 1, advisory only): lineage `review-5aeddd0aee05796b`, risk medium (7 files / 330
lines), **approved** and acknowledged (authority burned). Two non-blocking advisories, recorded as
later work:
- **R3-1 (WARNING, guard weakened):** the per-route disclosure guard now uses presence
  (`getAllByText(...).length >= 1`) for `microcopy.testnetBadge` and the `no-production` text, which the
  footer chrome alone can satisfy, so a route-level disclosure regression would pass unnoticed.
- **R3-2 (SUGGESTION, wiring unproved):** `SiteFooter`'s `copyright`/`environment` wiring is not
  asserted (the copyright string is never checked; the footer's testnet badge is covered only by a
  presence check the navbar badge already satisfies).

### Slice 2 — funding review before signing (commit `613bc5e`)

Route: delegated direct (writer trigger: 2+ non-trivial files). Strict TDD RED→GREEN.

RED: `vitest run src/presentation/components/campaign-workspace.test.tsx` → 7 failed | 8 passed — the
seven modal-aware tests failed with `Unable to find an accessible element with the role "dialog"`.

GREEN (observed):
- `vitest run src/presentation/components/campaign-workspace.test.tsx` → 15 passed.
- `pnpm --filter @vaqcrow/web run test` → 98 files / 685 tests passed.
- `pnpm --filter @vaqcrow/web run typecheck` → clean; `lint` → 1 pre-existing unrelated warning.
- `playwright test e2e/campaign-vault.spec.ts` → 9 passed.
- `pnpm run verify` → 5 tasks successful; `dependency-cruiser` clean (438 modules); boundary fixture
  suite 7 files / 83 tests passed.
- `pnpm --filter @vaqcrow/web run build-storybook` → completed; `apps/web/storybook-static/` removed.

Deviations recorded:
- **Money stays a string.** The review stores `stroops` as the decimal-integer string `xlmToStroops`
  returns and `contribute` takes; a `bigint` state field would not typecheck.
- **Close-on-success uses render-time state adjustment, not an effect.** `eslint-plugin-react-hooks@7`
  raises `react-hooks/set-state-in-effect` as an error for a synchronous `setState` in an effect body,
  which the originally planned effect tripped. The conditional render-time adjustment is lint-clean and
  keeps the behavior: closes only on success, stays open on failure, never claims a confirmed signature.
- **The reverted-contribution test reads the background "Aportar" with `{ hidden: true }`**, because
  HeroUI's modal aria-hides the page behind it; the accessible "Aportar" is still covered by the
  three-chain-states test.

Review assessment (slice 2): `gentle-ai review assess --base-ref 3fc5d46 --committed-only` →
`risk: medium`, `changed_lines: 273`, `review_due: false`, `review_due_reason: "under_budget"`. Per the
ODD rule the commit stays pending in the slice until a later commit reaches the ~400-line budget; no
review was started for this slice, and the last reviewed boundary remains `3fc5d46`.

### Owner corrections + README (commit below)

Owner decisions 2026-09-28: the demo session is the investor (`Inversor`) and the footer drops the
"Trabajo Fin de Máster" marker (`Vaqcrow · 2026`). Both review advisories are closed in the same commit:

- **R3-1 resolved.** The disclosure guard went back to strict single-match assertions: each required
  text is scoped to the `Trust disclosures` region that `StepTrustDisclosures` owns, and the chrome
  Testnet badge is scoped to the navbar header instead of counting matches. One route-level exception is
  documented in the test: `microcopy.aiFallback` is rendered by the AI assessment standing banner beside
  the region, so it is asserted at route scope. Nothing counts matches anymore.
- **R3-2 resolved.** `demo-shell.test.tsx` now asserts the footer's caller-supplied copyright renders
  verbatim.

The `Trabajo Fin de Máster` string was also removed from the `SiteFooter` story args and the component's
JSDoc example, so no file still teaches it.

`README.md` gained a `Storybook (taller de componentes)` section: what the workshop is, how to run and
build it, why it is outside `pnpm run verify`, a link to the guide, and the honest cloud state (no
Storybook URL is published today; `vercel.json` builds only `@vaqcrow/web`, CI does not publish it, and
`storybook-static/` is git-ignored).

### Review of the corrections slice — NOT CLOSED (client runtime)

`gentle-ai review assess --base-ref 3fc5d46 --committed-only` on these commits returned
`risk: medium`, `changed_lines: 423`, `review_due: true`, `review_due_reason: "slice_budget_reached"`,
so the returned preflight was executed and a review was created (lineage
`review-639ee5569047c097`, target `sha256:e1013b94…`, base tree `cf4c893…`). The owner granted the
candidate consent.

The single selected lens slot (`review-reliability`, order 0) returned an EMPTY reviewer result three
times (`opencode_task_output_empty`). After each empty result the exact-lineage STATUS was re-queried and
it re-offered the same bound slot, so each relaunch was contract-legal; the third empty result ends the
retries. No acknowledgement was issued, nothing was marked PASS, and the review authority was not burned.

Per the review contract this is a client-runtime failure of the sub-agent (an empty sub-agent result),
not a candidate defect, so it is reported plainly here and no provider-defect report was filed. The
review remains pending: a later STATUS for lineage `review-639ee5569047c097` still offers the slot.
The work itself is not unverified — it carries the writer's foreground verification (`pnpm run verify`,
full Playwright 17 passed) and the parent's spot checks.



## Acceptance criteria (from issue #323)

- [x] The `(demo)` layout renders `DemoNavbar` (brand, `DEMO`, `TESTNET`, primary nav from the demo steps,
  current step `aria-current="page"`), keeps the theme switcher reachable via the actions slot, and
  renders `SiteFooter` with the canonical "No apto para producción" disclosure.
- [x] `AccountMenu` shows the simulated session context ("Sesión de demostración") and the role, from
  props; no auth claims.
- [x] Step heading, `DemoProgress` and `DemoStepNav` keep working; the nav collapses on small screens
  (container query) while `TESTNET` (navbar badge) and the current step (the shell `<h1>`) stay visible.
- [x] In `funding`, "Aportar" opens `TransactionReviewModal` with the real intent (amount + asset,
  network, vault contract, function `contribute`, source account, custody); "Firmar en Freighter"
  triggers the existing `contribute`.
- [x] The modal reflects the signing states, stays open while signing, and never shows a signature as
  confirmed; confirmation stays with the existing post-submit status UI (the campaign `<dl>`).
- [x] Wrong network, missing Freighter and rejection map onto the modal's props with existing canonical
  copy (`microcopy.wrongNetwork`, `microcopy.preSignCheck`, the canonical error messages).
- [x] Wiring only: no new visual components; changes stay in `app/(demo)/layout.tsx`, `DemoShell` and
  `campaign-workspace.tsx` (+ tests).
- [x] Trust copy only from `application/trust/`; `prohibited-terms` and disclosure/consistency guards pass
  on all six routes (full `pnpm run test`: 98 files / 685 tests).
- [x] Existing route/component tests updated, not deleted; the Playwright E2E passes (`guided-journey`
  4 passed, `campaign-vault` 9 passed).
- [x] `lint`, `typecheck`, `test`, `build`, `build-storybook`, `boundaries`, `test:boundaries` pass.

## Delivery outcome

Two stacked PRs, both under the 400-line review budget; the branch pair was reordered before pushing so that
each PR is internally coherent:

| PR | Branch | Base | Changed lines | Contents |
| --- | --- | --- | --- | --- |
| [#324](https://github.com/reyduar/Vaqcrow/pull/324) | `Vaqcrow#323_Task_…_in_the_demo_routes` | `main` | 347 | Slice 1 (shell adoption) + the owner copy corrections |
| [#325](https://github.com/reyduar/Vaqcrow/pull/325) | `…-02-review-modal-in-funding` | the shell branch | 394 | Slice 2 (funding review) + the README Storybook section |

**Reorder.** The owner corrections (`Inversor`, `Vaqcrow · 2026`) were first committed on the child branch,
which would have left the base PR shipping the copy the owner had just rejected. Before anything was pushed,
the corrections commit was cherry-picked onto the shell branch and the child was rebuilt on the new shell
tip, dropping the moved commit. The rebuilt child tip is **byte-identical** to the original one
(`git diff` between both tips is empty), so the verification evidence above is unchanged. The shell branch's
tree is a strict prefix: it contains no `campaign-workspace` change.

**Assessment (per PR, HEAD on the branch being measured).** Shell: medium, 347 lines, `under_budget`.
Funding: medium, 394 lines, `under_budget`. The combined stack against `main` is 673 lines and is
`slice_budget_reached` → `review_due`.

**Review state.** Owner decision 2026-09-28: leave the failing review pending for later. The combined
candidate's review (lineage `review-639ee5569047c097`) never closed — the single selected lens slot
(`review-reliability`, order 0) returned an empty result three times (`opencode_task_output_empty`); per the
review contract an empty sub-agent result is a client-runtime failure, so nothing was acknowledged, no PASS
was fabricated and the authority was not burned. No new review was started for either PR.

**Board.** Issue #323 moved to `In review` (the PRs are open and CI runs on them).




