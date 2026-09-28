# Storybook Pages publishing

Iteration log for issue #326, branch `Vaqcrow#326_Task_Publish_the_Storybook_workshop_to_GitHub_Pages`.

## Objective

Give the component workshop a shareable URL. `README.md` documents Storybook and its two themes, but until
now stated that no URL was published; this closes that gap without touching the web or API deployments.

## Why

- The workshop is built by `pnpm --filter @vaqcrow/web build-storybook` into `apps/web/storybook-static/`,
  which is git-ignored, and is deliberately outside `pnpm run verify`.
- Reviewers and the demo audience cannot run the repo, so a hosted build is the only way to look at the
  components without cloning.

## Scope

In: `.github/workflows/storybook.yml`, `.github/pages/index.html`, the README paragraph and the
`docs/guides/storybook.md` section that point at the URL.

Out: any change under `apps/web` (no Storybook configuration change), any change to `.github/workflows/ci.yml`,
and any change to the Vercel or Railway deployments.

## Decisions

- **D1 — GitHub Pages, not a second Vercel project.** Vercel documents that `buildCommand` in `vercel.json`
  *"overrides the default project settings"*, and the repository-root `vercel.json` builds only
  `@vaqcrow/web` with the Next.js preset. A second Vercel project on this repository would therefore keep
  building the app rather than the workshop, unless the web deployment's configuration were relocated out of
  `vercel.json` first — a change to a deployment that already works. Vercel does ship a native `storybook`
  framework preset, so that route stays open if the web configuration is ever moved.
- **D2 — The workshop lives under `/storybook/`.** The site root `/Vaqcrow/` forwards to it
  (`.github/pages/index.html`), leaving room for other published artifacts at sibling paths later. The static
  build emits relative asset paths, so no `base` configuration is needed; the generated HTML was inspected to
  confirm it (`./assets/...`, `./sb-manager/...`, with no absolute `/<path>` references).
- **D3 — A separate workflow file.** `ci.yml` is untouched, so the documented pull-request gate stays fast and
  the deterministic `tests/testing-and-ci-gates.test.ts` (which asserts on `ci.yml` only) keeps holding.
- **D4 — Pull requests build, `main` publishes.** A broken workshop fails before merge instead of after.
- **D5 — No secret, no external endpoint.** Same discipline as `ci.yml`.

## Tasks

- [x] T1 — workflow that builds the static workshop and publishes it to Pages
- [x] T2 — README + guide point at the published URL
- [ ] T3 — verify the build job on the pull request, and the published URL after the merge

## Verification

- The static build is already exercised locally (`pnpm --filter @vaqcrow/web run build-storybook`).
- The pull request runs the workflow's build job without publishing.
- After merge, `https://reyduar.github.io/Vaqcrow/storybook` serves the workshop.

## Progress

The workflow, the redirect page and the two documentation pointers are in this branch's first commit. No
`apps/web` source is touched, so `pnpm run verify` and `pnpm run test:boundaries` are unaffected.
