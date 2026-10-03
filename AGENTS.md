# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vaqcrow is a pnpm/Turborepo monorepo for a TFM (Máster en Desarrollo con IA) demo: revenue-share financing for Argentine SMEs, with AI-assisted evaluation, human approval, and settlement on Stellar Testnet. The product is becoming a role-based app (PYME / INVERSOR / ADMIN) shaped exactly like the Claude Design template, not a single scripted journey (see Settled decisions). The demo is explicitly non-production: KYC/KYB, sales history and the ARS/asset broker are **simulated** (accounts, roles and uploaded documents are planned to be real); Stellar runs on Testnet with no economic value; the AI is advisory only and never approves, calculates obligations, or moves funds. See `README.md` and `docs/planning/DEMO.md` for the full product/demo narrative — do not restate unsupported production claims in code, UI copy, or docs.

## Commands

Requires Node `>=24.0.0 <25.0.0` and pnpm `11.27.0` (pinned in `packageManager`).

```bash
pnpm install --frozen-lockfile   # install (also: pnpm run install:verify)

pnpm run verify                  # lint + typecheck + test + build + boundaries + test:boundaries — run this before considering a change done
pnpm run lint                    # turbo run lint (eslint, all workspaces)
pnpm run typecheck               # turbo run typecheck
pnpm run test                    # turbo run test (vitest run, all workspaces)
pnpm run build                   # turbo run build
pnpm run boundaries               # dependency-cruiser against apps/*/src, packages/*/src
pnpm run test:boundaries          # vitest run of the boundary-rule fixture tests

pnpm --filter @vaqcrow/api test              # single workspace: @vaqcrow/api | @vaqcrow/web | @vaqcrow/domain | @vaqcrow/contracts
pnpm --filter @vaqcrow/api test:integration          # credential-gated Supabase integration suite (see below); never part of `pnpm run test`; defaults to the docker profile
pnpm --filter @vaqcrow/api test:integration:docker   # same suite, explicit docker profile (.env.docker)
pnpm --filter @vaqcrow/api test:integration:cloud    # same suite against the remote project (.env.cloud)
pnpm --filter @vaqcrow/api exec vitest run path/to/file.test.ts   # single test file
pnpm --filter @vaqcrow/api exec vitest run -t "test name"         # single test by name

pnpm --filter @vaqcrow/api dev          # Fastify API, tsc --watch + node --watch, no profile (shell env)
pnpm --filter @vaqcrow/api dev:cloud    # Fastify API against the remote Supabase project (.env.cloud)
pnpm --filter @vaqcrow/web dev          # Next.js dev server
pnpm run dev:web:docker                 # Next.js dev server against the local docker profile (.env.docker)
pnpm run dev:web:cloud                  # Next.js dev server against the remote project (.env.cloud)

pnpm run env:docker:up      # start local Supabase + Stellar Quickstart + apps/api in a container (docker profile)
pnpm run env:docker:down    # stop the api container and local Supabase (add `-- --all` to also stop Quickstart)
pnpm run env:docker:status  # status of every piece, never prints a key value
pnpm run test:db            # supabase test db --local supabase/tests — always against the local stack
```

`test:integration` (in `apps/api`) needs real `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` and writes to a live Supabase project — it is intentionally excluded from `pnpm run test`, `pnpm run verify`, and any CI gate. It defaults to the docker profile (local Supabase) so an accidental run never writes to the demo project; `test:integration:cloud` opts into the remote one. Only run either with an operator's real credentials, never with fabricated ones. See `docs/architecture/environments.md` for the full `.env.cloud`/`.env.docker` profile split.

Turbo tasks (`build`, `typecheck`, `test`) declare `dependsOn: ["^build"]`, so package builds run in dependency order automatically; `lint` has no such dependency.

## Architecture

### Workspace layout (implemented vs. planned)

Only `apps/web`, `apps/api`, `packages/domain`, `packages/contracts`, and `supabase/` (config + one migration) are implemented today. `docs/architecture/monorepo.md` documents the full target tree (`apps/worker`, `packages/ai|stellar|simulators|db|config|testing|ui`) as an authorized-but-not-yet-built plan — treat anything from that doc referencing those paths as forward-looking, not current state. The same goes for the role-based modules (landing, marketplace, PyME/investor areas, `/admin` console, Supabase Auth, Storage upload, notifications): they are planned as Epics #368–#377 and are **not implemented** — `main` still has the six-step scripted journey and its engine on a demo session. The admin console is a `/admin` route group inside `apps/web`, not a new app.

