# Adopt Storybook inside apps/web

Iteration log for Task [#299](https://github.com/reyduar/Vaqcrow/issues/299): adopt Storybook for
isolated component development with Tailwind CSS v4 and HeroUI, using the configuration a throwaway
spike verified.

## Objective

Give the repo a component workshop that renders the real primitives with the real tokens, so states
that today can only be seen by mounting a whole route become reviewable in isolation — and so the
documented accessibility and dual-theme obligations have somewhere to live.

## Problem

`docs/design/demo-ui.md` §7 inventories the components and §6 lists WCAG 2.2 AA obligations, but there
was no way to look at a component's states without a backend, a wallet or a route. The spike answered
feasibility; this task makes it part of the repo.

## Spike verdict (context, not re-derived)

`storybook build` completed with `@storybook/nextjs-vite` 10.6.0 on **Next 16.3.5 + React 19.3 +
Tailwind 4.3.3 + HeroUI 3.2.6**, and the emitted CSS carried the project tokens (`--color-trust-info`,
`trust-caution`) and the generated Tailwind utilities, so the stack stylises and not only compiles. The
framework packages declare `next: ^14.1.0 || ^15.0.0 || ^16.0.0` and `react: … || ^19.0.0`.

## Scope

In:

- `.storybook/main.ts` + `.storybook/preview.ts` importing `globals.css`, inside `apps/web`.
- `@storybook/addon-a11y`.
- Stories for the three presentational primitives that carry the trust rules and need no backend:
  `Badge` (including that no tone reads as success), `TrustBanner` (four variants) and
  `CanonicalDisclosure` (all six canonical texts).
- `storybook` and `build-storybook` scripts on `@vaqcrow/web`.
- `storybook-static/` in `.gitignore`.

Out (explicit boundary):

- **Not** a new workspace: `dependency-cruiser` and `turbo` stay untouched.
- **Not** part of `pnpm run verify`: Storybook gets its own script.
- **Not** the a11y *enforcement* (see constraints).
- **Not** the app's dual theme (see findings).

## Constraints and findings

**`storybook init` cannot be used here.** Its framework detection fails in this monorepo, so the
configuration is manual. Recorded so nobody burns time on the one-command path.

**`build-storybook` rewrites `apps/web/postcss.config.mjs` on every run.** Verified: the file was
reverted to the array form, a build ran, and it came back as `plugins: { "@tailwindcss/postcss": {} }`.
The build succeeds with either form, but Storybook normalises to the object form, so fighting it means
a dirty tree after every build. Accepted as part of the adoption and called out here because it is an
unrequested change to the app's build config.

**The a11y addon is configured, not enforced.** `a11y: { test: "error" }` only fails when stories are
actually executed as tests, which needs the Vitest addon or the test runner. Today the addon reports in
the Storybook UI; it does not fail anything in CI. Stated plainly rather than implying a gate that does
not run.

**Finding: the app has no dual theme.** `apps/web/src/app/globals.css` is 22 lines of light-only
`@theme` tokens — no `data-theme`, no dark tokens, no switcher — while `demo-ui.md` §5.8 and the design
brief §8 make light **and** dark mandatory deliverables for every flow, and the generated templates
define both. A theme toolbar in Storybook was therefore left out on purpose: it would switch nothing.
The dual-theme implementation is its own task.

**Finding: the brand accent lives in the templates, not in the app.** The templates use `#8A05BE`;
`globals.css` defines no brand token at all.

## Acceptance criteria

- [x] `build-storybook` completes on the workspace versions
- [x] Stories exist for the three primitives, with their critical states
- [ ] The theme switcher drives `data-theme` and both themes render — **not achievable**: the app has
      no dark tokens (see findings)
- [x] The a11y addon is configured and its status stated honestly
- [x] `lint`, `typecheck`, `test`, `boundaries`, `test:boundaries` stay green
- [x] `pnpm run verify` is unchanged: Storybook is not wired into it
- [x] `storybook-static` cannot be committed by accident

## Verification evidence

| Unit | Command | Result |
| --- | --- | --- |
| build | `pnpm --filter @vaqcrow/web build-storybook` | `Storybook build completed successfully` |
| typecheck | `pnpm --filter @vaqcrow/web typecheck` | exit 0 |
| lint | `pnpm --filter @vaqcrow/web lint` | 0 errors (1 pre-existing warning, unrelated) |
| tests | `pnpm --filter @vaqcrow/web test` | 74 files / 496 tests |
| boundaries | `pnpm run boundaries` | no dependency violations (365 modules, 1083 dependencies) |
| boundary tests | `pnpm run test:boundaries` | 7 files / 83 tests |
| ignore | `git status --short` after a build | `storybook-static/` does not appear |
| config | revert `postcss.config.mjs`, rebuild | reverted file came back rewritten by the build |

## Next steps

1. Implement the dual theme in the app (`data-theme` + `vaqcrow-theme`), then wire the Storybook theme
   toolbar — it becomes meaningful the moment the tokens exist.
2. Enforce a11y in CI via the Storybook Vitest addon, or decide it stays advisory.
3. Stories for the state-heavy containers (`CampaignWorkspace`, `TrustBanner` inside routes) with the
   existing protocol doubles, which is where the vault and transaction states live.
