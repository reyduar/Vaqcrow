# Bitácora — Blog en Markdown dentro de «Acerca de», respaldado por `docs/guides` (#498)

## Objetivo

Feature [#498](https://github.com/reyduar/Vaqcrow/issues/498): un **Blog público** alcanzable desde «Acerca de», donde cada artículo es un `.md` en `docs/guides/blog/` renderizado como página pública en un slug estable, con una tabla `blog_post` que mapea cada slug a su archivo fuente. Primer artículo: Vaqcrow explicado como lo hace la nota de El Economista sobre EthicHub, pero sobre Stellar (bóveda Soroban, Freighter, Testnet) en lugar de Ethereum.

## Por qué

El owner (2026-10-13) quiere una sección «Blog» dentro de «Acerca de» para artículos sobre el producto y su tecnología. Los artículos se escriben como `.md` en `docs/guides/` porque **los mismos archivos son el corpus del asistente RAG** (#499). `docs/guides/` ya tiene `freighter-and-testnet-walkthrough.md` y `storybook.md` (guía para devs), ambos con front matter (`title`, `tags`).

## Rama y entrega

- **Rama base:** `Vaqcrow#498_Feat_Publish_a_Markdown_Blog_in_About_backed_by_docs_guides` (off `main` = `f0da69a`).
- **Estrategia:** **encadenada a main, 3 PRs** (decisión del owner, 2026-10-14), porque el pronóstico (~1.200–1.400 líneas autoradas) supera el presupuesto de revisión cómoda:
  - **PR1** (rama base): migración `blog_post` + API + tests.
  - **PR2** (`…_02-web-blog`): web (lista, artículo, renderer, sección en `/about`) + tests.
  - **PR3** (`…_03-article-and-evidence`): primer artículo + evidencia + sync de la hoja de ruta.
- **Runner:** `vitest` (unit / component / functional API) y `pnpm run test:db` para RLS/grants; cierre con `pnpm run verify`.

## Especificaciones

Del cuerpo de #498 (citas textuales de las acceptance criteria) más las decisiones del owner:

- **S1.** `/about` shows a «Blog» section listing published articles (title, summary, date) linking to each article.
- **S2.** `/blog` lists every published article; `/blog/[slug]` renders one article as a page, with the Markdown rendered like a Markdown preview (headings, lists, links, code blocks, tables, images).
- **S3.** Pages are public (no account required) and shareable by link; an unknown or unpublished slug answers 404.
- **S4.** New table `public.blog_post` (`slug` unique, `source_path` relative to `docs/guides/`, `title`, `summary`, `published_at`, `created_at`), created with RLS and explicit grants in one migration, tested first on the docker profile (`pnpm run test:db`), then applied to the remote project and verified.
- **S5.** Read access through the API (port in `application/ports/`, adapter in `infrastructure/adapters/`, contract in `packages/contracts`); `apps/web` consumes contracts only.
- **S6.** A Markdown renderer for the web (e.g. `react-markdown` + `remark-gfm`) added through the dependency gate; raw HTML in Markdown is not executed (no `rehype-raw` without sanitization) — the content is treated as untrusted.
- **S7.** `source_path` is validated against `docs/guides/` so a row can never read a file outside it (no path traversal).
- **S8.** Front matter (`title`, `tags`) is parsed and not rendered as body text.
- **S9.** Routes are in English (`/blog`, `/blog/[slug]`); UI copy in Spanish.
- **S10.** The first article «Vaqcrow: …» (title to be agreed) is published, written in Spanish, inspired by the EthicHub article and adapted to Stellar; its claims respect the demo honesty rules (Testnet, no economic value, simulated KYC and ARS, AI advisory only).
- **S11.** `pnpm run verify` passes; evidence document `docs/planning/<feature-slug>-evidence.md` written.

**Decisiones del owner (2026-10-14)** — afinan S1–S8:

- **D1 (corpus, compartida con #499).** Los artículos públicos viven en `docs/guides/blog/`; `storybook.md` queda **interno** (no se publica ni entra a la wiki). `como-funciona-vaqcrow.md` y `freighter-and-testnet-walkthrough.md` quedan en la raíz de `docs/guides/`.
- **D2 (lectura en runtime).** La **API sirve el Markdown**: bundlea `docs/guides/blog/` en su imagen; `apps/web` consume solo contratos. Un artículo nuevo = **redeploy de la API**.
- **D3 (dónde vive el cuerpo / quién publica).** El cuerpo vive en **archivos del repo** (`docs/guides/blog/<slug>.md`); `blog_post` solo mapea slug→archivo + metadata; **seed por migración**; publicar = PR + deploy. **Sin CRUD de admin**; el cuerpo **no** vive en base ni en Storage.
- **D4 (enlace).** El Blog se enlaza **solo dentro de «Acerca de»**; no se toca el header/footer.
- **D5 (layout).** Sigue **las páginas de guía** (`/entrepreneur-guide`, `/investor-guide`).
- **D6 (firma/fecha).** **Solo fecha de publicación** visible (usa `blog_post.published_at`); sin byline.

## Unidades de trabajo

- [x] **WU1 — Migración `blog_post`.** Tabla + RLS + grants explícitos en una migración; probar en docker (`pnpm run test:db`), aplicar y verificar en el remoto — (S4).
- [ ] **WU2 — API.** Contrato en `packages/contracts`; puerto en `application/ports/`; adaptador que lee `docs/guides/blog/*.md` (bundleado en la imagen) con guarda anti path-traversal; front matter parseado; rutas `GET /blog` y `GET /blog/:slug`; tests funcionales — (S2, S3, S5, S7, S8, D2, D3).
- [ ] **WU3 — Web.** `/blog` (lista), `/blog/[slug]` (layout de guía), renderer Markdown (`react-markdown` + `remark-gfm`, sin `rehype-raw`) por el gate de dependencias; sección «Blog» en `/about`; tests de componente — (S1, S2, S6, D4, D5, D6).
- [ ] **WU4 — Primer artículo.** `docs/guides/blog/<slug>.md` en español, inspirado en EthicHub y adaptado a Stellar, con front matter y reglas de honestidad — (S10, D1).
- [ ] **WU5 — Evidencia y cierre.** `docs/planning/<feature-slug>-evidence.md`, sync de `docs/planning/demo-tasks-list.md`, `pnpm run verify` — (S11).

## Evaluación de seguridad (`owasp-security`)

Se completa antes de cerrar cada PR (superficies: uploads no aplican; sí **lectura de archivo** por `source_path` — A01/path traversal — y **renderizado de contenido no confiable** — A05/XSS por Markdown).

## Verificación

**WU1 — Migración `blog_post`** (2026-10-14):

- `pnpm exec supabase test db --local supabase/tests/blog_post.sql` → **RED** antes de la migración: la tabla no existía (el script corta al castear `'public.blog_post'::regclass`).
- `pnpm exec supabase migration up --local` → aplica `20261014120000_create_blog_post.sql`; `pnpm exec supabase test db --local supabase/tests/blog_post.sql` → **PASS** (39 tests, 0 fallos).
- **Remoto** (`ppvlnwejajxpsmazvnbj`): migración aplicada y verificada por SQL — tabla presente, 6 columnas, RLS on, 0 policies, `anon`/`authenticated` sin `SELECT`, `service_role` con `SELECT`/`INSERT`, 2 índices (pkey + `blog_post_published_at_idx`).
- **Drift corregido:** el primer apply vía MCP grabó su propia versión (`20261014112232`) y el nombre completo como `name`; se reparó el historial en `supabase_migrations.schema_migrations` a `20261014120000` / `create_blog_post` para que la versión y el nombre coincidan con el archivo del repo.

## Log

- **L1 (2026-10-14, pedido original del owner, verbatim):** «Retomamos Vaqcrow. Leé Engram (topic handoff/next-session-497-516 y el resumen de la sesión 2026-10-13/14). Estado: main ya tiene adentro las mejoras posteriores a v1.1.0 —#502 (skill OWASP), #497 («La traza»), #500 + #510 (header), #501 (desbordes + CTA), #512 (etiqueta) y #514 (estado activo del nav con fragmento)—. Lo único abierto es el PR #516 (sincronización de docs/planning/demo-tasks-list.md con el tablero), listo para mergear. El workspace quedó limpio: solo main más la rama del PR #516. Primero: 1) verificá si #516 se mergeó, sincronizá main y borrá la rama si corresponde; 2) lo único trabado son #498 (Blog) y #499 (asistente RAG): necesitan que el owner responda sus preguntas abiertas —recordáselas, y en particular la que comparten: si docs/guides/storybook.md (guía para desarrolladores) se publica en el Blog y entra en la wiki del asistente, o si los artículos públicos viven en una subcarpeta propia; 3) proponé por dónde arrancar. No implementes nada sin que el owner elija. Contexto ya registrado: la sección «Cómo funciona» es la excepción acordada al template y su texto vive en docs/guides/como-funciona-vaqcrow.md, leído en build; el header es ancho completo y el nav está centrado. Regla de la casa: creá siempre la rama desde main explícito — el owner mergea rápido y dos veces un push a una rama en review quedó fuera del merge.»
- **L2 (2026-10-14).** PR #516 verificado: **mergeado** (`f0da69a`); `main` sincronizado por fast-forward; rama `docs/roadmap-sync-2026-10-14` borrada (local y remota). Workspace limpio: solo `main`.
- **L3 (2026-10-14).** El owner eligió **arrancar por #498** (Blog) y respondió sus 6 preguntas abiertas (D1–D6). Estrategia de entrega: **encadenada a main, 3 PRs**.
- **L4 (2026-10-14).** **WU1 entregada** (commit WU1): migración `supabase/migrations/20261014120000_create_blog_post.sql` + test pgTAP `supabase/tests/blog_post.sql` (39 tests). Local RED→GREEN; remoto aplicado y verificado; historial remoto alineado al repo (ver Verificación). El apply vía MCP genera su propia versión, así que todo `apply_migration` de esta Feature se repara después a la versión del archivo (procedimiento a repetir en las migraciones siguientes, si las hay).
