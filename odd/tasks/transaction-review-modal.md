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

### T1 — review advisory follow-up (2026-09-27)

Fixed all three advisories from native review with strict TDD (RED observed first, then GREEN). No
commits, no pushes, no `gentle-ai review` commands run from this pass. A second native review — lineage
`review-2e3f8a8610236ee0`, candidate including commit `5f45934` — was approved and acknowledged covering
these same three advisories.

#### R3-silent-rejection

`signingStatus: "signature-rejected"` (or `"verification-rejected"`) could be passed without
`signingErrorMessage`; the rejection then rendered nothing and signing looked untouched-idle.

- **Fix**: same pattern as the wrong-network discriminated union.
  `TransactionReviewSigningState = { signingStatus: "idle" | "signing" } | { signingStatus:
  "signature-rejected" | "verification-rejected"; signingErrorMessage: string }`, intersected into
  `TransactionReviewModalContentProps` alongside `TransactionReviewNetworkState`.
- **RED (compile-time)**: added a `TransactionReviewModalProps` object typed with `signingStatus:
  "signature-rejected"` and no `signingErrorMessage`, guarded by `@ts-expect-error`. To get a genuine
  (not fabricated) RED, the fix was temporarily reverted to the old shape (`{ signingStatus: ...;
  signingErrorMessage?: string }`) and `pnpm --filter @vaqcrow/web exec tsc -p tsconfig.json --noEmit`
  was run: `error TS2578: Unused '@ts-expect-error' directive` — proving the old type accepted the
  invalid state. The fix was then restored (`diff` against the pre-revert file confirmed a byte-identical
  restore).
- **Runtime test**: `R3-silent-rejection: a rejected signing status always shows its message via
  role=alert (enforced by the type)` — this was GREEN immediately (the old implementation already
  rendered a *provided* message correctly; the bug was only the ability to omit it). Recorded honestly:
  the compile-time guard is the real RED/GREEN evidence here, the runtime test is a characterization of
  already-correct behavior now protected by the type.
