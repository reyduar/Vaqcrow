# Bitácora — Script de reset de datos de la demo

## Objetivo

Dejar **versionado y guardado** el procedimiento para limpiar los datos de prueba de la demo, para poder arrancar un ensayo manual desde cero sin SQL suelto.

## Por qué

El owner necesitaba limpiar la base antes de un ensayo E2E manual. La limpieza se hizo una vez (decisión del owner, 2026-10-12: opción **B**, dejar sólo el superadmin) y pidió dejarla como script «por si lo volvemos a necesitar». Además, la decisión asentada de `AGENTS.md` («No database reset between rehearsals, Option A») necesitaba registrar que ahora existe una herramienta de reset explícita.

## Rama

- **Rama:** `Vaqcrow_chore-demo-data-reset-script` (off `main`).

## Unidad de trabajo

- [x] **U1 — Lógica + CLI + tests.** `apps/api/src/infrastructure/seed/reset-demo-data.ts` (lógica testeable con cliente inyectable, siguiendo el patrón de `seed-superadmin.ts`), `reset-demo-data-cli.ts` (entry delgado, nunca importado por `index.ts`) y `reset-demo-data.test.ts` (cliente falso que registra las llamadas). Scripts `reset:demo-data:docker` / `reset:demo-data:cloud` en `apps/api/package.json`.
- [x] **U2 — Docs.** `AGENTS.md`/`CLAUDE.md` (twins) y `docs/architecture/environments.md` §13.5.

## Diseño

- **Qué borra:** toda la actividad (22 tablas, en orden hijo→padre para no chocar con las FK) + todos los perfiles y usuarios de `auth` **excepto el superadmin** + los objetos del bucket `pyme-documents`.
- **Qué conserva:** el superadmin (resuelto por `VAQCROW_SUPERADMIN_EMAIL`) y la fila de `fx_rate` (sin ella `POST /campaigns` responde `rate_unavailable`).
- **Guardas:** (1) exige `RESET_DEMO_DATA_CONFIRM=yes`; (2) se niega, sin borrar nada, si el email del superadmin no resuelve a un `ADMIN` activo. Así el reset nunca puede borrar al admin por accidente.
- **Cómo borra:** la base por PostgREST (`delete()` con un filtro `not(columna,"is",null)` siempre verdadero — PostgREST rechaza un DELETE sin filtro); los usuarios por la **Auth Admin API** (`auth.admin.deleteUser`); los objetos por la **Storage API** (un `DELETE` por SQL dejaría los blobs), con un recorrido recursivo del bucket porque `list` no es recursivo.

## Verificación

- `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/seed/reset-demo-data.test.ts` → **9/9**: orden hijo→padre (incluye `audit_log` antes de `profile`, que es `NO ACTION`), el admin **nunca** se borra, las guardas rechazan sin borrar, y el parsing de env nombra las variables sin valores.
- `pnpm run verify` → ver el PR.

## Notas

- La limpieza real (la que motivó el script) se ejecutó sobre la base **remota** antes de escribir esto; el script reproduce exactamente esa operación.
- La **cadena no se limpia**: las bóvedas de Testnet siguen (la base es el espejo).
- Al usar la opción B se borran también las cuentas de prueba, así que un ensayo manual posterior necesita **registrar usuarios PYME/INVERSOR nuevos** (`/signup`; la confirmación de email está activa).
