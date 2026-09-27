# Transaction-review modal

Iteration log for issue #321, branch
`Vaqcrow#321_Task_Build_the_transaction_review_modal_from_the_Claude_Design_system`.

## Objective

Step 5 of the Claude Design template build order (overlays): the transaction-review modal ("Revisión
antes de firmar") as a shared presentational component, with unit tests and a Storybook story in both
themes, so that no action opens Freighter without a legible intent and an explicit confirmation.

## Problem

`apps/web` has no modal, dialog or drawer (`rg "Modal|Drawer|Dialog" apps/web/src` returns nothing).
The `funding` route signs inline with no confirmation step, and `distribution` is still a
`StepPlaceholder` that `docs/design/demo-ui.md` says reuses the same "transaction review pattern".

## Why

- `docs/design/claude-design-brief.md:218`: *"Revisión antes de firmar: ninguna acción abre Freighter sin
  intención legible y confirmación explícita"*; `:572`: *"Lo enviado nunca se ve confirmado"*;
  `:89`/`:183`: the system's single shadow is reserved for dialog/drawer.
- `docs/design/demo-ui.md:460` ("Revisión de transacción": intent, decoded XDR, network, source,
  destination, asset, amount, memo, timeout; states unsigned, signing, signed, verification rejected) and
  `:1173` (Pantalla 4: acknowledgement checkbox, wrong network blocks signing).
- Template sources (git-ignored): the live screen in `Vaqcrow Detalle PyME.dc.html:194-207` and the
  canonical spec sheet in `Vaqcrow Sistema.dc.html:393-410`.

## Scope

In: `TransactionReviewModal`, its tests and stories; the `Overlays/TransactionReviewModal` row in
`docs/guides/storybook.md`.

Out, decided with the owner (2026-09-27):
- The filter drawer (`Vaqcrow Explorar PyMEs.dc.html`): its screen is not one of the six demo routes —
  the same reason the admin sidebar and the onboarding stepper were deferred in #318.
- The admin confirm/notifications dialogs and the landing help popover, for the same reason.
- Adopting the modal in `funding`/`distribution` (step 6), XDR building/decoding, wallet access.

## Constraints

- Trust copy only from `apps/web/src/application/trust/`: `microcopy.preSignCheck`,
  `microcopy.testAssetNoValue`, `disclosures["non-custody"]`. No new wording; any template string absent
  from the constants is a caller-supplied prop or a recorded deviation, never retyped in the component.
- Presentational: every value, state and handler is a prop. A signed state never renders as confirmed or
  as a generic success.
- Built on HeroUI v3 `Modal` (3.2.6). Tokens only from `globals.css` + `@heroui/styles`; the template's
  `--accent` is the purple brand (`--color-brand-accent`), not HeroUI's blue `--color-accent`.
- Gotchas still current from #306–#318: HeroUI v3 drops some ARIA/role props; `exactOptionalPropertyTypes`
  (conditional spreads, including Storybook `args`); `noUncheckedIndexedAccess`;
  `apps/web/storybook-static/` must be deleted after `build-storybook` or `eslint .` breaks.
- Tests must not depend on focus-trap or portal behaviour jsdom cannot model; drive real events and
  assert DOM/ARIA state.
- TDD: strict (source: user global config "Strict TDD Mode: enabled"), runner
  `pnpm --filter @vaqcrow/web exec vitest run <path>`.
- ~400 authored lines per task is advisory only.

## Delivery

Strategy: `stacked-to-main`, reused from the owner's choice for #306/#310/#314/#318. Forecast ~450
authored lines (component ~180, tests ~180, stories ~80, guide row). One PR; if the running count lands
materially over the budget, the stories split into `-02-stories` instead of the PR growing.

## Tasks

- [x] T1 — `TransactionReviewModal`: component + tests (RED→GREEN), stories, guide row

Route: delegated direct (writer trigger: 2+ non-trivial files).

## Acceptance criteria

- [x] Eyebrow "Revisión antes de firmar", caller-supplied title, prominent amount with asset code and the
      canonical "Activo de prueba sin valor económico" beside it
- [x] Caller-supplied description rows; long public values truncated visibly but exposed in full to
      assistive technology and copyable
- [x] "Stellar Testnet" always shown; a wrong-network state blocks signing with a visible message
- [x] Canonical pre-sign check and non-custody disclosure from the shared constants
- [x] Optional acknowledgement checkbox; when required, "Firmar en Freighter" stays disabled until checked
- [x] Signing states (idle, signing, signature rejected, verification rejected) are props; signed never
      renders as confirmed
- [x] `role="dialog"`, labelled by its title (`aria-modal` is a documented deviation: React Aria omits it on purpose, see T1 decisions); closes on `Escape`, "Cancelar" and the close
      button
- [x] Unit tests and a Storybook story rendering in light and dark
- [x] Consistency guards pass; the six `(demo)` routes keep rendering under `prohibited-terms`
- [x] `lint`, `typecheck`, `test`, `build`, `build-storybook`, `boundaries`, `test:boundaries` pass

## Verification evidence

### T1 — TransactionReviewModal (2026-09-27)

#### TDD

Runner: `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/transaction-review-modal.test.tsx`.

- **RED**: with the test file written and `transaction-review-modal.tsx` temporarily moved out of the
  tree, the run failed with a genuine module-resolution error (not a fabricated failure):
  `Error: Failed to resolve import "./transaction-review-modal" from
  "src/presentation/components/transaction-review-modal.test.tsx". Does the file exist?` — `Test Files 1
  failed (1)`, `Tests no tests`.
- **GREEN**: after restoring the implementation and one fix (see deviations), `Test Files 1 passed (1)`,
  `Tests 17 passed (17)`.

#### Decisions and deviations

- **`aria-modal` is not rendered — recorded gap against the acceptance criteria, not a bug.** HeroUI v3's
  `Modal.Dialog` is `react-aria-components`' `Dialog`, whose `useDialog` (verified by reading
  `node_modules/.pnpm/react-aria@3.52.1_.../react-aria/dist/private/dialog/useDialog.mjs`) deliberately
  omits `aria-modal`: *"We do not use aria-modal due to a Safari bug which forces the first focusable
  element to be focused on mount when inside an iframe... useModal sets aria-hidden on all elements
  outside the dialog, so the dialog will behave as a modal even without aria-modal on the dialog
  itself."* `aria-modal` is not a typed prop anywhere in the `Dialog`/`GlobalDOMAttributes` type chain
  either, so forcing it would need an unsafe cast against a library that explicitly chose not to render
  it. Confirmed empirically (a throwaway probe test logged `dialog.getAttribute("aria-modal")` →
  `null`) before deciding not to fight it. What the component does guarantee and what the tests assert:
  `role="dialog"` (the `Modal.Dialog` default) and `aria-labelledby` auto-wired to `Modal.Heading`
  (`slot="title"`), giving the dialog its accessible name from the caller's `title`.
