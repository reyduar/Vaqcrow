# Align planning with the template

## Objective

Record the owner's 2026-10-01 product decisions across the planning corpus so that the documents agree with the 74 GitHub issues (#368–#441) already created: the app becomes a role-based product shaped exactly like the Claude Design template, not a single scripted journey.

## Problem

`README.md`, `docs/planning/DEMO.md`, `docs/planning/demo-tasks-list.md`, `docs/design/demo-ui.md` and the `CLAUDE.md`/`AGENTS.md` twins still described a single scripted six-step journey, no real authentication, Auth.js v5 as the future auth boundary and a "7-minute" demo target. Several of these claims are now false or were never the owner's. The design-vs-planning observation in `CLAUDE.md` and `demo-tasks-list.md` was recorded as an open question.

## Authorized scope

Docs only. No application code, no migrations, no GitHub changes (the issues already exist), no push, no pull request. `docs/design/design_handoff_vaqcrow/` stays untracked and untouched.

## Route and mode

- Route: delegated direct (one writer, 6 non-trivial documents). No SDD artifacts.
- TDD: strict mode is configured for the repo, but this work unit changes no behavior; the check is documentation consistency (`cmp`, `rg`, `git diff --check`).
- Branch: `docs/align-planning-with-template` from `origin/main`.

## Decisions recorded (owner, 2026-10-01) and rationale

