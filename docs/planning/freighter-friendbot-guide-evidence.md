---
title: Freighter and Friendbot guide
tags:
  - planning
  - evidence
  - blog
  - wiki
  - navigation
date: 2026-10-15
status: delivered
---

# Feature #558 — Guía de Freighter y Friendbot (blog y wiki) y «Blog» en el navbar

> [!info] Objetivo
> Publicar una guía paso a paso para instalar Freighter en Chrome, crear una cuenta, pasarla a Testnet y fondearla con Friendbot, como post del blog y como página de la wiki del asistente, y sumar «Blog» al navbar de todos los roles, siempre antes de «Acerca de». Hallazgo del segundo test manual de punta a punta (Epic #555). Bitácora: [[odd/tasks/freighter-friendbot-guide|freighter-friendbot-guide]].

## Pedido del owner (verbatim)

> Quiero que me crees un articulo en el blog y tambien para la wiki(para el asistente de chatbot) para para guiar al usuario como tiene que agregar una wallet en Chrome y como crear una cuenta, ademas como usar el saldo de Friendbot, ademas quiero que agregues como un nuevo enlace en el navbar de todos los roles uno nuevo llamada Blog y que este siempre antes de Acerca de.

## Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | El post se publica con una migración de seed (`20261015200000`), además del `.md` | La API lista los posts desde `public.blog_post` y lee el cuerpo del Markdown que viene en su imagen. Es el mismo patrón que `20261014180000` (#498) |
| D2 | El seed llega al remoto **recién cuando la API está desplegada con el `.md` nuevo** | Si llega antes, `/blog` en producción lista un post que todavía no se puede abrir |
| D3 | Una constante `BLOG` antes de `ABOUT` en PUBLIC, INVERSOR y PYME; ADMIN reutiliza la nav pública | El pedido dice «todos los roles». El template no dibuja la entrada: es una decisión del owner (2026-10-15) |
| D4 | Lint del corpus de la wiki como test de la API (`wiki-corpus.test.ts`) | El router solo acepta ids que estén en el índice: una página sin indexar nunca puede respaldar una respuesta |
| D5 | Links del navbar con 4 px de padding por lado (antes 8) | Con seis entradas, el header de 1280 px no entraba en Linux con texto más ancho (−31 px). Lo eligió el owner entre tres opciones, sin tocar etiquetas |

## Cambios

- **Navbar** (`55de575`): `apps/web/src/application/navigation/shell-nav.ts` (constante `BLOG`), con sus tests en `shell-nav.test.ts` y `app-header.test.tsx`.
- **Blog** (`54a0d5e`): `docs/guides/blog/freighter-y-friendbot-paso-a-paso.md`; `supabase/migrations/20261015200000_seed_blog_post_freighter_article.sql`; `supabase/tests/blog_post_freighter_seed.sql`; el post se suma al escaneo de copy pública (`public-copy-prohibited-terms.test.ts`).
- **Wiki** (`40b6f12`): `docs/wiki/freighter-y-friendbot.md` (`type: flujo`), su línea en `index.md`, la entrada `ingest` en `log.md` y `apps/api/src/infrastructure/adapters/wiki-corpus.test.ts`.

## Criterios de aceptación (verbatim del issue #558) → verificación

- **«The new post is listed on `/blog` and renders at its `/blog/[slug]`.»** → La fila sembrada cumple el contrato que la API lista y sirve: el test pgTAP `blog_post_freighter_seed.sql` (6/6) prueba que la fila es única, está publicada, apunta a `blog/freighter-y-friendbot-paso-a-paso.md` y lleva título y resumen. El cuerpo pasa por el renderer del blog: tablas, bloques de código y enlaces externos con `noopener`, que ya ejercita el post de #498. ⚠️ **Falta verlo en la web desplegada**, que depende de D2.
- **«The wiki page exists, is indexed, and the assistant can ground an answer about Freighter + Friendbot on it.»** → `wiki-corpus.test.ts`: la página está en el índice, se parsea con `parseWikiPage`, declara `type: flujo` y sus `sources` existen en `docs/guides/`. ⚠️ **Falta comprobar en la web desplegada** que el asistente responda con una cita a esta página.
- **«Every role's navbar shows «Blog» immediately before «Acerca de».»** → `shell-nav.test.ts` «every view shows «Blog» immediately before «Acerca de» (#558)» para PUBLIC, INVERSOR, PYME y ADMIN, y `app-header.test.tsx`, que renderiza la nav exacta de cada rol.
- **«`pnpm run verify` passes.»** → `pnpm run verify` (corrido en el árbol de trabajo, 2026-10-15) → **exit 0**: web 2500 tests, API 3198 tests, `✔ no dependency violations found (1402 modules, 4687 dependencies cruised)`. La primera corrida falló en dos tests web por timeout (`auth-screen.test.tsx` y `pyme-onboarding-wizard.test.tsx`, con 5,1 s y 8,6 s mientras corría el stack de Docker). Esos archivos no se tocan en esta rama: corridos solos dieron 57/57, y la segunda corrida completa dio exit 0.

## Verificación

- RED observado antes de cada cambio: 4 tests de `shell-nav.test.ts`; `ENOENT` en el escaneo de copy pública porque el post no existía; 5/6 en pgTAP porque no había fila; y «indexes the Freighter + Friendbot walkthrough (#558)» en el lint de la wiki.
- `pnpm run test:db` (stack local, después de `supabase migration up --local`): `blog_post_freighter_seed.sql` **ok**. En la misma corrida fallan tests que cuentan campañas y aportes («one row per contribution», «only the two published campaigns are listed»). Esos tests ya fallaban en la corrida RED, antes de aplicar la migración: chocan con los datos de demo que hay en la base local, que no se resetea entre ensayos (Opción A).
- Seguridad (OWASP Top 10:2025; el LLM Top 10 2026 no aplica porque no hay prompts nuevos y la página de wiki es corpus revisado por PR): **sin hallazgos**. A01: el seed no cambia grants ni RLS y solo inserta metadata. A03: sin dependencias nuevas. A05: el Markdown es contenido del repositorio, sin HTML crudo, y los enlaces externos abren con `rel="noreferrer noopener"`. El post y la página repiten la regla de no pedir nunca la seed.

## Límites y notas

- **Mergeado y desplegado (2026-10-16):** PR #563 → `b3e2229`, con el CI de `main` en verde (Playwright incluido). Railway terminó el deploy de `b3e2229` a las 02:52 UTC.
- **Migración remota aplicada (D2), después del deploy:** `20261015200000` se aplicó con el MCP de Supabase y la versión del historial se alineó de `20261016025309` a `20261015200000`. Hay una sola fila, publicada y con el `source_path` correcto. `GET /blog` de la API desplegada lista el post y `GET /blog/freighter-y-friendbot-paso-a-paso` responde 200. En `https://www.vaqcrow.com/blog` el post aparece y se abre con su título, los pasos, la tabla y los enlaces externos con `noopener`.
- **Hallazgo de entorno:** `CORS_ALLOWED_ORIGINS` acepta solo `https://www.vaqcrow.com`. En `vaqcrow-web-nine.vercel.app`, el origen que todavía nombran `docs/architecture/*.md`, el blog no carga.
- ⚠️ Falta comprobar en la web que el asistente cite `freighter-y-friendbot`. Se deja al owner, porque hace falta enviar una pregunta desde una sesión con cuenta.
- Advisory sin cambio: la copy de `/company` dice «Tu wallet necesita XLM de Testnet para crear la bóveda», pero la guía operativa dice que el despliegue lo firma y lo paga la plataforma. El post no repite ninguna de las dos afirmaciones.
- Con «Blog», la nav pública pasa de cinco a seis entradas. El ancho lo mide `e2e/app-header.spec.ts` a 1280 px, también con el texto ensanchado que replica el render de Linux: `pnpm --filter @vaqcrow/web run test:e2e` → 41/41 en local. La primera corrida del CI falló porque las specs e2e todavía esperaban cinco links. La segunda falló de verdad: con el texto ensanchado, al nav le faltaban 31 px en Linux. Por decisión del owner, el padding de los links bajó de 8 a 4 px por lado, sin cambiar ningún texto (`demo-navbar.tsx`). Medido en macOS: 102 px de margen con texto normal y 57 px con texto ensanchado.
