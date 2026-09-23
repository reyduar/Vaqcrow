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
- **U3 — Adaptador Supabase.** Pendiente de validación de contrato en [#256](https://github.com/reyduar/Vaqcrow/issues/256): inserciones, lecturas, actualización condicional y PII fuera de diagnósticos.

## Verificación parcial

- `pnpm --filter @vaqcrow/api exec vitest run src/application/use-cases/reconcile-campaign.test.ts` — 1 archivo, 6 tests verdes.
- `pnpm --filter @vaqcrow/api typecheck` — verde.
- `pnpm --filter @vaqcrow/api lint` — verde.

## Estado

Primer slice listo para revisión: migración, puerto y reconciliación pura. El adaptador se entrega como segundo slice para mantener cada PR debajo del presupuesto de revisión.
