# Bitácora: persistencia de campaña

## Objetivo

Implementar la persistencia espejo de las campañas custodiadas por contratos Soroban: la cadena conserva la autoridad del dinero y Supabase permite consultar, reconciliar y notificar sin guardar PII en logs. Task [#250](https://github.com/reyduar/Vaqcrow/issues/250) de la Feature [#239](https://github.com/reyduar/Vaqcrow/issues/239).

## Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | `campaign` guarda el último hecho observado de la cadena, no una orden de pago | Evita que la API vuelva a ser autora del movimiento de dinero |
| D2 | Una discrepancia deja `last_diverged_at` y estado `diverged` | Corregir el espejo sin dejar rastro ocultaría una inconsistencia relevante para la demo |
| D3 | `campaign_contribution` usa la clave `(campaign_id, investor_account_id)` | Replica el índice único de aportantes del contrato; no inventa transacciones off-chain |
| D4 | El correo de reintegro va a una tabla off-chain separada | La cadena no necesita PII; la plataforma sí necesita una vía para avisar un reintegro |
| D5 | `funding_intent` se renombra a `funding_intent_legacy` | Conserva evidencia de #24, pero elimina la ambigüedad de que siga siendo el camino activo de fondeo |

## Unidades de trabajo

- **U1 — Esquema y contrato de reconciliación.** Migración reversible: crea campaña, aporte y contacto de reintegro; aplica RLS y grants explícitos en la misma unidad; deja `funding_intent_legacy` sólo legible por `service_role`.
- **U2 — Reconciliación pura.** El caso de uso compara estado y total observados contra el espejo antes de escribir. Seis tests deterministas cubren divergencia, coincidencia y sanitización de errores.
- **U3 — Adaptador Supabase.** `SupabaseCampaignRepository` implementa inserciones y lecturas de campañas/aportes, actualización condicional por estado y marca temporal, y contactos de reintegro. No usa `upsert`: una inserción repetida se resuelve como actualización explícita y acotada. Sus pruebas de contrato e idempotencia son [#256](https://github.com/reyduar/Vaqcrow/issues/256).
- **U4 — Retiro del runtime legado.** El composition root deja de construir el repositorio, XDR, cliente Horizon y scheduler de `funding_intent`. Así, tras renombrar la tabla, el proceso no ejecuta consultas periódicas a una ruta retirada. Las rutas HTTP históricas permanecen aisladas en el código hasta que #237 las sustituya con el flujo de campañas.
- **U5 — Contrato de adaptador y esquema.** Las pruebas deterministas del adaptador verifican mapeo de errores, transición condicional, replay sin reescritura y actualización explícita ante claves repetidas. Las pruebas pgTAP verifican RLS, grants y el procedimiento de reversión dentro de una transacción que siempre hace `ROLLBACK`.

## Verificación parcial

- `pnpm --filter @vaqcrow/api exec vitest run src/application/use-cases/reconcile-campaign.test.ts` — 1 archivo, 6 tests verdes.
- `pnpm --filter @vaqcrow/api typecheck` — verde.
- `pnpm --filter @vaqcrow/api lint` — verde.
- `pnpm --filter @vaqcrow/api test` — 24 archivos, 490 tests verdes.
- `pnpm run boundaries` — 315 módulos y 851 dependencias, 0 violaciones.
- `pnpm run verify` — verde: lint, typecheck, 1.325 tests de workspaces, build, boundaries y 75 tests de límites.
- `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/adapters/supabase-campaign-repository.test.ts` — 1 archivo, 7 tests verdes: contrato del adaptador, conflictos y sanitización.
- `pnpm run test:db` — verde: 17 comprobaciones pgTAP locales de esquema, RLS, grants y reversión aislada.
- La migración `20260923183356_create_campaign_persistence.sql` se ejecutó dos veces contra la base local con `docker exec ... psql -v ON_ERROR_STOP=1`; ambas ejecuciones terminaron sin error y `pnpm run test:db` siguió verde. `supabase db query --local --file` no sirve para este archivo multi-sentencia porque lo prepara como una única sentencia.
- `pnpm run lint && pnpm run typecheck` — verdes tras añadir las pruebas; permanece un warning preexistente en `apps/web/src/infrastructure/http/fetch-http-client.ts` por `_request` sin usar.
- Supabase remoto — aplicada la migración de persistencia de campañas; se verificaron las tablas, RLS y grants de `service_role`. El historial remoto se alineó con `20260923183356_create_campaign_persistence` para que coincida con la migración versionada.

## Estado

Tres slices listos para revisión: fundación (361 líneas), adaptador (313 líneas) y retiro del runtime legado. La separación evita una PR única difícil de revisar y conserva fronteras de rollback claras: la última slice reactiva solamente la composición y el scheduler previos; no altera el esquema ni el adaptador de campañas.
