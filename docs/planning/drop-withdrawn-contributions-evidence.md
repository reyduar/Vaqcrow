---
title: Drop withdrawn contributions
tags:
  - planning
  - evidence
  - portfolio
  - stellar
  - database
date: 2026-10-16
status: delivered
---

# Feature #571 — Sacar del portafolio los aportes retirados o reembolsados por completo

> [!info] Objetivo
> Cuando un inversor retira (mientras la campaña está abierta) o le reembolsan (si la campaña falló) **todo** su aporte, la campaña sale de «Mis aportes», de «Total aportado» y del conteo de campañas, y «Retirar mi aporte» deja de aparecer, también después de recargar. Viene del test manual del inversor (Epic #568). Bitácora: [[odd/tasks/drop-withdrawn-contributions|drop-withdrawn-contributions]].

## Hallazgo del owner (verbatim)

> Verificar el mecanismo de Retiar aporte, hice un retiro antes de retirar tenia de saldo 9.988,3408628 XLM, dice Enviada · pendiente de confirmación La transacción fue enviada, pero todavía no está confirmada y cuando refresco la pagina el saldo ya es 9.998,3398722 XLM quiere decir que remobolso pero la pymes me sigue apareciendo en la lista de mis aportes en Pymes con el mismo boton habilitado para Retirar mi aporte, capaz esta bien que muestre como historico que aporto y retiro aporte de esa campaña, pero lo ideal es que el boton Retirar mi aporte desaparezca. ademas me sigue mostrando en el cuadro de Total aportado 20,0000000 XLM En 2 campañas cuando yo ya retire todos mis aportes de las 2 campañas.

## Causa raíz

El retiro sí ocurría en la red: el saldo volvía a subir. Pero la copia guardada nunca se enteraba de que el aporte había quedado en 0:

- `SupabaseCampaignRepository.reconcile` salteaba todo aporte con `amountStroops <= 0`, porque la tabla rechaza un 0 (`amount_stroops > 0`). Así quedaba la fila anterior de `campaign_contribution`.
- La vista `investor_portfolio_position` lista esa fila, y `getInvestorPortfolio` la suma al total y al conteo.
- El botón se ocultaba solo con estado local de la tarjeta, que se pierde al recargar.
- Además, el servidor recién lee el aporte en la red cuando el cliente consulta la transacción (10 veces cada 1,5 s) o cuando se abre el detalle de la campaña con la wallet conectada. Si se recarga antes de que se confirme, el reconcile con el 0 nunca corre.

## Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | La campaña **desaparece** de la lista y de los totales; no queda fila de historial (owner, opción «a») | Es el arreglo más chico. Un historial necesitaría una tabla nueva de retiros |
| D2 | Un `0` borra la fila del inversor, con `campaign_id` + `investor_account_id` + `last_observed_at <= observación`. Nunca se guarda un 0 | Una lectura vieja nunca borra un aporte observado después, y repetir el pedido no cambia nada |
| D3 | `GET /portfolio` vuelve a leer en la red las posiciones `open`/`refundable` (owner, opción «a») | Cubre el caso del hallazgo: recargar antes de que se confirme la transacción |
| D4 | El portafolio filtra **en memoria** según lo que dice la red; el reconcile hacia la base es *best-effort* | La red es la fuente de verdad. La campaña retirada desaparece aunque el reconcile no se aplique |
| D5 | Si la red falla, se usa lo guardado; no hay 503 ni campo nuevo en el contrato | Una RPC caída no deja al inversor sin portafolio |
| D6 | El borrado arrastra `campaign_refund_contact` (`on delete cascade`) y conserva `campaign_contribution_transaction` | Después de un retiro o reembolso total no queda nada que reembolsar. Los hashes de los aportes cuelgan de `campaign` |
| D7 | La migración remota se aplica **antes** del merge | Con la API nueva, un 0 hace un DELETE; sin el grant, `GET /campaigns/:id?investor=` respondería 503. Un grant de más no afecta a la API vieja |

## Cambios

- **Base de datos** (`016f815`): `supabase/migrations/20261016143937_allow_withdrawn_contribution_delete.sql` (`grant delete on public.campaign_contribution to service_role`) y `supabase/tests/campaign_contribution_withdraw.sql` (8 asserts).
- **Adaptador** (`b114b47`): `apps/api/src/infrastructure/adapters/supabase-campaign-repository.ts` agrega `deleteContribution`; el test del adaptador reemplaza la regla vieja del 0.
- **Portafolio** (`871cefa`):
  - `apps/api/src/application/use-cases/get-investor-portfolio.ts` suma la dependencia opcional `vault` y `verifyPositions`.
  - `apps/api/src/infrastructure/http/routes/portfolio.route.ts` pasa el `correlationId`.
  - `apps/api/src/index.ts` conecta `vault` cuando existe el grupo de campaña.

## Criterios de aceptación (verbatim del issue #571) → verificación

- **«After a confirmed full withdraw, the `campaign_contribution` row for that investor and campaign is gone, and a replayed reconcile is a no-op.»**
  - pgTAP `campaign_contribution_withdraw.sql`: el DELETE como `service_role` borra la fila de A.
  - Adaptador: «deletes the investor's contribution row when the chain reports zero…» comprueba que el delete va acotado por campaña, inversor y `last_observed_at`. Un replay no encuentra fila y no borra nada.
- **«`/portfolio` after a reload: the campaign is not listed, «Total aportado» and the count exclude it, and there is no «Retirar mi aporte» button for it.»**
  - `get-investor-portfolio.test.ts`: «drops a campaign the investor fully withdrew from the list, the total and the count…», «still drops the withdrawn campaign when the mirror reconcile fails…» y «verifies a refundable position too…».
  - Ruta: «leaves out a campaign the vault reports fully withdrawn (#571)» responde 200 con `contributions: []` y `campaignCount: 0`.
  - Sin la posición no se dibuja su tarjeta, así que tampoco su botón.
- **«Contributions of other investors in the same campaign are untouched.»** → pgTAP: «another investor's contribution to the same campaign is untouched».
- **«`pnpm run verify` passes, and `pnpm run test:db` covers the new behavior.»**
  - `pnpm run verify` (árbol de trabajo, 2026-10-16) → **exit 0**: web 2500, API 3208, contracts 759, `✔ no dependency violations found (1402 modules, 4694 dependencies cruised)`.
  - `supabase test db --local …campaign_contribution_withdraw.sql …campaign_persistence.sql` → 47/47.

## Verificación

- **RED observado antes de cada cambio:**
  - pgTAP: el assert 1 dio `have: false`, y el DELETE dio `permission denied for table campaign_contribution`.
  - Adaptador: 2 de 25 en rojo.
  - Caso de uso: 4 de los 6 tests nuevos en rojo. Los otros 2 describen el comportamiento previo.
  - Ruta: 1 en rojo.
  - El test «a vault read throws» se escribió junto con su guard, así que no hay corrida RED observada.
- **Verificador independiente** (riesgo alto, borra datos guardados). Revisó el candidato `871cefa` contra la base `7eb51b7`:
  - S1, S2 y S3 PASS.
  - Probes propios en una copia aparte: el guard usa el `lastObservedAt` de la contribución; si el update de la campaña no se aplica, no hay delete; las `settled` no se leen; sin `vault` la salida es idéntica a la base.
  - Los tests de la base contra el código nuevo pasan 45/46. Falla solo el del 0, que se reemplazó a propósito.
- **Seguridad** (OWASP Top 10:2025; el LLM Top 10 2026 no aplica porque no toca IA): **sin hallazgos**.
  - A01: el grant nuevo es solo DELETE para `service_role`; `anon` y `authenticated` siguen sin privilegios (pgTAP), y RLS no cambia. La cuenta del inversor sale del principal verificado y la ruta sigue siendo `INVERSOR`-only.
  - A10: los fallos de la red caen en lo guardado y nunca se presentan como un 0.

## Límites y notas

- **Otras vistas que cambian:** al borrar la fila también se corrigen `backers` en `marketplace_campaign_detail`, las vistas del reporte del inversor y las `my_campaigns` de la PyME. Es consistente con D1.
- **Reconcile no atómico:** se actualiza la fila de la campaña antes del delete del aporte. Si el delete falla, la siguiente lectura lo vuelve a intentar gracias al guard `lte`.
- **Costo:** para un inversor conectado que nunca aportó, cada lectura del detalle hace un DELETE que no borra nada.
- **Advisory ambiental:** `supabase/tests/portfolio.sql`, test 49, cuenta sin filtro sobre la base local con datos de demo. Ya fallaba en la base y no lo toca este cambio.
- **Pendiente al escribir esta evidencia:**
  - la migración remota, que va antes del merge (D7);
  - el PR;
  - el recorrido real en Testnet: aportar, retirar todo y recargar `/portfolio`.
