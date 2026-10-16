# Feature #571 — Sacar del portafolio los aportes retirados o reembolsados por completo

Objetivo: que un aporte retirado o reembolsado por completo desaparezca de «Mis aportes», de «Total aportado» y del conteo de campañas, y que «Retirar mi aporte» no vuelva a aparecer después de recargar. Rama `Vaqcrow#571_Feat_Drop_fully_withdrawn_or_refunded_contributions_from_the_investor_portfolio`. Entrega en un PR (`ask-on-risk`). Runner: vitest (API) + pgTAP (`pnpm run test:db`).

## Specs

- **S1** — Hallazgo del owner (2026-10-16), verbatim: «Verificar el mecanismo de Retiar aporte, hice un retiro antes de retirar tenia de saldo 9.988,3408628 XLM, dice Enviada · pendiente de confirmación La transacción fue enviada, pero todavía no está confirmada y cuando refresco la pagina el saldo ya es 9.998,3398722 XLM quiere decir que remobolso pero la pymes me sigue apareciendo en la lista de mis aportes en Pymes con el mismo boton habilitado para Retirar mi aporte, capaz esta bien que muestre como historico que aporto y retiro aporte de esa campaña, pero lo ideal es que el boton Retirar mi aporte desaparezca. ademas me sigue mostrando en el cuadro de Total aportado 20,0000000 XLM En 2 campañas cuando yo ya retire todos mis aportes de las 2 campañas.»
- **S2** — Decisión del owner (2026-10-16): opción «a», o sea que la campaña desaparece de la lista y del total, sin fila de historial. El reconcile recibe un aporte de `0` observado en la red para un inversor que tiene fila guardada, y borra esa fila. Lo hace con condiciones sobre campaña + inversor + `last_observed_at <= observación`, así que una lectura vieja nunca borra una observación más nueva y repetir el pedido no cambia nada. Un `0` nunca se guarda como valor. Una reconciliación que no incluye al inversor no borra nada.
- **S3** — Decisión del owner (2026-10-16): opción «a», o sea que `/portfolio` también verifica en la red. Al leer el portafolio, por cada posición en estado `open` o `refundable`, la API lee en la red la campaña y el aporte del inversor, y reconcilia. Una posición que en la red tiene `0` no aparece en la respuesta ni suma al total ni al conteo. Si la lectura de la red falla, se usa lo guardado para esa posición (*best-effort*, sin campo nuevo en el contrato): el portafolio no responde 503 por una RPC caída.
- **S4** — Migración: `grant delete on public.campaign_contribution to service_role`. Se prueba en local (pgTAP) y se aplica al remoto en la misma unidad, con el historial alineado (`CLAUDE.md`). El borrado arrastra `campaign_refund_contact` (`on delete cascade`): después de un retiro o reembolso total ya no queda nada que reembolsar. `campaign_contribution_transaction` (los hashes de los aportes) cuelga de `campaign` y se conserva.
- **S5** — Criterios del issue: fila borrada y reconcile repetido sin efecto; `/portfolio` recargado sin la campaña, sin sumarla al total ni al conteo y sin el botón; los aportes de otros inversores de la misma campaña no se tocan; `pnpm run verify` y `pnpm run test:db` cubren el comportamiento nuevo. Evidencia en `docs/planning/drop-withdrawn-contributions-evidence.md`.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|---|---|---|---|---|
| T1 | S4 | inline | hecho local (remoto pendiente) | ver L3 |
| T2 | S2 | inline | hecho | ver L4 |
| T3 | S3 | inline | hecho | ver L5 |
| T4 | S5 | inline + verificador independiente | pendiente | verify, remoto, evidencia |

Ruta inline: no se dispara ningún writer, porque las unidades se encadenan y no son paralelas. Por riesgo alto (ítem 1: borra datos guardados) va un verificador independiente al final de la feature.

## Log

- **L1** (2026-10-16) — Pedido: el hallazgo S1. El owner eligió «a» (que la campaña desaparezca), «a» (que `/portfolio` verifique en la red) y respondió «dale, arrancá con #571».
- **L2** (2026-10-16) — Mapa:
  - El reconcile saltea `amountStroops <= 0` (`supabase-campaign-repository.ts:133-141`).
  - El aporte por inversor se lee en la red solo en `GET /campaigns/:id?investor=` (`campaign.route.ts:255-296`) y en el poll `GET /campaigns/:id/transactions/:hash?investor=` (`:540-565`). El cliente consulta 10 veces cada 1,5 s; si se recarga la página antes, nunca se reconcilia, y por eso hace falta S3.
  - `service_role` tiene SELECT, INSERT y UPDATE sobre `campaign_contribution`, pero no DELETE (`20260923183356_create_campaign_persistence.sql:102`).
  - El test «never writes a contribution row for a zero-amount entry» fija el comportamiento viejo. Su parte de «no insertar un 0» sigue valiendo; la de «no tocar la tabla» cambia por decisión del owner.
