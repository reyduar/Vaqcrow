# Storybook themes and the run guide

Iteration log for: making the light and dark themes actually work, wiring them into Storybook, and
documenting everything needed to run the workshop and see it in a browser.

## Objective

Light and dark are mandatory deliverables in `demo-ui.md` §5.8 and in the design brief §8, and the
generated templates define both. The app had **neither**: `globals.css` was 22 lines of light-only
`@theme` tokens, no `data-theme`, no switcher. A Storybook theme toolbar without a real theme mechanism
would switch nothing, which is why the previous work unit left it out.

## Problem

Three gaps, all verified before writing anything:

- **No theme mechanism.** `layout.tsx` renders `<html lang="en">` with nothing else: no `data-theme`,
  no bootstrap script, no persistence.
- **No themed tokens.** The app defines `--color-trust-*` and `--color-chart-*` once, in light only.
  It uses no Tailwind colour utilities at all, and nothing themes the page surface or text.
- **A dead class.** `text-muted` is used across five components but `--color-muted` was never defined,
  so it renders as inherited colour — the intent was `--color-text-secondary`.

## Scope

In:

- Tokens for both themes in `globals.css`: page canvas and surface, primary and secondary text, border,
  focus ring, and dark values for the app's trust and chart tokens.
- The mechanism the design corpus already specifies: `data-theme` on `<html>`, the choice persisted in
  `vaqcrow-theme`, `Sistema` resolved through `matchMedia`, applied before first paint, `color-scheme`
  kept in sync.
- A `Claro` / `Oscuro` / `Sistema` switcher in the demo header, which the design corpus already places
  under "Acceso secundario".
- Storybook bound to the **same** attribute through `@storybook/addon-themes`, so the toolbar drives the
  real mechanism instead of a parallel one.
- A run guide in `docs/guides/` covering how to start it, what URL to open, how to switch themes, and
  the known constraints.

Out (explicit boundary):

- No restyle to the new design language: the app keeps its current tokens and layout. Adopting the
  template's visual language is a separate, much larger change.
- No change to the disclosure copy, the contract, the API or the trust rules.

## Decisions

- **Dark values come from the design corpus where it specifies them** (`--color-status-*` for both
  themes) and from the generated templates' dark palette otherwise, mapped to the matching semantics:
  `info → #A9CCFF`, `caution → #FFD27A`, `critical → #FFB3AE`, `neutral → #A0A0A0`. Recorded so the
  choice is reviewable rather than implied.
- **`--color-muted` is defined as an alias of the secondary text token**, which turns the five existing
  `text-muted` usages into what they were written to mean. A one-line enabler, not a restyle.
- The switcher reads the DOM attribute as its source of truth after mount, so the pre-paint script and
  the component cannot disagree, and hydration stays clean.

## Acceptance criteria

- [x] Both themes render from the same token set, with no component change needed to read them
- [x] The choice persists across reloads and `Sistema` follows the OS and reacts to its changes
- [x] The effective theme is applied before first paint, with no flash of the wrong theme
- [x] The Storybook toolbar drives `data-theme`, so a story can be reviewed in both themes
- [x] The switcher is operable by keyboard, with the selected state perceivable without colour alone
- [x] A guide exists stating how to run it, the URL, and the known constraints
- [x] `lint`, `typecheck`, `test`, `build`, `build-storybook`, `boundaries` and `test:boundaries` pass

## Decisions (addendum — closing session, 2026-09-26)

- **`--color-muted` decision superseded.** The original "define `--color-muted` as an alias of
  `--color-text-secondary`" decision above was never implemented, and shouldn't be: `@heroui/styles`
  (already imported by `globals.css` before this task) declares `--color-muted` itself, in
  `themes/shared/theme.css`, with its own light/dark pair keyed off the exact same
  `.dark, [data-theme="dark"]` selector this task's bootstrap script and switcher set. So the "dead
  class" bug the Problem section named is fixed by the theme mechanism landing at all, not by
  redefining the token — redefining it here would have silently overridden HeroUI's own value
  everywhere `text-muted` is used (13 sites), which is exactly the kind of restyle this task is not
  meant to cause.
