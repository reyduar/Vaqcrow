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
- [x] **WU2 — API.** Contrato en `packages/contracts`; puerto en `application/ports/`; adaptador que lee `docs/guides/blog/*.md` (bundleado en la imagen) con guarda anti path-traversal; front matter parseado; rutas `GET /blog` y `GET /blog/:slug`; tests funcionales — (S2, S3, S5, S7, S8, D2, D3).
- [x] **WU3 — Web.** `/blog` (lista), `/blog/[slug]` (layout de guía), renderer Markdown (`react-markdown` + `remark-gfm`, sin `rehype-raw`) por el gate de dependencias; sección «Blog» en `/about`; tests de componente — (S1, S2, S6, D4, D5, D6).
- [x] **WU4 — Primer artículo.** `docs/guides/blog/<slug>.md` en español, inspirado en EthicHub y adaptado a Stellar, con front matter y reglas de honestidad — (S10, D1).
- [x] **WU5 — Evidencia y cierre.** `docs/planning/<feature-slug>-evidence.md`, sync de `docs/planning/demo-tasks-list.md`, `pnpm run verify` — (S11).

## Evaluación de seguridad (`owasp-security`)

**WU2 — API** (2026-10-14), contra OWASP Top 10:2025:

- **A01 — Broken Access Control (path traversal).** El adaptador de contenido (`filesystem-blog-content-source.ts`) rechaza, **antes de tocar el filesystem**, cualquier `source_path` absoluto, con `\`, con un segmento `..`, o que resuelva fuera de la raíz de guías (`startsWith(root + sep)`); un path rechazado se reporta como `value: undefined` y nunca se lee. Cubierto por tests (`../storybook.md`, `/etc/passwd`, `a\b.md`, vacío). **Sin hallazgo.**
- **A05 — Injection (XSS).** WU2 devuelve el Markdown como **string JSON** y no ejecuta HTML; el renderizado (y la no-ejecución de HTML crudo) es de WU3, en el web. **Sin hallazgo en esta unidad.**
- **A10 — Mishandling of Exceptional Conditions.** Falla cerrado: un archivo faltante o un error de I/O se resuelven a `unavailable`/`not_found`, nunca a un 200 vacío. **Sin hallazgo.**

Pendiente para WU3: el renderer Markdown del web (no ejecutar HTML crudo sin sanitizar).

**WU3 — Web** (2026-10-14), contra OWASP Top 10:2025:

- **A05 — Injection (XSS).** `react-markdown` + `remark-gfm` **sin `rehype-raw`**: el HTML crudo del Markdown nunca se convierte en DOM (un test prueba que un `<script>` en el cuerpo queda inerte, sin elemento `script`); se conserva el `urlTransform` por defecto (descarta protocolos peligrosos como `javascript:`); sin `dangerouslySetInnerHTML`; links externos con `rel="noreferrer noopener"` + `target="_blank"`. **Sin hallazgo.**
- **A03 — Injection.** El slug se percent-encode antes de la request; la API ya valida el slug y tiene su propia guarda anti-traversal (WU2). **Sin hallazgo.**
- **A06 — Componentes vulnerables.** Dependencias agregadas por el gate cumplido (Context7, `/remarkjs/react-markdown`); lockfile actualizado; política de supply-chain de pnpm pasó. **Sin hallazgo.**
- **A10 — Falla cerrada.** Cuerpo malformado → `unavailable`, 404 → `not_found`, transporte → `network`, sin backend → `not_configured`. **Sin hallazgo.**

Riesgo residual declarado: las imágenes del Markdown cargan de hosts arbitrarios (superficie de tracking-pixel), mitigado porque el contenido es autoría del repo revisada por PR, no input de usuario. El cuerpo servido por la API **no** queda cubierto por el escaneo estático de copy prohibida (solo las etiquetas estáticas lo están).

## Verificación

**WU1 — Migración `blog_post`** (2026-10-14):

- `pnpm exec supabase test db --local supabase/tests/blog_post.sql` → **RED** antes de la migración: la tabla no existía (el script corta al castear `'public.blog_post'::regclass`).
- `pnpm exec supabase migration up --local` → aplica `20261014120000_create_blog_post.sql`; `pnpm exec supabase test db --local supabase/tests/blog_post.sql` → **PASS** (39 tests, 0 fallos).
- **Remoto** (`ppvlnwejajxpsmazvnbj`): migración aplicada y verificada por SQL — tabla presente, 6 columnas, RLS on, 0 policies, `anon`/`authenticated` sin `SELECT`, `service_role` con `SELECT`/`INSERT`, 2 índices (pkey + `blog_post_published_at_idx`).
- **Drift corregido:** el primer apply vía MCP grabó su propia versión (`20261014112232`) y el nombre completo como `name`; se reparó el historial en `supabase_migrations.schema_migrations` a `20261014120000` / `create_blog_post` para que la versión y el nombre coincidan con el archivo del repo.

**WU2 — API** (2026-10-14):

- `pnpm --filter @vaqcrow/contracts test` → **PASS** (27 archivos / 722 tests); `pnpm --filter @vaqcrow/api test` → **PASS** (148 archivos / 3005 tests), re-corrido por el padre.
- `pnpm run typecheck` → 8/8; `pnpm run boundaries` → sin violaciones (1274 módulos).
- `pnpm --filter @vaqcrow/api openapi:generate` → `openapi.json` con 55 paths; diff aditivo (165 inserciones, 0 borrados).
- Prerequisito: `pnpm --filter @vaqcrow/contracts build` (la API resuelve `@vaqcrow/contracts` desde su `dist/`).
- Guardas de drift actualizadas (autorizadas por el owner): `authorization.test.ts` (filas del Blog en la MATRIX + wiring) y `openapi.json` regenerado; tag `Blog` declarado en `TAG_LIST`.

**WU3 — Web** (2026-10-14):

- `pnpm --filter @vaqcrow/web test` → **PASS** (233 archivos / 2264 tests), re-corrido por el padre.
- `pnpm --filter @vaqcrow/web build` → **PASS** (`/blog` estática, `/blog/[slug]` dinámica).
- `pnpm run typecheck` → 8/8; `pnpm run lint` → 5/5 (0 errores; 2 warnings preexistentes ajenos); `pnpm run boundaries` → sin violaciones (1307 módulos).
- RED→GREEN de los 11 archivos de test nuevos/actualizados (76 tests) contra módulos ausentes.

**WU4 + WU5 — Artículo, seed y evidencia** (2026-10-14):

- `pnpm exec supabase test db --local supabase/tests/blog_post_seed.sql` → **PASS** (7 tests); `supabase/tests/blog_post.sql` → **PASS** (39 tests; su fixture pasó a un slug propio para no chocar con la fila seed).
- `pnpm run verify` → **verde** (lint + typecheck + tests + build + boundaries + test:boundaries), re-corrido por el padre tras limpiar un `apps/web/.next/` viejo que rompía `typecheck`.
- **Remoto** (`ppvlnwejajxpsmazvnbj`): seed aplicado y verificado (`select` devuelve la fila `vaqcrow-sobre-stellar`), con el historial alineado a `20261014180000` / `seed_blog_post_article`.
- El cuerpo del artículo pasa la lista negra de copia pública (se sumó a `PUBLIC_TEXT`).

## Log

- **L1 (2026-10-14, pedido original del owner, verbatim):** «Retomamos Vaqcrow. Leé Engram (topic handoff/next-session-497-516 y el resumen de la sesión 2026-10-13/14). Estado: main ya tiene adentro las mejoras posteriores a v1.1.0 —#502 (skill OWASP), #497 («La traza»), #500 + #510 (header), #501 (desbordes + CTA), #512 (etiqueta) y #514 (estado activo del nav con fragmento)—. Lo único abierto es el PR #516 (sincronización de docs/planning/demo-tasks-list.md con el tablero), listo para mergear. El workspace quedó limpio: solo main más la rama del PR #516. Primero: 1) verificá si #516 se mergeó, sincronizá main y borrá la rama si corresponde; 2) lo único trabado son #498 (Blog) y #499 (asistente RAG): necesitan que el owner responda sus preguntas abiertas —recordáselas, y en particular la que comparten: si docs/guides/storybook.md (guía para desarrolladores) se publica en el Blog y entra en la wiki del asistente, o si los artículos públicos viven en una subcarpeta propia; 3) proponé por dónde arrancar. No implementes nada sin que el owner elija. Contexto ya registrado: la sección «Cómo funciona» es la excepción acordada al template y su texto vive en docs/guides/como-funciona-vaqcrow.md, leído en build; el header es ancho completo y el nav está centrado. Regla de la casa: creá siempre la rama desde main explícito — el owner mergea rápido y dos veces un push a una rama en review quedó fuera del merge.»
- **L2 (2026-10-14).** PR #516 verificado: **mergeado** (`f0da69a`); `main` sincronizado por fast-forward; rama `docs/roadmap-sync-2026-10-14` borrada (local y remota). Workspace limpio: solo `main`.
- **L3 (2026-10-14).** El owner eligió **arrancar por #498** (Blog) y respondió sus 6 preguntas abiertas (D1–D6). Estrategia de entrega: **encadenada a main, 3 PRs**.
- **L4 (2026-10-14).** **WU1 entregada** (commit WU1): migración `supabase/migrations/20261014120000_create_blog_post.sql` + test pgTAP `supabase/tests/blog_post.sql` (39 tests). Local RED→GREEN; remoto aplicado y verificado; historial remoto alineado al repo (ver Verificación). El apply vía MCP genera su propia versión, así que todo `apply_migration` de esta Feature se repara después a la versión del archivo (procedimiento a repetir en las migraciones siguientes, si las hay).
- **L5 (2026-10-14).** **WU2 entregada** (commit WU2): contratos `blog.ts`; ports `blog-post-repository-port` y `blog-content-source-port`; parser puro de front matter; use cases `list-blog-posts` y `get-blog-post`; adaptadores `SupabaseBlogPostRepository` y `FileSystemBlogContentSource` (con `resolveGuidesRoot`); rutas públicas `GET /blog` y `GET /blog/:slug`; wiring en `build-app.ts`/`index.ts`; `Dockerfile` (`COPY docs/guides/blog`); `railway.json` (watch pattern `/docs/guides/blog/**`) y `docs/guides/blog/.gitkeep`. WU2 se implementó **delegando a un writer** (backstop de contexto, sesión larga); el owner autorizó ampliar las superficies para cerrar las guardas de drift (`authorization.test.ts`, `openapi.json`, `TAG_LIST`). Verificación y evaluación de seguridad arriba.
- **L6 (2026-10-14).** **El deploy de la API en Railway (PR #517) falló:** `.dockerignore` excluía `docs/` entero, así que el `COPY docs/guides/blog` de WU2 no encontraba la ruta en el contexto de build (`CopyIgnoredFile`). Arreglado re-incluyendo solo el subárbol del blog en `.dockerignore` (`docs/*` + `!docs/guides` + `docs/guides/*` + `!docs/guides/blog`), dejando el resto de `docs/` fuera del contexto. Reproducido **RED→GREEN** con un sondeo de contexto (`COPY docs/guides/blog` en un Dockerfile mínimo, construido con la raíz del repo como contexto): antes `not found`, después copia OK.
- **L7 (2026-10-14).** **WU3 entregada** (rama `…-02-web-blog`, PR2): web público del Blog — `BlogPort` + `HttpBlogGateway` + `createBlogPort`/`createBrowserBlogPort` (null-object cuando falta `NEXT_PUBLIC_API_BASE_URL`), hooks SWR `useBlogPosts`/`useBlogPost`, renderer `MarkdownBody` (`react-markdown` + `remark-gfm`, **sin** `rehype-raw`), páginas `/blog` y `/blog/[slug]` con el layout de guía, y la sección «Blog» en «Acerca de». Dependencias agregadas por el gate cumplido (soporte usado: **Context7, `/remarkjs/react-markdown`**): `react-markdown@10.1.0`, `remark-gfm@4.0.1`. Implementada delegando a un writer (backstop de contexto). Decisión del owner: los **tags** del front matter se muestran como chips (D6 sigue: fecha sí, firma no; tags ≠ byline). Verificación y evaluación de seguridad arriba.
- **L8 (2026-10-14).** **WU4 + WU5 entregadas** (rama `…-03-article-and-evidence`, PR3): artículo `docs/guides/blog/vaqcrow-sobre-stellar.md` (español, Stellar, reglas de honestidad), seed `supabase/migrations/20261014180000_seed_blog_post_article.sql` (+ pgTAP `supabase/tests/blog_post_seed.sql`), escaneo de copia del artículo, evidencia `docs/planning/markdown-blog-in-about-evidence.md` y sync de `docs/planning/demo-tasks-list.md`. Delegado a un writer (backstop de contexto); el writer quedó bloqueado por dos cosas mecánicas que resolvió el padre: (1) el fixture de `supabase/tests/blog_post.sql` chocaba con la fila seed → se le dio un slug de fixture propio; (2) un `apps/web/.next/` viejo rompía `typecheck` → se limpió. Seed aplicado al remoto y verificado; `pnpm run verify` verde. **Nota de merge:** PR2 (#520) y PR3 editan ambos `apps/web/src/application/about/public-copy-prohibited-terms.test.ts` y esta misma bitácora; el que quede segundo necesita rebase sobre `main`.