### Enforced dependency boundaries

`.dependency-cruiser.cjs` (run via `pnpm run boundaries`) is the authoritative, machine-checked version of the architecture — more reliable than prose docs when they disagree:

- No circular imports anywhere; `packages/*` may never import `apps/*`; no cross-app imports (`apps/web` and `apps/api` are fully isolated from each other).
- `apps/web` may never import `packages/domain` (web consumes `packages/contracts` only; domain is backend-authoritative).
- `packages/domain/src` (production code, not `*.test.ts`) may not import any npm dependency — it stays framework-free by design.
- `packages/contracts/src` (production code) may not import Node core modules or Fastify — its exports must stay portable to both Node and browser consumers.
- Inside `apps/api/src`: `application/` (use cases, ports) may not import Fastify, Supabase, Stellar SDK, or LLM provider SDKs except as type-only imports — those belong in `infrastructure/`.
- Inside `apps/web/src`: `presentation/` may not import `packages/contracts` except as type-only; `application/` (pure data/selectors: trust copy, fixtures, navigation) may not import React — that belongs in `presentation/`/`state/`.

Both `apps/api` and `apps/web` follow the same internal layering: `application/` (ports, use cases, pure logic) → `infrastructure/` (adapters, HTTP/Supabase/wallet wiring) → (`apps/web` adds) `presentation/` (components) and `state/`. New backend capabilities should land as a port in `application/ports/` with the concrete implementation in `infrastructure/adapters/`.

### Persistence pattern (Supabase)

`apps/api`'s persistence layer (see `apps/api/src/infrastructure/adapters/`, `supabase/migrations/`) establishes the pattern for future tables: a single migration creates the table, enables RLS, and sets explicit grants atomically (no default `anon`/`authenticated` grants ever survive even transiently); state transitions use a conditional `UPDATE ... WHERE id=$1 AND state=$from` rather than upsert, so a replayed request is idempotent instead of double-applying; adapters map Postgres/PostgREST errors to a sanitized error shape and never leak `message`/`details`/`hint` to callers.

### Supabase migration workflow

The configured remote Supabase project is the default database target and where every migration must land. The docker environment profile (`docs/architecture/environments.md`; started with `pnpm env:docker:up`, which the user has authorized for this purpose) is where a migration is tested first — do not start, stop, or repurpose any other Docker resource without explicit approval. Once the local migration test passes (`pnpm run test:db` against the local stack), apply that same migration to the remote Supabase project in the same work unit, then verify its schema, grants/RLS, and migration-history version match the repository. Do not report a migration as complete while the remote project is behind, and do not use the local database as a substitute for the remote update.

### Testing philosophy

Pull-request-gated tests (`pnpm run test`, and everything `pnpm run verify` runs) never depend on Stellar Testnet, Horizon, or the LLM provider — they use local doubles and fixtures so external flakiness is never confused with a real regression. Live-service checks (Testnet transactions, the Supabase integration suite) run separately, manually or in a bounded non-blocking job, gated on real credentials being present. `docs/planning/DEMO.md` §11 is the source of truth for the intended test-level matrix (unit/domain, API functional, golden/AI, component, adapter-contract, boundaries, Playwright E2E, Testnet operational check) if you need to place a new test.

### Planning vs. implementation