- **`wrongNetworkMessage` and `acknowledgementLabel` are caller-supplied props**, per the task's own
  constraint: neither "Cambia a Stellar Testnet para continuar" nor "Revisé la red, las cuentas, el
  activo, el monto y el memo" exists in `application/trust/disclosures.ts`. Both strings appear only in
  this component's stories, never retyped as a constant.
- **Token mapping**: the eyebrow "Revisión antes de firmar" uses `text-brand-accent` (the app's purple,
  `#8a05be`) rather than any HeroUI blue; the sign action reuses the shared `Button` `variant="primary"`
  unchanged — `button.tsx` already maps HeroUI's own `"primary"` (not `"accent"`) to that slot, so no new
  color decision was needed there.
- **Network label reuse**: "Stellar Testnet" is not hand-typed — it is `disclosures.testnet.title`, which
  is exactly that string, so the network row still traces to the canonical constants file.
- **`HashDisplay` reuse for mono rows**: `Cuenta origen` and `Contrato de la bóveda` render through
  `HashDisplay` (truncation + full value for assistive tech + copy), matching the "reuse if it fits"
  guidance. Trade-off accepted: `HashDisplay` always renders its own `TESTNET` badge, so a review with
  two mono rows shows that badge twice in addition to the modal's own "Red: Stellar Testnet" line. Not
  misleading (context is Testnet throughout), but visually repetitive — worth a follow-up if a future
  task wants a badge-less `HashDisplay` variant.
