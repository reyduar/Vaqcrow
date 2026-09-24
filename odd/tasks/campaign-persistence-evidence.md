# Bitácora: evidencia de persistencia y reconciliación de campaña

## Objetivo

Producir el documento de evidencia en español que cierra la Feature [#239](https://github.com/reyduar/Vaqcrow/issues/239), mapeando cada criterio de aceptación a su verificación. Task [#257](https://github.com/reyduar/Vaqcrow/issues/257).

## Configuración

- Rama: `Vaqcrow#257_Task_Document_evidence_for_the_campaign_persistence_and_reconciliation`, desde `origin/main` (incluye #250 y #256).
- TDD: estricto por sesión; cambio de documentación: la verificación es relectura estructural y re-ejecución de cada comando registrado.
- Fuentes: `odd/tasks/campaign-persistence.md` (bitácora de #250/#256), PRs #267/#268/#269/#270.

## Tareas

- [x] **E1 — Evidencia local re-ejecutada.** Idempotencia de la migración (dos ejecuciones), RLS/grants con código de error observado, reconciliación con divergencia sembrada, reversión de `funding_intent`, tests del adaptador y pgTAP. Ruta: writer delegado (lectura de 4+ archivos + escritura).
- [x] **E2 — Evidencia remota de sólo lectura.** Historial de migraciones y grants/RLS del proyecto remoto vía MCP. Ruta: inline (padre).
- [x] **E3 — Documento de evidencia.** `docs/planning/<feature-slug>-evidence.md`. Ruta: writer delegado.

## Desvío de ruta

El writer delegado se detuvo dos veces sin progreso (watchdog de 600 s) sin escribir archivos, probablemente en un `docker exec -i … psql` esperando stdin. La recolección de evidencia y el documento se completaron inline, con `timeout` en cada comando. En zsh, los comandos guardados en variables se pasan como array (`P=(docker exec …)`), no como string.

## Verificación

- Idempotencia local: huella `1733ad43581fb0e008413086dbfc7131|125` antes y después de dos ejecuciones de la migración (exit 0, 0 errores).
- Paridad remota (MCP, sólo lectura): huella idéntica; `list_migrations` incluye `20260923183356`.
- RLS/grants: remoto sólo `service_role`; `42501` para `anon`/`authenticated` en remoto y local.
- Divergencia sembrada (local, `ROLLBACK`): `in_sync` → `diverged` (UPDATE 1) → replay tardío (UPDATE 0) → `in_sync`; constraint de objetivo rechaza 1001/1000; 0 filas tras rollback.
- Reversión en transacción: restaura `funding_intent` y elimina las tablas de campaña; `ROLLBACK` deja el esquema intacto.
- `vitest` reconcile + adaptador: 2 archivos, 13 tests. `pnpm run test:db`: 17 pgTAP, PASS.
- `gh issue view 24` / `7`: ambos `CLOSED`.
- Documento: `docs/planning/campaign-persistence-and-reconciliation-evidence.md`.

## Pendiente

Decisión del usuario sobre re-ejecutar la migración contra el remoto; hoy queda declarada como limitación acotada (§5, límite 3).
