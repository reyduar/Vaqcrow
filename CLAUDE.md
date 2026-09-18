# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vaqcrow is a pnpm/Turborepo monorepo for a TFM (Máster en Desarrollo con IA) demo: revenue-share financing for Argentine SMEs, with AI-assisted evaluation, human approval, and settlement on Stellar Testnet. The demo is explicitly non-production: identity, KYC/KYB, sales history and the ARS/asset broker are all **simulated**; Stellar runs on Testnet with no economic value; the AI is advisory only and never approves, calculates obligations, or moves funds. See `README.md` and `docs/planning/DEMO.md` for the full product/demo narrative — do not restate unsupported production claims in code, UI copy, or docs.

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
pnpm --filter @vaqcrow/api test:integration  # credential-gated Supabase integration suite (see below); never part of `pnpm run test`
pnpm --filter @vaqcrow/api exec vitest run path/to/file.test.ts   # single test file
pnpm --filter @vaqcrow/api exec vitest run -t "test name"         # single test by name

pnpm --filter @vaqcrow/api dev   # Fastify API, tsc --watch + node --watch
pnpm --filter @vaqcrow/web dev   # Next.js dev server
```

`test:integration` (in `apps/api`) needs real `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` and writes to the live Supabase project — it is intentionally excluded from `pnpm run test`, `pnpm run verify`, and any CI gate. Only run it with an operator's real credentials, never with fabricated ones.

Turbo tasks (`build`, `typecheck`, `test`) declare `dependsOn: ["^build"]`, so package builds run in dependency order automatically; `lint` has no such dependency.

## Architecture

### Workspace layout (implemented vs. planned)

Only `apps/web`, `apps/api`, `packages/domain`, `packages/contracts`, and `supabase/` (config + one migration) are implemented today. `docs/architecture/monorepo.md` documents the full target tree (`apps/worker`, `packages/ai|stellar|simulators|db|config|testing|ui`) as an authorized-but-not-yet-built plan — treat anything from that doc referencing those paths as forward-looking, not current state.

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

### Testing philosophy

Pull-request-gated tests (`pnpm run test`, and everything `pnpm run verify` runs) never depend on Stellar Testnet, Horizon, or the LLM provider — they use local doubles and fixtures so external flakiness is never confused with a real regression. Live-service checks (Testnet transactions, the Supabase integration suite) run separately, manually or in a bounded non-blocking job, gated on real credentials being present. `docs/planning/DEMO.md` §11 is the source of truth for the intended test-level matrix (unit/domain, API functional, golden/AI, component, adapter-contract, boundaries, Playwright E2E, Testnet operational check) if you need to place a new test.

### Planning vs. implementation

`docs/planning/DEMO.md` is the scope source for the demo; GitHub Issues in the `Vaqcrow-TFM` Project organize execution as Epic → Feature → Task. Issues follow a recurring pattern: a Feature's sub-issues (Implement/Test/Document-evidence Tasks) can all be closed while GitHub leaves the parent Feature open — check `subIssuesSummary`/native blocking relations before trusting an issue's open/closed state, and close the Feature manually once its Tasks are done. Evidence for completed Features is written to `docs/planning/*-evidence.md` (Spanish, established format — read an existing one before writing a new one).