- **Acknowledgement checkbox state is local `useState`**, not a caller-controlled prop. The task's "every
  value, state and handler is a prop" applies to business/domain state (signing status, network
  correctness, values); purely local UI toggle state has the same status as `AccountMenu`'s internal
  `isOpen` and `HashDisplay`'s internal `copyState` — neither of those is caller-controlled either.
- **Tests use `fireEvent`, not `@testing-library/user-event`.** `user-event` is not a declared dependency
  of `@vaqcrow/web` (only present transitively, unreachable under pnpm's strict linking — verified via
  `eza apps/web/node_modules/@testing-library/`) and no test in the repo imports it; `account-menu.test.tsx`
  already establishes `fireEvent` (including `fireEvent.keyDown(..., { key: "Escape" })`) as the house
  convention. Adding a new devDependency for this alone was judged out of scope for a presentational
  component task; `fireEvent` still drives real DOM events, not simulated state.
- **Correction (parent readback, 2026-09-27): the template files are present, not absent.** The original
  claim below was wrong — `docs/design/template/*.dc.html` are git-ignored (so `git status`/`git ls-files`
  don't show them) but do exist on disk at the repo root; `fd . docs/design/template` lists them, and
  `bat -r 385:415 "docs/design/template/Vaqcrow Sistema.dc.html"` / `bat -r 190:212 "docs/design/template/Vaqcrow
  Detalle PyME.dc.html"` (note: `bat -r` takes `START:END`, not `START,END` — the earlier attempt used a
  comma and silently failed, which is why the file was wrongly reported unreadable) read the cited
  sections. They confirm the component's structure: `role="dialog" aria-modal="true"`, the eyebrow, a
  `<dl>` of `dt`/`dd` pairs (`Red` → "Stellar Testnet", `Contrato` → a truncated mono value with an
  explorer link, `Cuenta` → a truncated mono value, `Custodia` → plain text), the trust note combining a
  non-custody sentence with `microcopy.preSignCheck`'s exact wording, and the "Cancelar"/"Firmar en
  Freighter" footer. This independently confirms the `dt`/`dd`-per-row structure from finding #2 below,
  and that the template itself renders "Stellar Testnet" as plain text, not a badge.
- Storybook: the modal renders with `isOpen: true` directly in every story (no trigger interaction) since
  the component is fully controlled; both themes come for free via the existing `withThemeByDataAttribute`
  toolbar decorator (no story needs a light/dark variant of its own — no sibling story does either).

#### Required checks

| Command | Observed result |
|---|---|
| `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/transaction-review-modal.test.tsx` | Pass — 17/17 |
| `pnpm run lint` | Pass — 0 errors (1 pre-existing unrelated warning in `fetch-http-client.ts`) |
| `pnpm run typecheck` | Pass — all 5 packages |
| `pnpm run test` | Pass — 99 files / 666 tests, all workspaces |
| `pnpm run build` | Pass — all 5 packages, `@vaqcrow/web` production build succeeded |
| `pnpm --filter @vaqcrow/web build-storybook` | Pass — static build succeeded; `apps/web/storybook-static/` deleted afterward |
| `pnpm run boundaries` | Pass — no dependency violations (440 modules, 1290 dependencies) |
| `pnpm run test:boundaries` | Pass — 7 files / 83 tests |

### Parent readback corrections (2026-09-27)

Parent readback of T1 found three defects. All three were fixed with strict TDD (RED observed first,
then GREEN); no commits, no review commands run.

#### Finding 1 — acknowledgement state leaked across openings

`TransactionReviewModal` stays mounted while the caller toggles `isOpen` (only its rendered dialog
content mounts/unmounts), so `isAcknowledged` declared with `useState` directly in that top-level
component survived a close/reopen: checking the box, closing, and reopening for a different transaction
left it checked and "Firmar en Freighter" enabled.

- **RED**: added a test that opens the modal, checks the acknowledgement box, rerenders with
  `isOpen={false}`, then rerenders with `isOpen={true}` again, and asserts the checkbox is unchecked and
  the sign button disabled. Against the original implementation:
  `expect(element).not.toBeChecked()` failed — `Received element is checked: <input checked="" ... />`.
- **Fix**: extracted all dialog content — including the acknowledgement `useState` — into a new inner
  `TransactionReviewModalContent` component, mounted only inside `Modal.Backdrop`'s children.
  `Modal.Backdrop` was already confirmed (by the existing "renders nothing while closed" test) to fully
  unmount its children when `isOpen` is false, so moving the state into a component that only exists
  inside that subtree resets it for free on every reopening — no extra `key` or effect required, per the
  parent's preferred approach.
- **GREEN**: same test passes; full suite for the file passes 21/21.

#### Finding 2 — invalid `<dl>` content model, repeated TESTNET badge

Mono rows rendered `<HashDisplay label={row.label} value={row.value} />` as the sole content of their
`<div>` inside the `<dl>` — no `<dt>`/`<dd>` at all for those rows — and `HashDisplay` renders its own
`TESTNET` badge, so a review with two mono rows plus the modal's own network row showed the badge three
times.

- **RED**: added a test asserting every child of the `<dl>` has exactly one `dt` and one `dd`, and that
  exactly one `[data-variant="testnet"]` badge exists in the dialog. Against the original implementation:
  `expect(group.querySelectorAll("dt")).toHaveLength(1)` failed with `0` for the mono rows, and the badge
  count failed `0` (the query needed `document.body`, not RTL's `container`, since HeroUI's `Modal`
  portals onto `document.body` — see the test's own comment).
- **Checked whether `HashDisplay` could be reused without its label/badge first**: it has no such prop
  (`label`, `value`, `explorerUrl`, `className` only) — confirmed by reading `hash-display.tsx` before
  changing anything. Per the parent's instruction, `HashDisplay`'s public behavior for its own callers
  (`Confianza/HashDisplay` stories, `funding`/other screens) was left unchanged.
- **Fix**: exported `truncateMiddle` from `hash-display.tsx` (previously module-private) as the single
  source of the truncation rule, and added a small local `MonoValue` component in
  `transaction-review-modal.tsx` that renders inside a proper `<dd>`: the truncated value, the full value
  in a `sr-only` span (identical accessibility pattern to `HashDisplay`), and its own minimal copy button
  and clipboard handling — without a label heading or a `TESTNET` badge. Every row (mono or not) is now
  exactly one `<dt>` + one `<dd>` inside a wrapper `<div>`.
- **GREEN**: same test passes; the network row's badge is the only `[data-variant="testnet"]` element in
  the dialog.

#### Finding 3 — silently-disabled signing on the wrong network

`isWrongNetwork` and `wrongNetworkMessage` were independently optional, so `isWrongNetwork: true` without
a message disabled signing with nothing visible explaining why.

- **Chosen fix: type-level (discriminated union)**, per the parent's preference when it "stays simple."
  `TransactionReviewNetworkState` is now `{ isWrongNetwork?: false } | { isWrongNetwork: true;
  wrongNetworkMessage: string }`, intersected into the props type — a caller can no longer construct the
  invalid combination at all.
- **RED (compile-time)**: added a test file object typed as `TransactionReviewModalProps` with
  `isWrongNetwork: true` and no `wrongNetworkMessage`, guarded by `// @ts-expect-error`. Before the fix,
  `pnpm --filter @vaqcrow/web exec tsc -p tsconfig.json --noEmit` failed with `error TS2578: Unused
  '@ts-expect-error' directive` (proving the old type accepted the invalid state).
- **Two follow-on type errors surfaced while wiring the fix, both fixed before GREEN**:
  1. Deriving the inner content component's props via `Omit<TransactionReviewModalProps, "isOpen">`
     collapsed the discriminated union into a widened `{ isWrongNetwork?: boolean }` — `Omit` over an
     intersection-with-union doesn't preserve the discriminant through object-rest destructuring. Fixed
     by declaring `TransactionReviewModalContentProps` as its own named intersection
     (`TransactionReviewModalBaseProps & TransactionReviewNetworkState`) instead of an `Omit` of the
     top-level props type.
  2. The test helper `buildElement` conditionally spread `{ isWrongNetwork: true, wrongNetworkMessage }`
     into one JSX call; TypeScript can't prove a conditionally-spread pair is complete against a
     discriminated union, so it complained under `exactOptionalPropertyTypes`. Fixed by branching
     `buildElement` into two full JSX calls — one per union arm — instead of one call with a partial
     conditional spread.
- **GREEN**: `tsc -p tsconfig.json --noEmit` passes with no errors; the same test (renamed to prove the
  positive as well) passes.

#### Required checks (re-run after all three fixes)

| Command | Observed result |
|---|---|
| `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/transaction-review-modal.test.tsx` | Pass — 21/21 |
| `pnpm run lint` | Pass — 0 errors (same 1 pre-existing unrelated warning in `fetch-http-client.ts`) |
| `pnpm run typecheck` | Pass — all 5 packages |
| `pnpm run test` | Pass — 99 files / 670 tests, all workspaces |
| `pnpm run build` | Pass — all 5 packages, `@vaqcrow/web` production build succeeded |
| `pnpm --filter @vaqcrow/web build-storybook` | Pass — static build succeeded; `apps/web/storybook-static/` deleted afterward |
| `pnpm run boundaries` | Pass — no dependency violations (440 modules, 1290 dependencies) |
| `pnpm run test:boundaries` | Pass — 7 files / 83 tests |

No story changes were needed: none of the three fixes changed a public prop name or added a required
prop to an existing story's combination (`WrongNetwork` already paired `isWrongNetwork`/
`wrongNetworkMessage`; every other story never set `isWrongNetwork` at all, which still satisfies the
narrowed `{ isWrongNetwork?: false }` branch).

### T1 — commit and native review (2026-09-27)

- Work-unit implementation commit: `88af75f` (`feat(web): add transaction review modal`).
- Parent spot check: focused suites `transaction-review-modal.test.tsx` + `hash-display.test.tsx` — 2 files,
  29 tests passed; `pnpm --filter @vaqcrow/web typecheck` clean.
- RDD assessment (`--base-ref main --committed-only`): risk `medium` (`executable_change` in
  `hash-display.tsx`), 6 paths / 961 changed lines, `review_due: true`, reason `slice_budget_reached`.
- Owner granted candidate consent. Lineage `review-12a0456d258d9754`, one lens (`review-reliability`):
  **approved**, acknowledged (`gentle-ai.review-acknowledged/v1`); review authority burned.
- Advisory, non-blocking findings (accepted as follow-up within T1's acceptance criteria):
  - `R3-silent-rejection` — a rejected `signingStatus` without `signingErrorMessage` renders nothing and
    re-enables signing; same class as the wrong-network gap fixed during readback.
  - `R3-copy-untested` — `MonoValue`'s clipboard outcomes (copied, no API, rejected) are not exercised.

## Next step

Fix the two advisory findings (T1 follow-up commit), then push and open the PR (owner decision).