1. **Role-based product.** Modules: Landing, Login/Crear cuenta, Explorar PyMEs, Detalle PyME, PyME area (Mi campaña), investor area (Mi portafolio, Informes), Admin console (`/admin`, no public signup), Acerca de, Ayuda (RAG assistant is future), Guía de inversión, Guía para emprendedores. The template handoff (`docs/design/design_handoff_vaqcrow/`) is the visual and behavioral source of truth. *Why:* the template already designs these screens; a single scripted journey cannot express three roles.
2. **No time target.** The "7-minute" demo target is removed. *Why:* the owner never proposed it. Evidence documents and `odd/tasks` history keep their measured facts as historical records.
3. **Real authentication.** Supabase Auth (email/password), roles PYME / INVERSOR / ADMIN, RLS per role. Supersedes Auth.js v5 (#134) and "no real authentication". The super admin ("Admin Vaqcrow", `vaqcrow.admin`) is seeded from env vars never committed (public repo); other admins are invited. *Why:* roles and RLS need an identity that Postgres can verify; Supabase Auth gives that without a second identity authority.
4. **Investor KYC** is simulated and auto-approved at the first contribution; no manual admin approval of investors. *Why:* keeps KYC a replaceable simulation and avoids inventing an admin queue the template does not design.
5. **Documents and photos** are really uploaded to a private Supabase Storage bucket (per-owner RLS, 10 MB, PDF/JPG/PNG). AI runs in two steps (completeness, then risk), treats uploaded content as untrusted and stays advisory.
6. **Non-custodial always.** The PyME connects/creates Freighter and gives its public key before admin review. Admin approval triggers the platform-signed factory deploy (`POST /campaigns`) with the PyME account as immutable destination and publishes the PyME. Monthly, the PyME declares sales, the platform computes and builds the distribution tx, the PyME signs. ARS↔asset stays simulated.
   - **Rejected alternative: a custodial "managed account".** It was considered and rejected by the owner. *Why rejected:* it would make Vaqcrow hold keys and move third-party money, contradicting the non-custodial premise every disclosure rests on and turning a Testnet demo into something that looks like regulated custody. Do not relitigate.
7. **Notifications.** In-app bell for all three roles plus email via Resend behind a port/adapter; PR-gated tests use a double.
8. **Role workflows** (PyME, investor, admin) as listed in `DEMO.md` §3.
9. **Anything the template does not design** is an open question in its issue, never invented.

## Issues

| Epic | Issue | Title |
|---|---|---|
| A | #368 | Identity and access |
| B | #373 | Public site |
| C | #374 | PyME onboarding and campaign |
| D | #375 | Admin console |
| E | #376 | Marketplace and investor area |
| F | #377 | Notifications |

Features (Tasks are #N+1 Implement, #N+2 Test, #N+3 Document evidence): #369 auth/roles/RLS, #378 account and shell, #382 notifications, #386 admin login and queue, #390 users and audit, #394 About/guides/help, #398 PyME onboarding and upload, #402 AI completeness, #406 PyME Freighter, #410 review and approve → deploy and publish, #414 Explorar and listing API, #418 landing, #422 detail and contribution, #426 portfolio, #430 reports, #434 Mi campaña, #438 retire the scripted journey (parent: existing Epic #10). #33 is now also blocked by #438. #31 and #32 are unchanged; #34 follows #33. Parent and `blocked by` relations were verified against GitHub on 2026-10-01 and all 74 issues are `OPEN` in the Project #4 at `Backlog`.

Suggested order: #369 → #378/#382/#386/#394 → #398 → #402/#406 → #410 → #414/#390 → #418/#422/#434 → #426 → #430 → #438 → #33 → #34.

## Checklist

- [x] T1 — `docs/planning/demo-tasks-list.md`: new section with index entries, 6 Epics, 17 Features, 51 Tasks, `^issue-N` anchors, proposed branches, dependencies, waves 10–19; #33 and #10 updated; #134 marked superseded; "Comenzar aquí" and "Política de orden" updated. Commit `b4e6a9f`.
- [x] T2 — `docs/planning/DEMO.md`: scope rewritten to the role-based product, real-vs-simulated matrix, role workflows, presentation script without timings, stack and architecture (Supabase Auth/Storage, Resend, `/admin` inside `apps/web`), non-custodial settled decision. Commit `589219f`.
- [x] T3 — `README.md`: roadmap section with Epic links, current-vs-planned, handoff path, time target removed (measured AI latency kept). Commit `077f972`.
- [x] T4 — `docs/design/demo-ui.md`: time framing removed, Auth.js direction replaced, handoff path added. Commit `8bb1a17`.
- [x] T5 — `docs/planning/demo-run-preflight.md`: time target removed from the runbook intro. Commit `e7b0d79`.
- [x] T6 — `CLAUDE.md` and `AGENTS.md` (byte-identical): settled decisions, planned-vs-implemented layout note, resolved open question. Commit `dbbcfd2`.
- [x] T7 — this document (committed last; its hash is in `git log`).

## Verification (observed, working tree)

- `cmp CLAUDE.md AGENTS.md`: no output, exit 0 (identical).
- `git diff --check origin/main..HEAD`: clean.
- The seven-minute scan over `README.md`, `DEMO.md`, `demo-tasks-list.md`, `CLAUDE.md`, `AGENTS.md`, `demo-ui.md` and `demo-run-preflight.md` leaves only the two lines in `CLAUDE.md`/`AGENTS.md` that state the target was removed.
- `package.json` has no markdown or doc-check script (`lint` is `turbo run lint`, `lint:tests` is `eslint tests/`), so none was run.
- Anchors: 74 new `^issue-N` anchors in `demo-tasks-list.md`, one per #368–#441.

## Historical records not rewritten

These keep the measured seven-minute facts as history and were left unchanged: `docs/planning/complete-vertical-demo-journey-evidence.md` (lines 7, 85, 97, 103, 126), `odd/tasks/document-evidence-for-complete-vertical-demo-journey.md`, `odd/tasks/complete-vertical-demo-journey.md`. The acceptance text of the GitHub issue #95 ("…in seven minutes or less") is quoted verbatim by the evidence document and was not edited; whether #95's criterion should be amended on GitHub is the owner's call.

## Open questions

Recorded in each Feature issue ("Not designed in the template"), not decided here. The owner decides each before implementation.

- #369: email confirmation and password reset for PYME/INVERSOR; super-admin seed runbook.
- #378: Ingresar page (layout, errors, reset, verification); replacement for the "no real authentication" copy; source of the display name.
- #382: bell placement for PYME/INVERSOR; copy for PyME and investor events and email templates; preferences and a notifications page.
- #386: queue loading/empty/error states; what a non-admin sees at `/admin`; user-chip role line.
- #390: invitation form and states; role-change control; investor KYC column; search and pagination.
- #394: guide copy conflicting with platform-signed deployment; destinations of contact links and Términos; RAG behavior.
- #398: photo UI and document slots; drafts and resubmission; step-3 copy conflict; demo banner vs real upload.
- #402: how the PyME sees completeness; whether it blocks submission; AI states and how files are read.
- #406: Freighter edge states; changing the key before approval; where the connect step sits.
- #410: document viewer; "Pedir" communication; deployment progress/failure states; what "Límite aprobado" controls and who sets campaign terms; copy conflict.
- #414: favorites persistence; card images from a private bucket; pagination.
- #418: featured campaign selection; the "Recorré la demo completa" block; assistant behavior.
- #422: detail states beyond "Fondeo abierto"; where investor KYC appears; who sets deadline and minimum; error states and "Retirar".
- #426: refund action and state; withdraw confirmation, empty and no-wallet states; Testnet funds for investors; history and explorer link.
- #430: reports for other roles; export; custom ranges and period generation.
- #434: monthly declaration entry; "Revisar y firmar"; historic vaults; ARS + XLM convention; loading funds into the PyME wallet; PyME-side review states.
- #438: fate of the landing block and its CTA; where the Testnet evidence view lives.

## Not reconciled

- #30 ("Integrate the complete vertical demo journey") is still open and unchanged while #438 retires the journey routes; how the two relate is undecided (noted in the #30 entry of `demo-tasks-list.md`).
- The first trust disclosure in `DEMO.md` §12 (and `disclosures.ts`, `demo-ui.md` §2/§11) calls identity synthetic; with real auth it needs a coordinated rewrite across the four canonical surfaces when #369/#378 are implemented. Flagged in `DEMO.md` §12, not edited.

## Next step

Review the branch; push and PR are the owner's decisions. First implementation unit after merge: #369.
