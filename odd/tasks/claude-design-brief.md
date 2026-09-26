# Claude Design brief for a modern fintech template

Iteration log for the request: turn `docs/design/demo-ui.md` into a self-contained brief that Claude
Design can consume to generate a **new template** in a modern fintech style, covering the project's
real scope.

## Objective

Produce one document with everything a design tool needs and nothing it has to guess: the product
scope and its honest limits, the complete view inventory (19 flows, not just the 6 demo screens), the
design system to generate (direction, tokens, components), the non-negotiable trust rules the template
must encode, accessibility, and ready-to-paste prompts.

## Problem

`demo-ui.md` is a strong design document, but it is (a) written around Google Stitch, and (b) explicit
that only 6 of its 19 flows have a specification and a prompt. Handing it to Claude Design as-is would
leave 13 views undefined and would mix a design brief with a Stitch execution log.

## Why

The owner wants to redo the whole web design with Claude Design. The value is a brief that is
design-tool agnostic, complete over the 19 flows, and that preserves the constraints which are product
decisions rather than taste.

## Scope

In:

- One new document under `docs/design/`, in Spanish, with the ready-to-paste prompts in English
  (matching the existing design corpus convention: prompts English, visible UI copy neutral Spanish).
- Full 19-flow inventory with per-view purpose, actor, key content and critical states.
- Design system to generate: direction, tokens, typography, grid, components, states, motion.
- Non-negotiable trust rules and the prohibited-terms list.
- Accessibility (WCAG 2.2 AA) and responsive/theme obligations.
- A master prompt plus a per-flow prompt strategy, and the theme/mobile matrix.

Out (explicit boundary):

- No change to `demo-ui.md` itself; it stays the source and the Stitch record.
- No code, no tokens committed, no dependency change. This is a design brief.
- The aesthetic evolution is proposed **within** the existing trust rules. Where a rule is a product
  decision rather than taste, the brief says so instead of relaxing it silently.

## Source of truth used

`docs/design/demo-ui.md` (§1–§7, §10, §11.9, §12), `docs/planning/DEMO.md`,
`docs/planning/product.md` (§1–§3), `docs/planning/stellar-blockchain-requirements.md`, and the
implemented routes under `apps/web/src/app/(demo)/`.

## Acceptance criteria

- [ ] Every one of the 19 flows has a view entry with actor, purpose, key content and critical states
- [ ] The design system states exact tokens, typography and grid, not adjectives alone
- [ ] The non-negotiable trust rules are listed as hard constraints, with their reason
- [ ] The prohibited-terms list is carried over verbatim
- [ ] Accessibility and the light/dark + desktop/mobile matrix are explicit deliverables
- [ ] A ready-to-paste master prompt and a per-flow prompt strategy exist
- [ ] It says plainly what the product is **not** (non-production, Testnet, simulated, advisory AI)

## Tasks

- [x] T1 — Exploration: tokens, components, a11y, 19 flows, business model
- [x] T2 — Write `docs/design/claude-design-brief.md`
- [x] T3 — Structural read-back and consistency check against `demo-ui.md`
- [ ] T4 — Assess for review and report

## Progress

- 2026-09-25 — Explored `demo-ui.md` §1–§7/§10–§12, `product.md` §1–§3 and the implemented routes.
  Confirmed the coverage gap (13 of 19 flows without spec or prompt) and the Stitch coupling.
- 2026-09-25 — Wrote the brief: 12 sections, the full 19-flow inventory with per-view fiches, the design
  system, the non-negotiables, the 76-screen matrix and the ready-to-paste master prompt.
- 2026-09-25 — Extended the root consistency guard to include the new document. The brief duplicates the
  six canonical disclosures, so leaving it unguarded would recreate the exact drift class fixed under
  #295. The guard now covers three documents and passes (4 tests).

## Verification evidence

| Unit | Command | Result |
| --- | --- | --- |
| T3 | `pnpm run test:boundaries` | 7 files / 83 tests passed — the six canonical disclosures are verbatim in the brief |
| T3 | `pnpm exec vitest run tests/boundaries.test.ts` | 25/25 in isolation after a 5 s load timeout in the full run |

## Next step

T4: assess the range for review, then open the PR.