- **L3** (2026-10-16) — T1: migración `20261016143937_allow_withdrawn_contribution_delete.sql`, creada con `supabase migration new`, que hace `grant delete … to service_role`. Test pgTAP `supabase/tests/campaign_contribution_withdraw.sql`, con 8 asserts: DELETE solo para `service_role`; borrar el aporte de A deja intacto el de B, arrastra el contacto de reembolso de A, conserva el hash y saca la posición de `investor_portfolio_position`. RED: el assert 1 falló (`have: false`) y el DELETE como `service_role` dio `permission denied for table campaign_contribution`. Un error en el fixture (total mayor que la meta) se corrigió antes de la corrida RED válida. GREEN después de `supabase migration up --local`: 47/47 junto a `campaign_persistence.sql`.
- **L4** (2026-10-16) — T2: `SupabaseCampaignRepository.reconcile`. Un `0` llama a `deleteContribution`, que hace `delete` con `campaign_id` + `investor_account_id` + `last_observed_at <= observación`, con el mismo guard que `writeContribution`. El cliente fake ahora registra `.delete()`. El test viejo «never writes a contribution row for a zero-amount entry» se reemplaza por la regla nueva: borra, nunca inserta un 0 y solo actualiza la fila de la campaña. Se suman dos tests: un error del delete sale saneado, y un snapshot sin inversor no toca `campaign_contribution`, que es el comportamiento previo. RED: fallaron 2 de los 25 (los de la regla nueva). GREEN: 25/25. Suite de la API: 3200/3200. No hay tests de integración sobre reconcile.
- **L5** (2026-10-16) — T3: `getInvestorPortfolio` suma la dependencia opcional `vault` (`campaigns` + `chain`) y recibe `correlationId` como input.
  - `verifyPositions` lee en paralelo cada posición `open`/`refundable`: `readCampaign` + `readContribution` de la cuenta resuelta en el servidor. Si la red dice `0`, la posición se descarta; si dice otro monto, ese monto reemplaza al guardado. Una `settled` no se lee.
  - Cada lectura se reconcilia con `reconcileCampaign`, que con el `0` borra la fila (T2). Es *best-effort*: si el reconcile falla o lanza una excepción, la respuesta no cambia.
  - Si la red falla o lanza una excepción, se usa la posición guardada y no hay 503.
  - **Cambio de diseño respecto de L2:** se filtra en memoria con lo que dice la red, en lugar de volver a leer la base. Así la campaña retirada desaparece aunque el reconcile no se aplique (por ejemplo, por un `state_conflict`).
  - Importar `reconcileCampaign` desde otro caso de uso tiene precedente (`derive-revenue-share-distribution.ts:14`) y dependency-cruiser no lo prohíbe.
  - La ruta pasa `parseCorrelationId(request.id)`, como las rutas de campaña. `index.ts` conecta `vault` solo si existe el grupo de campaña.
  - **RED:** 4 de los 6 tests nuevos del caso de uso fallaron; los otros 2 (red caída, `settled`) describen el comportamiento previo. El test de la ruta también falló.
  - **Excepción RED:** el test «a vault read throws» se escribió junto con su guard, así que no hay corrida RED observada.
  - **GREEN:** caso de uso 20/20, ruta 11/11. Suite de la API 3208/3208, lint y typecheck limpios.
  - Seguridad (OWASP Top 10:2025, A01): la cuenta sale del principal verificado y nunca del cliente; la ruta sigue siendo `INVERSOR`-only. A10: los fallos de la red caen en lo guardado y nunca se presentan como un 0.
- **L6** (2026-10-16) — T4: `pnpm run verify` → exit 0 (web 2500, API 3208, contracts 759, `no dependency violations`). El verificador independiente revisó el candidato `871cefa` contra la base `7eb51b7`:
  - **Veredictos:** S1, S2 y S3 PASS. S4 y S5 PARTIAL, solo porque faltaban la migración remota y la evidencia.
  - **Probes propios en una copia aparte:** el guard usa el `lastObservedAt` de la contribución; si el update de la campaña no se aplica, no hay delete; las `settled` nunca se leen; sin `vault` la salida es idéntica a la base.
  - **Invariante:** los tests de la base contra el código nuevo pasan 45/46. El único que falla es el del 0, reemplazado a propósito.
  - **Bloqueante de entrega, aceptado:** ahora un `0` hace un DELETE, también para un inversor conectado que nunca aportó, en cada `GET /campaigns/:id?investor=`. Si la API sale antes del grant remoto, esas lecturas dan 42501 → 503, cuando en la base daban 200. **Orden:** el grant va al remoto **antes** del merge. Un grant de más no afecta a la API vieja. Es el orden inverso al del seed del blog.
  - **Advisories:**
    1. `portfolio.sql` test 49 cuenta sin filtro sobre la base local con datos de demo. Es ambiental y ya pasaba en la base.
    2. El borrado también corrige otras vistas: `backers` en `marketplace_campaign_detail`, las vistas del reporte del inversor y las `my_campaigns` de la PyME. Va en la evidencia.
    3. Para quien nunca aportó, el DELETE es un no-op de más por lectura. Es inofensivo.
    4. El reconcile no es atómico entre tablas: si el delete falla, la campaña ya avanzó. El guard `lte` deja que la siguiente lectura lo cure.
    5. Hay milisegundos de desfase entre `readCampaign` y `readContribution`; lo cubre el mismo guard.
