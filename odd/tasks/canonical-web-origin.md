# Task #565 — `www.vaqcrow.com` como origen canónico de la web

Objetivo: que `https://www.vaqcrow.com` sea el único origen de la web de punta a punta (CORS, Supabase Auth, links de email y docs), y que los otros dominios redirijan ahí. Rama `Vaqcrow#565_Task_Make_www_vaqcrow_com_the_canonical_web_origin_across_CORS_Supabase_Auth_URLs_and_the_docs`. Un PR. Sin runner de código: son cambios de configuración y de docs, verificados con `curl` y en el navegador.

## Specs

- **S1** — Decisión del owner (2026-10-16), verbatim: «sí, encaralo con el redirect». `vaqcrow-web-nine.vercel.app` redirige a `www.vaqcrow.com` a nivel de dominio de Vercel (308), igual que `vaqcrow.com`.
- **S2** — Supabase Auth: la Site URL y las Redirect URLs nombran `https://www.vaqcrow.com`; el link de confirmación abre `/account-confirmed` en ese origen.
- **S3** — `CORS_ALLOWED_ORIGINS` (Railway) acepta `https://www.vaqcrow.com`. `APP_BASE_URL` (Railway) es `https://www.vaqcrow.com`. Este último punto se agregó como supuesto: el issue no lo nombra, pero los links del email de notificaciones salen de ahí.
- **S4** — Los docs de `docs/architecture/` y `docs/presentation/` no nombran `vaqcrow-web-nine` como origen actual.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|---|---|---|---|---|
| T1 | S4 | inline | hecho | docs alineados en esta rama |
| T2 | S1, S2, S3 | owner (dashboards) | pendiente | Vercel, Supabase y Railway no se pueden editar desde esta sesión |
| T3 | S1–S3 | inline | pendiente | verificación con `curl` y en el navegador después de T2 |

## Log

- **L1** (2026-10-16) — Issue #565. Decisión del owner: «sí, encaralo con el redirect».
- **L2** (2026-10-16) — Estado leído antes de cambiar nada. Vercel (`vaqcrow-web`, MCP `list_project_domains`): `vaqcrow.com` tiene `redirect: www.vaqcrow.com` (308), `www.vaqcrow.com` no redirige y `vaqcrow-web-nine.vercel.app` tampoco (`redirect: null`). El MCP de Vercel no tiene una herramienta para editar un dominio que ya existe, y el CLI de Vercel no está instalado, así que el redirect lo configura el owner en el dashboard. API: `CORS_ALLOWED_ORIGINS` acepta solo `https://www.vaqcrow.com`. Desde esta sesión no se pueden leer la Site URL ni las Redirect URLs de Supabase Auth, ni `APP_BASE_URL` en Railway.
- **L3** (2026-10-16) — T1: `vaqcrow-web-nine` pasa a `www.vaqcrow.com` en `cloud-demo-architecture.md` (diagrama y paso 1), `environments.md` (URLs de Auth, §8 CORS y `APP_BASE_URL`), `deploy-planning.md` (tabla de URLs) y `video-script.md`. `b2.json` es un export histórico del tablero y no se toca, igual que la evidencia y `odd/tasks`. Seguridad (OWASP Top 10:2025, A05/A07): un solo origen mantiene la lista de CORS exacta y las Redirect URLs de Auth acotadas; no se agrega ningún comodín. **Sin hallazgos.**
