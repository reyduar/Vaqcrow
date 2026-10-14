# Evidencia de cierre de la Feature #498 — Blog en Markdown dentro de «Acerca de»

> Documento de cierre de Feature. Consolida la evidencia de la Feature [#498](https://github.com/reyduar/Vaqcrow/issues/498) ("Feature: Publish a Markdown Blog in About backed by docs/guides"), re-ejecuta las verificaciones locales que esta unidad puede correr en su árbol de trabajo y mapea cada criterio de aceptación de la Feature, citado textualmente, a su resultado y a la fuente de ese resultado. La bitácora de iteración que lo alimenta es [[odd/tasks/publish-a-markdown-blog|Bitácora: Blog en Markdown dentro de «Acerca de»]].

> [!warning] Estado de entrega: la base está en `main`; la web y el artículo no
> La Feature se entrega **encadenada a `main` en tres PRs** (decisión del owner, 2026-10-14). Está en `main` la **PR1** —migración `blog_post` + API— vía [#517](https://github.com/reyduar/Vaqcrow/pull/517), más sus dos correcciones de build ([#518](https://github.com/reyduar/Vaqcrow/pull/518) y [#519](https://github.com/reyduar/Vaqcrow/pull/519)). La **PR2 — la web (páginas, renderer y sección «Blog» en `/about`)** vive en la rama `Vaqcrow#498_Feat_…-02-web-blog` y **todavía no está mergeada**; la **PR3 — este artículo y esta evidencia** vive en la rama `…-03-article-and-evidence`. Por eso, en `main` **hoy no existen** `/blog` ni `/blog/[slug]` ni la sección «Blog» de `/about`: recién aparecen cuando la PR2 entrega. Este documento no reporta un estado mergeado que no existe.

> [!info] La web del Blog sólo se ve en producción, no en los previews de Vercel
> `NEXT_PUBLIC_API_BASE_URL` es de producción: un deployment de preview no la tiene. Además, la API sólo acepta los orígenes de `CORS_ALLOWED_ORIGINS` —una lista exacta que, fuera de `local`, no tiene default (`cors-config.ts`)—, así que el navegador de un preview no puede llamar a la API. Sin backend, el puerto del Blog cae al objeto nulo y `/about` muestra el `BackendNotice` en lugar de la lista. Es un límite conocido y aceptado del entorno, no un defecto de la Feature.

## 1. Contexto y objetivo

La Feature #498 agrega un **Blog público** alcanzable desde «Acerca de»: cada artículo es un `.md` bajo `docs/guides/blog/`, renderizado como página pública en un slug estable, con una tabla `public.blog_post` que mapea cada slug a su archivo fuente. Los mismos archivos serán, más adelante, el corpus del asistente RAG ([#499](https://github.com/reyduar/Vaqcrow/issues/499)). El primer artículo presenta a Vaqcrow como lo hace la nota de El Economista sobre EthicHub —una plataforma de *crowdlending* sobre Ethereum—, pero sobre **Stellar** (bóveda Soroban, Freighter, Testnet).

Las seis preguntas abiertas del issue se resolvieron el 2026-10-14 (decisiones **D1–D6** de la bitácora), antes de implementar; ninguna se inventó.

| Unidad | Alcance | PR / rama | Estado |
|---|---|---|---|
| WU1 | Migración `blog_post` (tabla + RLS + grants) y su pgTAP | [#517](https://github.com/reyduar/Vaqcrow/pull/517) | en `main` |
| WU2 | API (contrato, puertos, adaptadores, rutas) | [#517](https://github.com/reyduar/Vaqcrow/pull/517) | en `main` |
| — | Correcciones de build de la API (`docs/` en el contexto y watch) | [#518](https://github.com/reyduar/Vaqcrow/pull/518), [#519](https://github.com/reyduar/Vaqcrow/pull/519) | en `main` |
| WU3 | Web (lista, artículo, renderer, sección en `/about`) | PR2 — `…-02-web-blog` | abierta, no mergeada |
| WU4 | Primer artículo + seed de `blog_post` + pgTAP del seed | PR3 — `…-03-article-and-evidence` | esta unidad |
| WU5 | Este documento + sync de `demo-tasks-list.md` | PR3 — `…-03-article-and-evidence` | esta unidad |

## 2. Cómo leer esta evidencia

- **Dos fuentes, siempre nombradas.** (a) **Re-ejecutado** — un comando corrido el 2026-10-14 en este árbol de trabajo (rama de la PR3), con su salida real (§4.1). (b) **Bitácora** — una entrada fechada de [[odd/tasks/publish-a-markdown-blog]]; se cita, **no** se re-ejecutó aquí. La web de la PR2 se cita desde su rama, no desde `main`.
- **Sin secretos.** Ninguna clave, token, contraseña ni identificador de proyecto aparece en este documento; las variables se nombran, nunca sus valores.
- **Sin claims de producción.** El Blog es contenido de la demo sobre **Stellar Testnet**; los activos que se mueven no tienen valor económico. Nada aquí afirma disponibilidad, SLA ni valor económico.

## 3. Qué quedó implementado

Fuente: bitácora (L4–L6) y lectura del código en `main` (WU1/WU2) y en la rama `…-02-web-blog` (WU3).

- **Migración (WU1)** — `supabase/migrations/20261014120000_create_blog_post.sql`: tabla `public.blog_post` con `slug` como clave primaria (`check ^[a-z0-9]+(?:-[a-z0-9]+)*$`), `source_path` (relativo a `docs/guides/`, no vacío), `title`, `summary`, `published_at` (nullable) y `created_at`; índice parcial `blog_post_published_at_idx` sobre las publicadas; **RLS on con cero políticas** y grants explícitos en la misma migración (`anon`/`authenticated` sin acceso, `service_role` con `all`). El cuerpo del artículo vive en el repositorio, nunca en la base (D3).
- **API (WU2)** — contrato en `packages/contracts/src/blog.ts` (`blogSlugSchema`, `blogPostSummarySchema`, `blogPostListSchema`, `blogPostSchema`); puertos `application/ports/blog-post-repository-port.ts` y `blog-content-source-port.ts`; parser puro de front matter (`application/blog/front-matter.ts`); casos de uso `list-blog-posts` y `get-blog-post`; adaptadores `SupabaseBlogPostRepository` y `FileSystemBlogContentSource` (con `resolveGuidesRoot` y guarda anti path-traversal); rutas públicas `GET /blog` y `GET /blog/:slug` (`infrastructure/http/routes/blog.route.ts`), ambas `PUBLIC` en `route-policy.ts`; `Dockerfile` copia `docs/guides/blog/` y `.dockerignore` re-incluye ese subárbol.
- **Web (WU3, PR2)** — `/blog` (`app/blog/page.tsx`) y `/blog/[slug]` (`app/blog/[slug]/page.tsx`) fuera del grupo `(app)`: sin `RouteGate` ni sesión; renderer `presentation/components/blog/markdown-body.tsx` (`react-markdown` + `remark-gfm`, **sin `rehype-raw`**); copia estática en `application/blog/copy.ts`; puerto `application/blog/blog-port.ts` con gateway HTTP y null-object; hook SWR `state/use-blog.ts`; y la sección «Blog» de `/about` (`presentation/components/blog/about-blog-section.tsx`, montada por `about-content.tsx` — D4, enlace sólo dentro de «Acerca de»).
- **Primer artículo (WU4)** — `docs/guides/blog/vaqcrow-sobre-stellar.md` en español, con front matter (`title`, `tags`, con la forma de `docs/guides/storybook.md`); ejercita el renderer con encabezados, listas, una tabla, un bloque de código y una cita. Sus claims siguen las reglas de honestidad de la demo (Testnet sin valor económico, KYC/KYB y conversión ARS/activo simulados, IA que sólo asesora, Vaqcrow no custodial). El título («Vaqcrow: financiar a las PyMEs argentinas con una bóveda en Stellar») lo propuso el agente y **el owner puede ajustar la redacción**.
- **Seed (WU4)** — `supabase/migrations/20261014180000_seed_blog_post_article.sql`: registra la fila del artículo (`slug` `vaqcrow-sobre-stellar`, `source_path` `blog/vaqcrow-sobre-stellar.md`, `title`, `summary`, `published_at`), idempotente (`on conflict (slug) do update`), con el mismo estilo de comentario de cabecera y reversa que la migración de WU1.
- **Escaneo de copia pública (WU4)** — `apps/web/src/application/about/public-copy-prohibited-terms.test.ts` ahora lee el cuerpo del artículo (front matter recortado) y lo suma a `PUBLIC_TEXT`, así que pasa por la misma lista negra (`garantiz*`, `rentabilidad`, `retorno`, `asegur*`, `auditad*`, `producción`, `listo para`, `legalidad`, `solvencia`, `proveedor(es) de calidad`, `promete|promesa|ganancia`) que el texto de `docs/guides/como-funciona-vaqcrow.md`.

## 4. Qué quedó probado

### 4.1 Re-ejecutado en este árbol de trabajo (2026-10-14)

Rama de la PR3 (`…-03-article-and-evidence`), stack local de Supabase en marcha.

```sh
$ pnpm exec supabase migration up --local
Applying migration 20261014180000_seed_blog_post_article.sql...
Local database is up to date.

$ pnpm exec supabase test db --local supabase/tests/blog_post_seed.sql
...blog_post_seed.sql .. ok
All tests successful.  Files=1, Tests=7, 0 failed.
# RED antes del seed: 6 de 7 subtests fallidos (la fila no existía).

$ pnpm --filter @vaqcrow/web exec vitest run src/application/about/public-copy-prohibited-terms.test.ts
 Test Files  1 passed (1)
      Tests  19 passed (19)

$ pnpm --filter @vaqcrow/web test
 Test Files  224 passed (224)
      Tests  2213 passed (2213)

$ pnpm run lint
 Tasks:    5 successful, 5 total        # 2 warnings preexistentes en admin-users.test.tsx, ajenos

$ pnpm run boundaries
✔ no dependency violations found (1274 modules, 4223 dependencies cruised)
```

Dos comandos **no quedaron verdes** en este árbol; ambos están registrados como límites (§5):

```sh
$ pnpm run typecheck
@vaqcrow/web:typecheck: .next/types/validator.ts(150,39): error TS2307:
  Cannot find module '../../src/app/blog/[slug]/page.js' or its corresponding type declarations.
@vaqcrow/web:typecheck: .next/types/validator.ts(159,39): error TS2307:
  Cannot find module '../../src/app/blog/page.js' ...
 Tasks:    7 successful, 8 total   Failed: @vaqcrow/web#typecheck

$ pnpm exec supabase test db --local supabase/tests/blog_post.sql
blog_post.sql (Wstat: 768) Tests: 36 Failed: 0
  Parse errors: Bad plan.  You planned 39 tests but ran 36.
Result: FAIL
```

Ninguno de los dos es un defecto de este cambio: `typecheck` falla por un `apps/web/.next/` **viejo** (artefacto de build de la PR2 en este mismo directorio de trabajo, que el `tsconfig` incluye vía `.next/types/**/*.ts`) y `blog_post.sql` aborta porque su fixture inserta **a mano** el mismo slug que ahora siembra la migración (§5).

### 4.2 Qué cubre cada suite

| Comportamiento | Prueba | Fuente del resultado |
|---|---|---|
| El seed registra la fila una vez, publicada, apuntando a `blog/vaqcrow-sobre-stellar.md`, con el `source_path` de forma de slug, y un re-upsert no la duplica | `supabase/tests/blog_post_seed.sql` | Re-ejecutado; RED→GREEN (§4.1) |
| La copia pública del artículo pasa la lista negra y trae las features del renderer (encabezado, tabla, bloque de código, cita) | `apps/web/src/application/about/public-copy-prohibited-terms.test.ts` | Re-ejecutado (§4.1) |
| Migración `blog_post`: columnas, claves, índice, RLS on/0 políticas, grants, `23505` en replay | `supabase/tests/blog_post.sql` | Bitácora WU1 (PASS, 39 tests); **hoy aborta por la colisión del fixture con el seed** (§5) |
| API: lista pública, detalle con front matter recortado, `404` en slug inválido/desconocido, guarda anti traversal, `503` ante fallo | `apps/api/src/infrastructure/http/routes/blog.route.test.ts`, `…/filesystem-blog-content-source.test.ts`, `…/supabase-blog-post-repository.test.ts`, `application/blog/front-matter.test.ts` | Bitácora WU2 (suite API verde); **no re-ejecutado aquí** |
| Web: renderer sin ejecutar HTML crudo, lista, artículo, sección «Blog» de `/about` | `apps/web/src/presentation/components/blog/*.test.tsx`, `app/blog/**/page.test.tsx` | Bitácora WU3 (rama de la PR2); **no re-ejecutado aquí** |

### 4.3 Verificaciones fuera del gate de PR (tomadas de la bitácora, no re-ejecutadas)

- **Remoto (WU1):** migración `20261014120000` aplicada y verificada por SQL (tabla, 6 columnas, RLS on, 0 policies, `anon`/`authenticated` sin `SELECT`, `service_role` con `SELECT`/`INSERT`, 2 índices); historial de migraciones alineado al repo.
- **Seed remoto:** la migración `20261014180000` **todavía no se aplicó al proyecto remoto** — la aplica el padre en esta misma unidad (§5).

## 5. Límites y brechas vigentes

1. **La web del Blog no está en `main`.** `/blog`, `/blog/[slug]` y la sección «Blog» de `/about` viven en la PR2 (`…-02-web-blog`), todavía abierta. En `main` esas rutas no existen.
2. **La web del Blog sólo se ve en producción, no en los previews de Vercel.** `NEXT_PUBLIC_API_BASE_URL` es de producción y la API sólo acepta los orígenes exactos de `CORS_ALLOWED_ORIGINS` (sin default fuera de `local`), así que un preview no puede llamar a la API y cae al `BackendNotice`.
3. **`supabase/tests/blog_post.sql` (WU1) aborta con el seed aplicado.** Su fixture hace un `insert` **sin** manejo de conflicto del mismo slug (`vaqcrow-sobre-stellar`) que ahora siembra la migración; con la fila ya presente, la PK da `23505` y el script corta antes de 3 aserciones (36/39, 0 fallidas). Es un archivo **fuera de las superficies de esta unidad**: la corrección (hacer el fixture tolerante al conflicto) queda pendiente de autorización del owner/padre.
4. **`pnpm run typecheck` falla por un `.next` viejo.** El directorio `apps/web/.next/` (artefacto de build **ignorado por git**) quedó de una compilación de la PR2 en este mismo directorio de trabajo y su `types/validator.ts` referencia `src/app/blog/*`, que no existe en esta rama; el `tsconfig` incluye `.next/types/**/*.ts`. Se corrige regenerando o limpiando `apps/web/.next` (fuera de las superficies de esta unidad).
5. **No se corrió `pnpm run verify`.** Por indicación del padre, la verificación se limita a los comandos de §4.1; el cierre con `pnpm run verify` (y las dos correcciones de §5.3 y §5.4) queda para el padre.
6. **El seed no está aplicado al remoto.** La migración `20261014180000` sólo corrió contra el stack local; el apply remoto es del padre.

## 6. Evaluación de seguridad (`owasp-security`)

Contra OWASP Top 10:2025, sobre el alcance de esta unidad (el artículo público, su seed y su escaneo), sumando lo ya evaluado en WU2/WU3:

- **A01 — Broken Access Control.** El artículo y el seed **no agregan** superficie de acceso: `blog_post` sigue con RLS on, **cero políticas** y `anon`/`authenticated` sin grant (§3, WU1); las dos rutas del Blog son públicas por diseño y su contenido es público y sin PII. La guarda anti path-traversal del adapter (WU2) no cambia. **Sin hallazgos.**
- **A03 — Injection.** La copia del artículo es Markdown autorado en el repositorio y renderizado por `react-markdown` **sin `rehype-raw`**: el HTML crudo queda como texto inerte. El seed es un `INSERT` de valores literales (sin concatenación de SQL); la API usa `supabase-js`, parametrizado. **Sin hallazgos.**
- **A05 — Security Misconfiguration.** Sin grants por default (`anon`/`authenticated` denegados explícitamente), sin `rehype-raw`, y CORS por lista exacta de orígenes. **Sin hallazgos.**
- **A06 — Vulnerable & Outdated Components.** `react-markdown` y `remark-gfm` entraron por el gate de dependencias (WU3, PR2); no se agregó `rehype-raw` ni otro sanitizador innecesario. Esta unidad (WU4/WU5) no agrega dependencias. **Sin hallazgos.**
- **A10 — Mishandling of Exceptional Conditions.** La API **falla cerrado**: slug inválido o desconocido → `404`; fallo de repositorio o Markdown ilegible → `503` saneado, nunca un `200` con artículo vacío. La web cubre carga, vacío, error y ausencia de backend con estados explícitos. **Sin hallazgos.**
- **LLM Top 10 (2026).** No aplica: esta unidad no toca prompts ni proveedores LLM.

**No hay hallazgos de seguridad abiertos por esta unidad.**

## 7. Mapeo de criterios de aceptación

Criterios citados textualmente del cuerpo del issue [#498](https://github.com/reyduar/Vaqcrow/issues/498) (§ "Acceptance criteria").

| # | Criterio (verbatim, issue #498) | Resultado | Fuente |
|---|---|---|---|
| 1 | "`/blog` lists published articles and `/blog/[slug]` renders the Markdown with headings, lists, links, code and tables." | ⚠️ **Implementado en la PR2 (no en `main`).** Las rutas, el renderer y sus tests viven en la rama `…-02-web-blog`; el artículo de WU4 ejercita encabezados, listas, tabla, bloque de código y cita. | Bitácora WU3; lectura de la rama de la PR2 |
| 2 | "An unknown slug returns 404; a `source_path` outside `docs/guides/` is rejected." | ✅ **Implementado (en `main`).** `GET /blog/:slug` responde `404` a slug malformado o desconocido; el adapter rechaza paths absolutos, con `\`, con `..` o fuera de la raíz **antes** de tocar el filesystem. | Bitácora WU2; lectura de `blog.route.ts` y `filesystem-blog-content-source.ts` |
| 3 | "«Acerca de» shows the Blog section linking to the articles." | ⚠️ **Implementado en la PR2 (no en `main`).** `AboutBlogContainer` se monta en `about-content.tsx` (D4: sólo dentro de «Acerca de»). | Bitácora WU3; lectura de la rama de la PR2 |
| 4 | "The `blog_post` migration has RLS and explicit grants, passes `pnpm run test:db` locally and is applied and verified on the remote project." | ⚠️ **Parcial.** La migración tiene RLS on, cero políticas y grants explícitos, y se aplicó/verificó en el remoto (WU1). El seed de WU4 corrió en local, pero **`blog_post.sql` hoy aborta** por la colisión del fixture con el seed (§5.3) y **el seed no está aplicado al remoto** (§5.6). | WU1 (bitácora, remoto); re-ejecutado localmente (§4.1) |
| 5 | "The first Vaqcrow article (Stellar-based, inspired by the EthicHub article) is published and its claims respect the demo honesty rules." | ✅ **Cumplido.** El artículo existe con front matter, está sembrado en `blog_post` (publicado) y pasa la lista negra de copia pública; sus claims respetan Testnet sin valor económico, KYC y ARS simulados, IA asesora y no custodia. | Re-ejecutado (§4.1); lectura del artículo |
| 6 | "Raw HTML/script inside Markdown is not executed." | ⚠️ **Implementado en la PR2 (no en `main`).** `markdown-body.tsx` usa `react-markdown` sin `rehype-raw`; el HTML crudo del Markdown nunca se convierte en DOM. El artículo no incluye HTML crudo. | Bitácora WU3; lectura de la rama de la PR2 |
| 7 | "`pnpm run verify` passes; evidence document `docs/planning/<feature-slug>-evidence.md` written." | ⚠️ **Parcial.** Este documento es la evidencia. `pnpm run verify` **no se corrió** (indicación del padre); `pnpm run typecheck` hoy falla por un `.next` viejo (§5.4). | §4.1; §5 |

## 8. Estado de entrega y próximos pasos

- Este cambio (PR3) es el artículo, su migración de seed, su pgTAP y la extensión del escaneo de copia pública, más este documento y el sync de `docs/planning/demo-tasks-list.md`. Commit en la rama `…-03-article-and-evidence`; **no hay merge**.
- Nada de la PR2 ni de esta PR3 está en `main`. El orden de merge lo decide el owner.

> [!todo] Condiciones antes del merge de la Feature #498
> 1. Mergear la PR2 (web) y esta PR3, en el orden que el owner elija.
> 2. Autorizar y aplicar la corrección de `supabase/tests/blog_post.sql` (fixture tolerante al conflicto con el seed — §5.3).
> 3. Regenerar/limpiar `apps/web/.next` y correr `pnpm run verify` de punta a punta (§5.4).
> 4. Aplicar al proyecto remoto la migración `20261014180000_seed_blog_post_article.sql` y verificar su historial (§5.6).
> 5. Confirmar (o ajustar) la redacción del título del primer artículo (§3, WU4).