- **Two follow-on type errors surfaced while wiring this in, both fixed**:
  1. `TransactionReviewModalContentProps` already had to be its own named intersection (not `Omit`) from
     the earlier network-state fix; the same reasoning now also covers the signing-state discriminant.
  2. `transaction-review-modal.stories.tsx`'s `WithoutAcknowledgement` story used a custom `render`
     manually re-listing individual `args.*` fields, which lost the union discriminant the same way a
     conditional spread does. Fixed by restructuring the stories: `meta.args` no longer sets
     `acknowledgementLabel` or any network/signing override by default (so `WithoutAcknowledgement` needs
     no custom render — it's just `{}`), and every other story adds `acknowledgementLabel` back
     explicitly. The test file's `buildElement` was similarly restructured to build fully-typed
     `networkProps`/`signingProps` local variables (one full object per union arm) instead of conditional
     spreads, mirroring the pattern already used for the network state.
- **GREEN**: `tsc -p tsconfig.json --noEmit` clean; full test file passes.

#### R3-copy-untested

`MonoValue`'s clipboard outcomes (copied, rejected, API unavailable) had no test coverage.

- **Tests added** (`describe("MonoValue copy behavior (R3-copy-untested)")`, `vi.stubGlobal`/
  `vi.unstubAllGlobals()` in `afterEach`, mirroring `hash-display.test.tsx`'s existing convention):
  1. stubbed `navigator.clipboard.writeText` resolving → asserts it was called with the **full** value
     (`SOURCE_ACCOUNT`, not the truncated glyph) and that "Copiado" appears in an `aria-live="polite"`
     region.
  2. `writeText` rejecting → the visible failure message appears.
  3. no `clipboard` API → the same failure message appears.
- **Honest characterization**: all three went **GREEN immediately** — `MonoValue`'s existing
  implementation was already correct, just untested. To prove test (1) is actually meaningful (not a
  false-positive), the implementation was temporarily broken (`clipboard.writeText(value)` →
  `clipboard.writeText(truncated)`) and re-run:
  `pnpm --filter @vaqcrow/web exec vitest run ... -t "copies the FULL value"` → **RED**, timed out waiting
  for `writeText` to be called with `SOURCE_ACCOUNT` (`Test Files 1 failed`). The implementation was then
  restored and confirmed byte-identical to the working version via `diff`.
- **GREEN**: restored implementation, all three tests pass.

#### R3-empty-wrong-network-message

Follow-up finding on the two discriminated unions above: the type only requires the message *field* to be
present, not non-empty — `wrongNetworkMessage: ""` (or `signingErrorMessage: ""` on a rejected status)
still type-checked, and the old render condition (`isWrongNetwork && wrongNetworkMessage`) gated on the
message's truthiness, so an empty string hid the alert entirely while `isSignDisabled` stayed `true`:
signing blocked with nothing visible explaining why.

- **RED**: added two tests — `wrongNetworkMessage: ""` should still show `role="alert"` and keep signing
  disabled; a rejected status with `signingErrorMessage: ""` should still show `role="alert"`. Against the
  pre-fix render (message-truthiness gate):
  `expect(screen.getByRole("alert")).toBeInTheDocument()` failed both times — `Unable to find an
  accessible element with the role "alert"` (`Test Files 1 failed`, 2/2 new tests failing).
- **Investigated a canonical-constant fix first, per instruction, and rejected it**: no
  `application/trust` constant fits either condition — `disclosures.testnet` is a general Testnet blurb
  (doesn't say signing is blocked) and `microcopy.preSignCheck` is a pre-sign checklist, not an error
  state; substituting either would misrepresent why signing is disabled. TypeScript also has no built-in
  non-empty-string type, so the type-level fix from the two findings above can't close this gap by itself.
  Inventing new trust wording inside the component was out of scope.
- **Fix (runtime, documented in a code comment on `TransactionReviewNetworkState`)**: gate the alert on
  the *state* (`isWrongNetwork`, `isRejectedStatus`) instead of the message's truthiness — `{isWrongNetwork
  ? <p role="alert">{wrongNetworkMessage}</p> : null}` and `{isRejectedStatus ? <p
  role="alert">{rejectedMessage}</p> : null}`. The alert element (and therefore the assistive-tech
  announcement) is now never silently dropped, even for a degenerate empty caller message; `isRejectedStatus`
  is computed once and reused to narrow `unionState.signingErrorMessage` for `rejectedMessage` (TypeScript's
  aliased-condition narrowing, confirmed by a clean `tsc` run).
- **GREEN**: both new tests pass; full file 28/28.

#### Parent readback: the R3-empty-wrong-network-message fix was vacuous (2026-09-27)

Parent readback found the fix above insufficient: gating the alert on `isWrongNetwork` rather than the
message's truthiness makes `role="alert"` present, but with `wrongNetworkMessage: ""` the element still
renders **empty** — the person sees no reason signing is blocked, only that a test now technically finds
an alert node. The test was checking existence, not content, and mistook that for a fix.

**Owner decision**: authorized exactly one new canonical string —
`microcopy.wrongNetwork: "Cambia a Stellar Testnet para continuar"` (source: `docs/design/demo-ui.md:1173`,
"Wrong network must block signing and say 'Cambia a Stellar Testnet para continuar'", approved 2026-09-27).
No fallback was authorized for the rejected-signing case; that gap is a documented residual limitation
instead, per the owner's instruction not to invent wording.

**1. Added the canonical string, checked and updated the enumeration guard.** Searched
`apps/web/src/application/trust/disclosures.ts` and `rg microcopy apps/web/src tests` for anything
enumerating microcopy keys before touching the source. Found
`apps/web/src/application/trust/disclosures.test.ts`'s `PINNED_MICROCOPY` map, which pins every
`microcopy` key/value byte-for-byte and asserts `Object.keys(microcopy)` equals exactly its keys — the
guard this instruction anticipated.
- **RED**: added `wrongNetwork: "Cambia a Stellar Testnet para continuar"` to `PINNED_MICROCOPY` before
  touching the source. `pnpm --filter @vaqcrow/web exec vitest run src/application/trust/disclosures.test.ts`
  → 2 failures: `"holds exactly the pinned contextual labels"` (`Object.keys` mismatch, missing
  `"wrongNetwork"`) and `'matches the pinned literal verbatim for "wrongNetwork"'` (`expected undefined to
  be 'Cambia a Stellar Testnet para continuar'`).
- Added `wrongNetwork` to `microcopy` in `disclosures.ts` with a comment citing the source line and the
  2026-09-27 approval. **GREEN**: `disclosures.test.ts` 22/22.
- Checked the other guards for impact: `tests/trust-disclosures-canonical-consistency.test.ts` only
  enumerates the 6 `disclosures` (not `microcopy`) `text:` literals — unaffected, still expects
  `CANONICAL_DISCLOSURE_COUNT = 6`. `apps/web/src/app/(demo)/prohibited-terms.test.tsx` renders the six
  demo routes and checks for prohibited phrases; `TransactionReviewModal` isn't wired into any route (out
  of scope per this feature's own Scope section), so the new string is never rendered there, and it
  doesn't match any `PROHIBITED_PHRASES` entry or the "Retorno as certainty" pattern regardless. Both
  confirmed still passing.

**2. Wired the fallback into the modal.** Changed the existing (now corrected) test to assert the alert's
*visible text*, not just its presence:
- **RED**: rewrote the test to `expect(screen.getByRole("alert")).toHaveTextContent(microcopy.wrongNetwork)`
  for both an empty (`""`) and a whitespace-only (`"   "`) `wrongNetworkMessage`, and ran against the
  vacuous implementation:
  `Expected element to have text content: "Cambia a Stellar Testnet para continuar" / Received: ""` — both
  new/changed assertions failed.
- **Fix**: `wrongNetworkMessage` now falls back to `microcopy.wrongNetwork` when
  `unionState.wrongNetworkMessage.trim() === ""`. Updated the `TransactionReviewNetworkState` doc comment
  to replace the outdated "no canonical constant fits, render empty" reasoning with the actual resolution
  and the residual limitation for the rejected-signing case.
- **GREEN**: both tests pass (`transaction-review-modal.test.tsx` 29/29).

**3. Rejected-signing empty message — corrected the test to stop overclaiming, no behavior change.** The
owner did not authorize a fallback here (deliberately: a rejection's cause is caller-specific — Freighter
denial vs. verification failure — and a single generic string would misrepresent it as the wrong-network
case does not). Rewrote the test from a bare "alert exists" assertion to one that explicitly asserts empty
content, naming this a residual limitation in its own description
(`"residual limitation — a rejected status with an empty signingErrorMessage still renders an alert with
no visible reason (no canonical fallback was authorized for this case; the type already requires the
field, but not that it be non-empty)"`). This test was already passing before and after — the point was
correcting what it claims, not the runtime behavior — so there is no RED/GREEN pair for this item, only
the corrected assertion and the residual-limitation note recorded here.

**Residual limitation (recorded, not fixed):** a caller passing `signingStatus: "signature-rejected"` (or
`"verification-rejected"`) with `signingErrorMessage: ""` gets a present-but-visually-empty `role="alert"`
element. The discriminated union requires the field but cannot require it be non-empty (TypeScript has no
built-in non-empty-string type), and no canonical fallback exists or was authorized for this case. Any
real caller in this demo already supplies a real message (see the `SignatureRejected`/`VerificationRejected`
stories); this is a defense against a hypothetical misuse of the prop, not an observed demo defect.

#### Required checks (re-run after the vacuous-fix correction)

| Command | Observed result |
|---|---|
| `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/transaction-review-modal.test.tsx` | Pass — 29/29 |
| `pnpm --filter @vaqcrow/web exec vitest run src/application/trust/disclosures.test.ts` | Pass — 22/22 |
| `pnpm run lint` | Pass — 0 errors (same 1 pre-existing unrelated warning in `fetch-http-client.ts`) |
| `pnpm run typecheck` | Pass — all 5 packages |
| `pnpm run test` | Pass — 99 files / 679 tests, all workspaces |
| `pnpm run build` | Pass — all 5 packages, `@vaqcrow/web` production build succeeded |
| `pnpm --filter @vaqcrow/web build-storybook` | Pass — static build succeeded; `apps/web/storybook-static/` deleted afterward |
| `pnpm run boundaries` | Pass — no dependency violations (440 modules, 1290 dependencies) |
| `pnpm run test:boundaries` | Pass — 7 files / 83 tests (includes `trust-disclosures-canonical-consistency.test.ts`, confirmed unaffected above; `prohibited-terms.test.tsx` runs under `pnpm run test`, also confirmed unaffected) |

Stories updated: `transaction-review-modal.stories.tsx` restructured as described under R3-silent-rejection
(no visual/behavioral change to any story's rendered content — `WithoutAcknowledgement` still renders
without the checkbox, every other story still renders with it). No story changes were needed for the
vacuous-fix correction; `WrongNetwork` already passes a real, non-empty `wrongNetworkMessage`.

### T1 — third native review and untyped-caller guard (2026-09-27)

- Advisory follow-up commit: `377731c` (`fix(web): surface every blocked signing state in the review modal`).
- RDD assessment (`--base-ref 5f45934 --committed-only`): risk `medium`, 6 paths / 458 lines,
  `slice_budget_reached`. Owner granted consent. Lineage `review-1e39b157feac1053` (`review-reliability`):
  **approved**, acknowledged; one advisory `SUGGESTION`:
  - `R3-untyped-wrong-network-trim` — `.trim()` on the wrong-network message throws when an untyped caller
    (Storybook controls, plain JS) flips `isWrongNetwork` without the message.
- Fixed inline (parent, one-line mechanical change). RED:
  `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/transaction-review-modal.test.tsx`
  — 1 failed / 29 passed, `TypeError: Cannot read properties of undefined (reading 'trim')`. GREEN after
  `(message ?? "").trim()`: 30 passed.

| Command | Observed result |
| --- | --- |
| focused vitest (modal) | 30 passed |
| `pnpm run lint` | 5/5 tasks; 1 pre-existing warning, 0 errors |
| `pnpm run typecheck` | 8/8 tasks |
| `pnpm run test` | 8/8 tasks; web 680, api 686, ai 107 passed |
| `pnpm run build` | 5/5 tasks |
| `pnpm --filter @vaqcrow/web build-storybook` | exit 0; `storybook-static/` deleted |
| `pnpm run boundaries` | no dependency violations (440 modules) |
| `pnpm run test:boundaries` | 83 passed |

### T1 — fourth native review and dismissal lock while signing (2026-09-27)

- The stop hook required a review of the whole branch against `main` (8 paths / 1339 lines, risk
  `medium`). Owner granted consent. Lineage `review-dbfd251809c2bdc0` (`review-reliability`): **approved**,
  acknowledged; two advisory `SUGGESTION`s:
  - `R3-blank-rejection-message` — the known residual limitation (a rejected status with a blank message
    renders an empty alert). Still open: it needs owner-approved fallback copy.
  - `R3-dismiss-during-signing` — "Cancelar", the close button, `Escape` and the backdrop all called
    `onClose` while a Freighter signature was in progress.
- Owner decision (2026-09-27): lock dismissal while signing before opening the PR.
- RED: three new tests; `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/transaction-review-modal.test.tsx`
  — 2 failed / 31 passed (`expected "spy" to not be called at all, but actually been called 1 times`) for
  `Escape` and for Cancelar/close while signing. The third test (dismissal allowed again after a rejection)
  passed from the start as a regression guard.
- GREEN: `Modal.Backdrop` gets `isDismissable={!isSigning}` and `isKeyboardDismissDisabled={isSigning}`,
  `onOpenChange` ignores close requests while signing, and "Cancelar" plus `Modal.CloseTrigger` get
  `isDisabled={isSigning}` — 33 passed.

| Command | Observed result |
| --- | --- |
| focused vitest (modal) | 33 passed |
| `pnpm run lint` | 5/5 tasks; 1 pre-existing warning, 0 errors |
| `pnpm run typecheck` | 8/8 tasks |
| `pnpm run test` | 8/8 tasks; web 683 passed |
| `pnpm run build` | 5/5 tasks |
| `pnpm --filter @vaqcrow/web build-storybook` | exit 0; `storybook-static/` deleted |
| `pnpm run boundaries` | no dependency violations (440 modules) |
| `pnpm run test:boundaries` | 83 passed |

### Delivery (2026-09-27)

- Fix commit `b0ef07d` assessed: risk `medium`, 75 lines, `review_due: false` (`under_budget`).
- Branch pushed; PR #322: https://github.com/reyduar/Vaqcrow/pull/322 (closes #321), labels `enhancement`,
  `type:feature`.
- Size: ~1400 added lines, over the ~450 forecast, mostly this log (~510) and tests (~450). The component
  itself is ~320 lines. The planned `-02-stories` split was not applied; the owner asked for one PR.

### Fifth native review and canonical copy in stories (2026-09-27)

- The stop hook required another whole-branch review (8 paths / 1415 lines). Owner granted consent.
  Lineage `review-bf36ff72afb79522` (`review-reliability`): **approved**, acknowledged. Advisories:
  - `R3-blank-rejection-message` (`WARNING`) — the open follow-up; still needs owner-approved fallback copy.
  - `R3-stale-wrong-network-story-copy` (`SUGGESTION`) — stories and the test helper retyped the canonical
    string after `microcopy.wrongNetwork` existed, and the stories doc comment still called it
    non-canonical.
- Fixed inline: stories and the test helper import `microcopy.wrongNetwork`; the caller-message test uses a
  distinct caller string so it proves the caller text wins over the fallback. No behaviour change, so no
  RED phase. Checks: focused modal suite 33 passed; `lint` 0 errors (1 pre-existing warning); `typecheck`
  8/8; `test` 8/8 (web 683); `build-storybook` exit 0, `storybook-static/` deleted.

## Next step

Wait for PR #322 checks and the owner's merge; then the evidence document, and step 6 (adopting the shell and
the modal in the six demo routes). Open follow-up: fallback copy for a blank rejected-signing message.