`docs/planning/DEMO.md` is the scope source for the demo, and `docs/planning/demo-tasks-list.md` is the executable roadmap (its "Hoja de ruta alineada al template" section covers #368–#441, suggested order #369 → #378/#382/#386/#394 → #398 → #402/#406 → #410 → #414/#390 → #418/#422/#434 → #426 → #430 → #438 → #33 → #34); GitHub Issues organize execution as Epic → Feature → Task and are tracked on the [Vaqcrow-TFM](https://github.com/users/reyduar/projects/4) Project board — every issue worked on should be there, not just a bare repo issue. Issues follow a recurring pattern: a Feature's sub-issues (Implement/Test/Document-evidence Tasks) can all be closed while GitHub leaves the parent Feature open — check `subIssuesSummary`/native blocking relations before trusting an issue's open/closed state, and close the Feature manually once its Tasks are done.

`docs/planning/` holds the rest of the planning corpus — check it before assuming scope or architecture for a given technology:
- `product.md` — the real-product roadmap beyond the demo (Argentina-specific risks, production decisions still open).
- `stellar-blockchain-requirements.md` — the authoritative Stellar scope: **the funding is custodied by a Stellar contract (Rust + `soroban-sdk`)**, one vault per campaign, with atomic payout on reaching the goal and permissionless refunds; classic Testnet payments via `@stellar/stellar-sdk` + Horizon + Freighter remain the path for revenue-share distribution and for every user signature. Stellar Claimable Balance (CAP-23) was evaluated and **rejected** — its predicates have time-only leaves, so "goal reached" is not expressible on-chain. Contract work is mandatory here, not optional extension work.
- `demo-tasks-list.md` — the executable roadmap; see Branching below for how it drives branch names.
- `*-evidence.md` files (e.g. `domain-states-and-shared-contracts-evidence.md`, `trust-disclosures-and-synthetic-fixtures-evidence.md`, `supabase-schema-and-persistence-evidence.md`) — the established format for a Feature-closing evidence doc; read one before writing a new one rather than inventing a structure.

**Every Feature closes with an evidence document in `docs/planning/`.** The Document-evidence Task of each Feature produces one, named `<feature-slug>-evidence.md`, and the Feature is not closed without it. Write it in **Spanish**: the evidence corpus is Spanish (eight of the ten documents as of 2026-09-20); English (`human-assessment-and-approval-evidence.md`, `deterministic-testing-and-ci-gates-evidence.md`) is the exception, not the convention — check the corpus rather than sampling a single document. Keep the established structure (read a sibling first), map every acceptance criterion quoted verbatim from its issue, and name the source of every verification result — a command re-run in the working tree, or a CI run — never reporting a merged state that does not exist yet.

`odd/tasks/<slug>.md` is the iteration log that feeds that document: work units with commit hashes, RED→GREEN cycles, design decisions, advisories and how each was resolved. Keep it detailed enough that the evidence document can be written from it without re-deriving anything, and keep it current as the work happens. `odd/` is versioned — it is the record of how the work actually happened, not scratch space.

## Documentation alignment and settled decisions

A change to behavior, a variable's contract, or a verified fact must update every document that repeats it. The documents to check and keep aligned: `docs/planning/*-evidence.md` (the evidence corpus, authoritative for what was actually verified), `docs/architecture/*.md` (how the system works and its honest limits), `docs/planning/demo-run-preflight.md` (the operator runbook), `odd/tasks/*.md` (iteration logs and task records), and `AGENTS.md`/`CLAUDE.md` themselves — byte-identical twins that must be edited together.

Before writing or approving a factual claim of the form "this was proven", "this was never exercised", or "this variable is required", cross-check it against the evidence corpus **and** the code. A document that contradicts the evidence corpus is a defect, not a nuance — a stale "never exercised" claim once survived a four-lens review and sent an operator to a needless rehearsal.

`scripts/demo/preflight` mirrors the `apps/api` config modules (`apps/api/src/application/config/`). When one side's requirement changes — a variable becomes optional, a default changes, a check is added — the other side and its tests change in the same work unit; the preflight probes what the API would actually use rather than restating its requirements from memory.

Settled decisions — do not relitigate without new evidence:

- **No database reset between rehearsals (Option A).** Each rehearsal creates a fresh application and campaign; the evidence page filters by the current run's identifiers.
- **The canonical Testnet Horizon/RPC endpoints are defaults, not required variables.** Both `STELLAR_HORIZON_URL` and `STELLAR_RPC_URL` are optional, falling back to `https://horizon-testnet.stellar.org` and `https://soroban-testnet.stellar.org`.
- **The platform-key ↔ factory-`owner` correspondence is retired (proven 2026-09-25).** `POST /campaigns` deployed a vault on the hosted deployment; never describe it as unproven.
- **The 2026-12-16 Testnet reset invalidates the contract addresses**, so the factory is redeployed and `STELLAR_CAMPAIGN_FACTORY_ID` re-pointed after that date.
- **The Claude Design template is the visual source of truth (owner, 2026-10-01).** The role-based handoff lives at `docs/design/design_handoff_vaqcrow/` (`README.md`, `brief/`, `screens/`); anything the template does not design is recorded as an open question in its issue, never invented. `docs/design/template/` (14 `.dc.html` screens) prevails over the written brief wherever they conflict; where the difference is a trust or accessibility **rule** rather than taste, `docs/design/demo-ui.md` §2 still prevails. Google Stitch is retired. The template directory is deliberately gitignored rather than versioned — the measured decision is in [`odd/tasks/template-stays-out-of-the-repo.md`](odd/tasks/template-stays-out-of-the-repo.md).
- **The product is role-based, not a single scripted journey (owner, 2026-10-01).** Modules: Landing, Login/Crear cuenta, Explorar PyMEs, Detalle PyME, PyME area ("Mi campaña"), investor area (Mi portafolio, Informes), Admin console (`/admin`, no public signup), Acerca de, Ayuda (RAG assistant is future, "Próximamente"), Guía de inversión, Guía para emprendedores. Explorar, guides and help are public; Detalle requires an account. Epics #368 (identity), #373 (public site), #374 (PyME), #375 (admin), #376 (marketplace/investor), #377 (notifications) plan it; #438 retires the scripted journey routes; #33 rehearses the role workflows.
- **There is no time target for the demo.** The "7-minute" target was removed: the owner never proposed it. Do not reintroduce a duration requirement in code, UI copy, scripts or docs; evidence documents and `odd/tasks` history keep their measured facts as historical records.
- **Authentication is real: Supabase Auth (email/password), roles PYME / INVERSOR / ADMIN, RLS per role.** It supersedes the planned Auth.js v5 boundary (#134) and "no real authentication". `ADMIN` is never self-assigned: the super admin ("Admin Vaqcrow", `vaqcrow.admin`) is seeded with email and password from env vars that are never committed (public repo), and other admins are invited by admins.
- **Email confirmation and password reset (owner, 2026-10-01).** Email confirmation is on for `PYME`/`INVERSOR`; Supabase Auth sends the link through Resend as its own SMTP (`no-reply@vaqcrow.com`), and the local stack uses Mailpit. The owner configured the remote dashboard on 2026-10-02 (`docs/architecture/environments.md` §13); real delivery is still unobserved until the first real signup. Password reset is deferred to a later issue; do not add it here.
- **The super admin is seeded by a manual per-profile script, never at API startup (owner, 2026-10-01).** `pnpm --filter @vaqcrow/api seed:superadmin:docker|cloud` reads `VAQCROW_SUPERADMIN_EMAIL` / `VAQCROW_SUPERADMIN_PASSWORD` from `.env.docker` / `.env.cloud` only; the password never lives in Railway, in the API config, or in the repository. The script is idempotent and never imported by `index.ts`.
- **#369 and #378 ship stacked to `main`, with no auth-mode toggle (owner, 2026-10-01).** Default-deny authorization would break the deployed web before login exists, and a misconfigured security toggle opens the API. The known gap R1-002 (PYME routes check the role but not row ownership until #398) must be resolved or explicitly accepted by the owner before that merge.
- **The human decision `actor` is the authenticated admin (#370).** It comes from the verified principal's display name, no longer from the request body; the `application_review` and `human_decision` tables stay `service_role`-only.
- **Investor KYC is simulated and auto-approved at the first contribution;** admins do not manually approve investors.
- **PyME documents and photos are really uploaded** to a private Supabase Storage bucket (per-owner RLS, 10 MB, PDF/JPG/PNG). AI runs in two steps — completeness check, then risk assessment — treats uploaded content as untrusted, and stays advisory only.
- **Vaqcrow is non-custodial, always.** It never holds keys nor receives or moves third-party money (ARS or crypto). The PyME connects/creates Freighter and gives its public key before admin review; admin approval triggers the platform-signed factory deploy (`POST /campaigns`) with the PyME account as immutable destination and publishes the PyME. Monthly, the PyME declares sales, the platform computes and builds the distribution tx, and the PyME signs in Freighter. ARS↔asset conversion stays simulated. A custodial "managed account" was considered and **rejected by the owner**: do not relitigate.
- **Notifications are an in-app bell for all three roles plus email via Resend behind a port/adapter;** PR-gated tests use a double.
- **The template issues resolve the old open question.** The owner's observation that the design issues predate the template is resolved by issues #368–#441, which start from the handoff; the five earlier adaptation slices aligned tokens and primitives, which is not the same as proving screen-by-screen fidelity — that gate stays open per screen.
- **Routes are always in English (owner, 2026-10-02).** URL paths never use Spanish, even when the screen title does: `/` (landing), `/login`, `/signup`, `/portfolio` (investor "Mi portafolio"), `/company` (PyME "Mi campaña"), `/admin`. UI copy stays in Spanish as the template writes it. Spanish paths in older docs (for example the screen → route table in `docs/design/demo-ui.md`) are superseded by this rule.
- **The PyME flow is a dashboard plus one wizard, not a sequence of routes (owner, 2026-10-02).** `/` is always the landing. Sign-in redirects by verified role: `INVERSOR` → `/portfolio`, `PYME` → `/company`; the role never comes from the sign-in form's toggle. On `/company` a "Registrar mi PyME" button shows only while the PyME has no registered company (there is no connect-wallet popup); the landing's "Quiero financiar mi negocio" leads to the same button. Registration is a single wizard screen (`Vaqcrow Onboarding PyME.dc.html`) whose stepper renders every step in place: 1 KYC (simulated) → 2 Registro PyME (data, documents and why it needs the funds) → 3 Evaluación AI → 4 Revisión humana (a connected Freighter wallet is required here, since it signs the vault deployment; approval deploys the vault on Testnet). Distribution and evidence after the goal is reached live in `/company`. No step gets its own route; the scripted six-step journey routes are retired (#438) in the same `main` delivery as #369 and #378. Signup requires "Nombre completo" (investor) or "Nombre o Razón Social" (PyME) as the display name, and the user's email is never displayed in the UI.

## Workflow

### Branching

When starting work on an issue, name the branch exactly as `docs/planning/demo-tasks-list.md` prescribes for it — every issue entry there has a **Rama propuesta** (not yet implemented) or **Rama e implementación** (already delivered) line naming the branch. The stated convention: `Vaqcrow#<number>_Feat_<original title>` for Features, `Vaqcrow#<number>_Task_<original title>` for Tasks — `Feature: `/`Task: ` stripped, spaces/punctuation replaced by `_`, original English title preserved, literal `#`. Epics never get a branch. For a chained/stacked PR split, suffix subsequent branches off the first one as `-02-<slug>`, `-03-<slug>`, etc.

### Skills

Match the active skill registry (`.atl/skill-registry.md`, kept fresh automatically) to the technology being touched, and load the matching skill before writing code in that area — this mirrors `demo-tasks-list.md`'s own "Gate compartido antes de dependencias" convention. Currently installed and relevant to this stack: `supabase` + `supabase-postgres-best-practices` (schema, RLS, migrations), `heroui-react` / `heroui-native` / `heroui-migration` (UI components), `frontend-design` (visual/UX decisions), `zustand` (client state in `apps/web/src/state/`). Stellar/Freighter/Horizon work has no skill installed yet: `docs/planning/stellar-blockchain-requirements.md` §Parte 4 (Tabla de skills recomendadas) is a vetted catalog with install commands — `stellar-dev` (Stellar Foundation) is its primary recommendation — install and load the relevant one when that work actually starts, rather than improvising. Playwright/Next.js have no dedicated skill catalog documented yet; check the registry and install through the same gate if a relevant one exists before adding either as a dependency.

> [!warning] `zustand` is an upstream skill, not a Vaqcrow convention
> `skills-lock.json` records it as sourced from `lobehub/lobehub`, so its examples (`@lobechat/types`, `flattenActions`, class-based `ActionImpl` slices, `internal_dispatch*` reducers) describe **that** codebase, not this one. Where it disagrees with the repository, the repository wins. The established pattern here is `apps/web/src/state/journey-store.ts`: `zustand/vanilla` `createStore` + `StoreApi`, wired through a context provider that creates one store per mount (`journey-store-provider.tsx` via `useState(() => createJourneyStore())`) — **never a module-level singleton** — consumed with `useStore(store, selector)`. The store holds client workflow identifiers only; SWR owns server state and the backend owns authoritative state. Use the skill for Zustand technique (selectors, store shapes, optimistic updates), not for its structural conventions.

### Obsidian-flavored Markdown

This repository is an Obsidian vault (`.obsidian/` exists) and its docs use Obsidian syntax beyond plain GFM. Any `.md` file you create or edit should keep rendering correctly in Obsidian:
- Block references: a line ending in `^block-id` is linkable as `[text](#^block-id)` — used throughout `demo-tasks-list.md` for per-issue anchors.
- Wikilinks with a display-text pipe: `[[path/to/file|Display text]]` (seen in `deploy-planning.md`) when linking to another vault file, instead of a plain Markdown link.
- Callouts: `> [!info]`, `> [!warning]`, `> [!important]`, `> [!todo]`, `> [!tip]`, `> [!question]` for admonition-style blocks, matching `deploy-planning.md` and `demo-tasks-list.md` — prefer these over plain blockquotes when the content is a note/warning/todo rather than a quotation.