- **Found and fixed a real token collision.** The globals.css draft this session inherited named two
  of its own new page-level tokens `--color-surface` and `--color-border` — both names HeroUI's
  `@heroui/styles` already claims (also in `themes/shared/theme.css`, also keyed off
  `.dark, [data-theme="dark"]`), with its own light/dark values, already consumed via the
  `bg-surface`/`border-border` Tailwind utilities by at least one pre-existing component
  (`human-decision-form.tsx`'s `TEXTAREA_CLASS`). Because Tailwind v4 resolves `@theme` declarations by
  last-declared-wins at `:root`, this task's own `@theme` block — imported after `@heroui/styles` —
  was silently overriding HeroUI's surface/border colours in dark mode, for every HeroUI component using
  them, not just the app's own chrome. This directly contradicted the file's own comment ("the rest of
  the HeroUI semantic set are NOT redefined here on purpose"). Renamed the app's two colliding tokens to
  `--color-page-surface` / `--color-page-border`; nothing in the codebase consumed the old names outside
  this file, so the rename has no other call sites to update.
- **Deleted a leftover `apps/web/storybook-static/`** found already present (untracked, matching
  `.gitignore`) at the start of this session. It was large enough that `pnpm run lint`'s `eslint .` (no
  ignore entry for that path) walked into its minified bundles and reported ~19,000 false-positive
  errors. Removed it and re-ran `build-storybook` to verify the real script still produces it cleanly,
  then removed the fresh output again so the working tree stays clean — `storybook-static/` regenerates
  on demand and is git-ignored (`.gitignore:18`).
- **`layout.tsx`'s `<html lang="en">` → `lang="es"`**, carried over unchanged from the inherited diff:
  consistent with every other `lang="es"` marker already in the app's presentation components (13
  call sites), and the line was already being touched for `className`/`data-theme`/
  `suppressHydrationWarning`. Not reverted; noted here since it's outside this task's literal scope but
  clearly a pre-existing-convention fix rather than a restyle.

## Verification evidence

| Unit | Command | Result |
| --- | --- | --- |
| Theme switcher tests | `pnpm --filter @vaqcrow/web exec vitest run src/presentation/components/theme-switcher.test.tsx` | Pass — 5/5 tests |
| Lint | `pnpm run lint` | Pass — 0 errors (1 pre-existing unrelated warning, `fetch-http-client.ts:8` unused `_request`), after deleting the leftover `storybook-static/` that was causing ~19k unrelated eslint errors |
| Typecheck | `pnpm run typecheck` | Pass — all 5 workspaces |
| Full test suite | `pnpm run test` | First run: 6 files failed on vitest's 5000ms default timeout under host load (`layout.traversal.test.tsx`, `ai-assessment-panel.test.tsx`, `demo-shell.test.tsx`, `human-decision-form.test.tsx`, `sales-evidence-table.test.tsx`, `sme-request-workspace.test.tsx`) — none touched by this task. Re-run of exactly those 6 files in isolation: **6/6 files, 34/34 tests pass** (`pnpm --filter @vaqcrow/web exec vitest run <those 6 paths>`). Matches the documented host-load flake. |
| Build | `pnpm run build` | Pass — all 5 workspaces, Next.js production build succeeds (9 static routes) |
| Storybook static build | `pnpm --filter @vaqcrow/web build-storybook` | Pass — "Storybook build completed successfully"; output removed afterwards (git-ignored, regenerates on demand) |
| Dependency boundaries | `pnpm run boundaries` | Pass — "no dependency violations found (367 modules, 1089 dependencies cruised)" |
| Boundary fixture tests | `pnpm run test:boundaries` | First run: 1 unrelated test (`tests/boundaries.test.ts` › "resolves both SDKs in the real app sources…") hit the same 5000ms host-load timeout, not touched by this task. Isolated re-run: pass (2.2s) — `pnpm exec vitest run tests/boundaries.test.ts -t "resolves both SDKs in the real app sources"` |

## Progress (2026-09-26)

Work resumed on `Vaqcrow#304_Task_Make_the_light_and_dark_themes_work_and_document_how_to_run_Storybook`
(issue #304) — the work moved here from the earlier `Vaqcrow#299_Task_Adopt_Storybook_for_isolated_component_development_with_Tailwind_and_HeroUI`
branch, which only landed Storybook itself (merged as PR #300) and explicitly deferred the theme
mechanism to this follow-up task, per this file's own Objective section. Found the tokens, bootstrap
script, switcher, Storybook wiring, guide and test file already written and uncommitted in the working
tree. Verified each piece against the acceptance criteria above, fixed the `--color-surface`/
`--color-border` token collision with HeroUI's own semantic tokens (see Decisions addendum), removed a
leftover `storybook-static/` build directory that was breaking lint, and ran the full verification
matrix. All checks pass, with the two known flakes both confirmed as environmental by isolated re-run.

## Next step

Commit, assess for review, open PR closing #304.
