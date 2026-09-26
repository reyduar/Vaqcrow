# Roadmap sync and trust-disclosures follow-ups (#295)

Iteration log for Task [#295](https://github.com/reyduar/Vaqcrow/issues/295), the post-merge cleanup of
Feature [#240](https://github.com/reyduar/Vaqcrow/issues/240) (merged in `main` via
[PR #294](https://github.com/reyduar/Vaqcrow/pull/294), merge commit `57be415`).

## Objective

Close what #240 left open without reopening it: sync the executable roadmap with the merged state, and
close the three non-blocking review findings and the evidence finding F2 that #240 recorded instead of
silently dropping.

## Scope

In:

- Roadmap sync of `docs/planning/demo-tasks-list.md` (#240/#258/#259/#260 → `Done` + implementation
  paragraphs; the Project #4 note corrected).
- `R3-PRESIGN-NOT-PINNED` (WARNING): pin the contextual microcopy literals.
- `R3-DENYLIST-GARANTIA`: the overclaim guard must also reject the noun `garantía`.
- `R3-CANON-DUP-NO-GUARD`: a committed test for code↔documents consistency of the canonical texts.
- F2: `DEMO.md` §3/§7 and `demo-ui.md` §8 Pantalla 4 still described the retired classic funding intent.
- The three imprecise statements in the merged evidence document.

Out (explicit boundary):

- The reviewed commit of #240 is not touched: authority was burned, and mutating it would invalidate
  the receipt. This is a new change with its own review.
- The Stitch prompt block of `demo-ui.md` §11/§12 keeps the original brief; whether it should also be
  reconciled is a separate decision, recorded in the evidence document's next steps.
- `microcopy.kycStatusLabel` (dead copy, finding F5) stays untouched.

## Hygiene performed before this change

- Local `main` fast-forwarded to `57be415`.
- Epic [#235](https://github.com/reyduar/Vaqcrow/issues/235) closed manually (5/5 children completed);
  GitHub does not close Epics on its own.
- Project #4 verified: #235/#240/#258/#259/#260 were already all in `Done`; #295 added to the board.

## TDD mode

`strict_tdd: true`. The three guards are test-only additions over behaviour that already holds, so each
was verified sensitive by mutation rather than by an invented RED.

## Tasks

- [x] T1 — Roadmap sync (`ac97ba7`)
- [x] T2 — Microcopy literal pin
- [x] T3 — `garantía` in the overclaim denylist
- [x] T4 — Code↔documents canonical consistency test
- [x] T5 — F2: funding narrative reconciled to the vault (`d29bf31`)
- [x] T6 — Evidence document corrections (`17b5e64`)
- [x] T7 — Iteration log

## Verification evidence

| Unit | Command | Result |
| --- | --- | --- |
| T2/T3 | `pnpm --filter @vaqcrow/web exec vitest run trust` | 6 files / 62 tests passed |
| T4 | `pnpm run test:boundaries` | 7 files / 82 tests passed |
| T2 sensitivity | garble `preSignCheck` → run the trust suite | exactly `microcopy … "preSignCheck"` failed, nothing else |
| T3 sensitivity | add `garantía` to the custody text → run `contract-custody` | exactly `never makes a claim about legality, solvency, returns or provider quality` failed |
| T4 sensitivity | change one word of the custody text in `DEMO.md` | exactly `quotes every canonical disclosure verbatim in docs/planning/DEMO.md` failed |
| all | mutations restored from `HEAD`; suites green again | 37/37 and 82/82 |

## Next step

Run the RDD preflight for this branch range, then open the PR.
