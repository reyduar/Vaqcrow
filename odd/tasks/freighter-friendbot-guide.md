# Feature #558 — Guía de Freighter + Friendbot (blog y wiki) y link «Blog» en el navbar

Objetivo: publicar una guía paso a paso (post del blog + página de la wiki del asistente) para instalar Freighter en Chrome, crear una cuenta y fondearla con Friendbot, y sumar «Blog» al navbar de todos los roles, siempre antes de «Acerca de». Rama `Vaqcrow#558_Feat_Publish_a_Freighter_and_Friendbot_guide_in_the_blog_and_the_wiki_and_add_Blog_to_the_navbar`. Entrega: un PR. Runner: vitest (web/API) + pgTAP (`pnpm run test:db`).

## Specs

- **S1** — Pedido del owner (2026-10-15), verbatim: «Quiero que me crees un articulo en el blog y tambien para la wiki(para el asistente de chatbot) para para guiar al usuario como tiene que agregar una wallet en Chrome y como crear una cuenta, ademas como usar el saldo de Friendbot». Post nuevo en `docs/guides/blog/` (español): agregar Freighter a Chrome, crear la cuenta, pasar a Testnet y fondear con Friendbot. Se lista en `/blog` y se abre en `/blog/[slug]`. Como el blog sirve los posts a partir de filas en `public.blog_post`, el post necesita una migración de seed idempotente con su test pgTAP: se prueba primero en local y después se aplica al remoto, como manda `CLAUDE.md`.
- **S2** — Página de wiki nueva en `docs/wiki/` que cubra los mismos pasos, siguiendo `schema.md` (front matter con `sources` que apunten a `docs/guides/`). Va listada en `index.md` y con su entrada en `log.md`, para que el asistente pueda responder a partir de ella.
- **S3** — Pedido del owner, verbatim: «ademas quiero que agregues como un nuevo enlace en el navbar de todos los roles uno nuevo llamada Blog y que este siempre antes de Acerca de.» Una constante `BLOG` (`/blog`) en `shell-nav.ts`, inmediatamente antes de `ABOUT` en las vistas PUBLIC, INVERSOR, PYME y ADMIN. El template no dibuja esta entrada: es una decisión del owner y queda registrada en #558.
- **S4** — Coherencia de los límites honestos: Testnet sin valor económico; Vaqcrow es no custodio y nunca pide la seed.
- **S5** — `pnpm run verify` pasa. Evidencia en `docs/planning/freighter-friendbot-guide-evidence.md`.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|---|---|---|---|---|
| T1 | S3 | inline | pendiente | — |
| T2 | S1, S4 | inline | pendiente | — |
| T3 | S2, S4 | inline | pendiente | — |
| T4 | S5 | inline | pendiente | — |

Ruta inline en todas: ningún disparador de writer (no hay unidades paralelas pesadas ni backstop de contexto).

## Log

- **L1** (2026-10-15) — Pedido original (hallazgo del segundo test manual), verbatim: «Quiero que me crees un articulo en el blog y tambien para la wiki(para el asistente de chatbot) para para guiar al usuario como tiene que agregar una wallet en Chrome y como crear una cuenta, ademas como usar el saldo de Friendbot, ademas quiero que agregues como un nuevo enlace en el navbar de todos los roles uno nuevo llamada Blog y que este siempre antes de Acerca de.»
- **L2** (2026-10-15) — Descubrimiento: el `.md` solo no alcanza para publicar el post. La API lista los posts desde `public.blog_post` (`list-blog-posts.ts`) y lee el cuerpo del Markdown que viene empaquetado en su imagen (`apps/api/Dockerfile`, `docs/guides/blog`). Por eso hace falta una migración de seed, como `20261014180000`. Hay un orden que cuidar: si el seed se aplica al remoto antes de que la API se vuelva a desplegar con el `.md` nuevo, `/blog` en producción lista un post que todavía no se puede abrir.
