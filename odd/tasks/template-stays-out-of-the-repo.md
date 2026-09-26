# The Claude Design template stays out of the repository

Decision record for why `docs/design/template/` is gitignored instead of versioned, replacing the
approach of [#301](https://github.com/reyduar/Vaqcrow/issues/301).

## Decision

The template lives on disk and **out of the repository**. `docs/design/template/` is ignored.

## Why

The tree was going to be versioned so the visual source of truth stopped living on one machine. Two
facts, measured before committing, changed the answer.

**It is 25 MB, and 78% of its text is one build artifact.** `Vaqcrow Landing.html` alone is 2.9 MB: a
standalone export titled `Bundled Page` that loads React 18 + ReactDOM + `@babel/standalone` from unpkg
and inlines its images in a single 2.86 MB JSON map. It is derived output, not design source, and it is
the third duplicate Landing variant — the canonical one, `Vaqcrow Landing.dc.html`, uses the shared
runtime and both themes. Excluding that one file already took the payload from 3.7 MB of text to
~810 KB.

**No build reads it, so nothing is gained by having it in the tree.** Verified one by one:

| Consumer | Touches `docs/`? | Why |
| --- | --- | --- |
| `next build` | No | Next bundles only what `apps/web` imports; `next.config.ts` is empty |
| `tsc` (api, packages) | No | Each compiles its own `src` |
| Docker image | No | `.dockerignore` excludes `docs` explicitly, and the Dockerfile copies narrow paths |
| `pnpm run boundaries` | No | The glob is `apps/*/src packages/*/src` |
| ESLint | No | `turbo run lint` runs `eslint .` per package |
| Root Vitest | No | `include: ["tests/**/*.test.ts"]` |
| Turbo cache | No | Task inputs are the package's files |

Measured, to avoid arguing from prose: a clean build (`rm -rf .turbo`) took **1m18s with the template
tracked** and **1m32s without it** — no correlation, the difference is CPU noise.

What it *would* cost is transfer: `.git` went from 2.7 MB to 27 MB, paid on every clone, every CI
checkout and every Vercel build, permanently in history once merged.

**And the review gate refuses it as a single candidate.** `review.start` returned a typed refusal,
`lens_context_budget_exceeded`: the reviewer evidence exceeds the native context budget, no authority
was created, and the documented remedy is to split into smaller candidates. For 3.7 MB of text that
means a long chain of reviewed commits for generated output nobody reads as source — including one file
that cannot be split at all.

## What was done

- The single commit that added the tree was discarded and its objects reclaimed: `git reflog expire
  --expire=now --all` + `git gc --prune=now`. `.git` is back to **2.7 MB** and the commit is gone from
  the object store.
- The files were **not deleted**: they remain on disk, untracked and now ignored.
- `docs/design/template/` was added to `.gitignore` with this reasoning inline.

Operational side effect worth knowing: because the folder is now ignored rather than merely untracked,
`gentle-ai review assess` stops demanding an explicit `--untracked-scope` declaration on every run. It
was the 76-file untracked tree that triggered that.

## What this costs, stated plainly

**The template is no longer backed up by the repository.** If the machine holding it is lost, it is
lost. The mitigation is that it is regenerable: `docs/design/claude-design-brief.md` carries the system
and the anti-drift rules, and `docs/design/claude-design-continuation-pack.md` carries the per-screen
prompts and the conventions the set follows — both tracked.

This is a deliberate trade, not an oversight. Revisit it if the template becomes something the team
edits by hand, or if it needs to be shared.
