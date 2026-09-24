# Evidencia de cierre de la Feature #239 — Issue #257

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#250](https://github.com/reyduar/Vaqcrow/issues/250) y [#256](https://github.com/reyduar/Vaqcrow/issues/256), y agrega las verificaciones que el issue [#257](https://github.com/reyduar/Vaqcrow/issues/257) exige y que ninguna de las dos registraba: la idempotencia de la migración con salida de comando, el comportamiento de RLS y grants con el código de error observado, una divergencia sembrada con su corrección y la reversión de `funding_intent`. Cada resultado nombra su fuente. La bitácora de iteración es `odd/tasks/campaign-persistence.md`; la de este documento, `odd/tasks/campaign-persistence-evidence.md`.

## 1. Contexto y objetivo

La Feature [#239](https://github.com/reyduar/Vaqcrow/issues/239) ("Feature: Supersede the funding-intent XDR path and reconcile persistence") invierte la arquitectura de fondeo: con la bóveda de campaña de [#245](https://github.com/reyduar/Vaqcrow/issues/245), **el contrato Soroban es la fuente de verdad del dinero** y Supabase pasa a ser un espejo que se reconcilia contra la cadena, nunca al revés. Sus tres Tasks:

- [#250](https://github.com/reyduar/Vaqcrow/issues/250) — implementación, en una cadena de tres PRs: [#267](https://github.com/reyduar/Vaqcrow/pull/267) (esquema, puerto y caso de uso de reconciliación; merge `bced464`), [#268](https://github.com/reyduar/Vaqcrow/pull/268) (adaptador Supabase; merge `f43a1b9`) y [#269](https://github.com/reyduar/Vaqcrow/pull/269) (retiro del runtime de `funding_intent`; merge `2ea50f3`).
- [#256](https://github.com/reyduar/Vaqcrow/issues/256) — pruebas del adaptador y del esquema, en [#270](https://github.com/reyduar/Vaqcrow/pull/270) (merge `72b84d8`).
- [#257](https://github.com/reyduar/Vaqcrow/issues/257) — este documento.

Es un cambio **sólo de documentación**: sin diff de código de producción, tests ni migraciones.

## 2. Cómo leer esta evidencia

| Etiqueta de fuente | Significado |
|---|---|
| **Local, re-ejecutado** | Comando corrido el 24/09/2026 en el árbol de trabajo de la rama de #257 (basada en `main` tras #270), contra el stack Supabase local del perfil docker (contenedor `supabase_db_vaqcrow`, `127.0.0.1:54322`). |
| **Remoto, sólo lectura** | Consulta al proyecto Supabase remoto vía MCP (`list_migrations`, `execute_sql`) el 24/09/2026. Ninguna consulta remota escribió datos ni esquema: las pruebas de rol corren dentro de `begin; … rollback;`. |
| **PR** | Resultado registrado en el PR citado cuando se mergeó. |

> [!info] Por qué `docker exec … psql`
> `psql` no está instalado en el host y `supabase db query --local --file` prepara el archivo como una única sentencia, por lo que no sirve para la migración multi-sentencia. Todos los SQL locales se ejecutan con `docker exec -i supabase_db_vaqcrow psql -U postgres -d postgres -v ON_ERROR_STOP=1`.

## 3. Qué quedó implementado

- **Migración** `supabase/migrations/20260923183356_create_campaign_persistence.sql`: renombra `funding_intent` a `funding_intent_legacy`; crea `campaign`, `campaign_contribution` y `campaign_refund_contact`; habilita RLS y fija grants explícitos para `service_role` en la misma migración, sin grants por defecto a `anon` ni `authenticated`. Es idempotente (`if exists` / `if not exists`) y documenta su reversión en la cabecera.
- **Modelo espejo.** `campaign` guarda el último hecho observado de la cadena (estado, total, dirección del contrato, red, token) con `reconciliation_status` (`in_sync` / `diverged`), `last_reconciled_at` y `last_diverged_at`. El constraint `campaign_total_not_above_goal` replica el límite que impone el contrato.
- **Puerto y caso de uso** `apps/api/src/application/ports/campaign-repository-port.ts` y `apps/api/src/application/use-cases/reconcile-campaign.ts`: comparan el estado observado con el espejo antes de escribir y marcan la divergencia.
- **Adaptador** `apps/api/src/infrastructure/adapters/supabase-campaign-repository.ts`: actualización condicional por `campaign_id`, estado esperado y marca temporal de observación (`.eq("state", …)` + `.lte("last_reconciled_at", …)`), nunca `upsert`; errores de Postgres/PostgREST mapeados a una forma saneada.
- **Retiro del runtime** de `funding_intent` (#269): el composition root deja de construir su repositorio, XDR, cliente Horizon y scheduler.

## 4. Qué quedó probado

### 4.1 Idempotencia de la migración — local, re-ejecutado

Se tomó una huella del esquema (md5 ordenado de columnas, grants, RLS, constraints e índices de las cuatro tablas), se ejecutó la migración **dos veces** y se volvió a tomar la huella:

```text
== before
1733ad43581fb0e008413086dbfc7131|125
== run 1
exit=0
errors=0
== run 2
exit=0
errors=0
== after
1733ad43581fb0e008413086dbfc7131|125
```

Las dos ejecuciones terminan sin error y la huella no cambia: aplicar la migración sobre un esquema que ya la tiene es un no-op.

### 4.2 Paridad local–remoto — remoto, sólo lectura

La misma consulta de huella contra el proyecto remoto devolvió **`1733ad43581fb0e008413086dbfc7131` con 125 elementos**, idéntica a la local. El historial remoto (`list_migrations`) incluye `20260923183356 create_campaign_persistence`, la misma versión que el archivo del repositorio.

La huella no incluye triggers, funciones ni políticas de RLS. Se compararon aparte con una consulta sobre `pg_trigger`, `pg_proc` y `pg_policies`, ejecutada en ambos lados (remoto, sólo lectura; local, re-ejecutado), con resultado idéntico:

| Pieza | Local | Remoto |
|---|---|---|
| Función `set_campaign_updated_at` (`security_definer=false`) | presente | presente |
| Triggers `campaign_set_updated_at`, `campaign_contribution_set_updated_at`, `campaign_refund_contact_set_updated_at` | presentes | presentes |
| Trigger heredado `funding_intent_set_updated_at` en `funding_intent_legacy` | presente | presente |
| Políticas de RLS en las cuatro tablas | ninguna | ninguna |

La ausencia de políticas es intencional: con RLS habilitada y sin políticas, sólo `service_role`, que omite RLS, accede a las tablas. Es la razón de los `42501` de §4.3.

Con esta comparación, el esquema remoto coincide con el que produce la migración en todas las piezas que crea, por lo que re-ejecutarla en el remoto sólo repetiría la prueba de idempotencia de §4.1 (§5, límite 3).

### 4.3 RLS y grants con el código de error observado

Grants del proyecto remoto (`information_schema.role_table_grants` y `pg_class.relrowsecurity`), remoto, sólo lectura:

| Tabla | RLS | Grants (`anon`, `authenticated`, `service_role`) |
|---|---|---|
| `campaign` | habilitada | `service_role`: INSERT, SELECT, UPDATE |
| `campaign_contribution` | habilitada | `service_role`: INSERT, SELECT, UPDATE |
| `campaign_refund_contact` | habilitada | `service_role`: INSERT, SELECT, UPDATE |
| `funding_intent_legacy` | habilitada | `service_role`: SELECT |

`funding_intent` no existe en el remoto. Ninguna tabla tiene grants para `anon` ni `authenticated`.

Pruebas de rol dentro de `begin; set local role …; …; rollback;`:

| Rol | Operación | Resultado | Fuente |
|---|---|---|---|
| `anon` | `select count(*) from public.campaign` | `ERROR: 42501: permission denied for table campaign` | Remoto y local |
| `authenticated` | `select count(*) from public.campaign_refund_contact` | `ERROR: 42501: permission denied for table campaign_refund_contact` | Remoto y local |
| `authenticated` | `select count(*) from public.campaign_contribution` | `ERROR: permission denied for table campaign_contribution` | Local |
| `anon` | `insert into public.campaign_refund_contact default values` | `ERROR: permission denied for table campaign_refund_contact` | Local |
| `authenticated` | `select count(*) from public.funding_intent_legacy` | `ERROR: permission denied for table funding_intent_legacy` | Local |

El código `42501` se muestra con `\set VERBOSITY verbose` en local y en el mensaje del MCP en remoto.

### 4.4 Reconciliación con una divergencia sembrada — local, re-ejecutado

Dentro de una transacción que termina en `ROLLBACK`, se sembró un espejo y se le aplicaron **las mismas actualizaciones condicionales que emite el adaptador** (por `campaign_id`, estado esperado `open` y `last_reconciled_at <= observedAt`):

```text
  step        | state | total_stroops | reconciliation_status | last_diverged_at
 seeded       | open  |           100 | in_sync               |
 diverged     | open  |           250 | diverged              | 2026-09-24 10:05:00+00   (UPDATE 1)
 stale replay | open  |           250 | diverged              | 2026-09-24 10:05:00+00   (UPDATE 0)
 corrected    | open  |           250 | in_sync               | 2026-09-24 10:05:00+00   (UPDATE 1)
 after rollback: campaign_rows = 0
```

1. **Divergencia detectable.** La cadena observada a las 10:05 reporta 250 frente a los 100 del espejo: la fila pasa a `diverged` y conserva `last_diverged_at`.
2. **Un replay tardío no pisa un hecho más nuevo.** Una observación de las 10:01 aplicada después devuelve `UPDATE 0`.
3. **Corrección.** La observación siguiente coincide con el espejo y lo devuelve a `in_sync`; `last_diverged_at` queda como historial.
4. **El espejo no supera el objetivo.** `total_stroops = 1001` con objetivo 1000 falla con `violates check constraint "campaign_total_not_above_goal"`.

Además, `pnpm --filter @vaqcrow/api exec vitest run src/application/use-cases/reconcile-campaign.test.ts src/infrastructure/adapters/supabase-campaign-repository.test.ts` — **2 archivos, 13 tests verdes** (local, re-ejecutado). Incluyen `marks a stale mirror as diverged before applying the chain snapshot`, `marks an identical observation in sync`, `uses the conditional state and observation timestamp to reconcile, then mirrors contributions` y `makes a replayed reconciliation a non-application without rewriting contributions`.

> [!important] Qué representa "la cadena" en esta evidencia
> El lado de la cadena es la entrada de estado observado del caso de uso (el snapshot con `observedAt`), no una lectura en vivo de Testnet. La lectura del contrato desplegado ([#245](https://github.com/reyduar/Vaqcrow/issues/245)) y su conexión con este espejo pertenecen a [#237](https://github.com/reyduar/Vaqcrow/issues/237). Ver §5.

### 4.5 Retiro de `funding_intent` y reversión — local, re-ejecutado

El procedimiento documentado en la cabecera de la migración se ejecutó dentro de una transacción con `ROLLBACK`:

```text
 step             | funding_intent | legacy                | campaign
 before           |                | funding_intent_legacy | campaign
 reversed (in tx) | funding_intent |                       |
 after rollback   |                | funding_intent_legacy | campaign
```

La reversión elimina las tres tablas de campaña y su función de `updated_at`, y restaura el nombre `funding_intent`. El `ROLLBACK` deja el esquema como estaba. La suite pgTAP ejercita la misma reversión.

### 4.6 Esquema — local, re-ejecutado

`pnpm run test:db` — `supabase/tests/campaign_persistence.sql`, **17 comprobaciones pgTAP, `Result: PASS`**: tablas, RLS, grants y reversión aislada.

## 5. Límites operativos vigentes

1. **Sin lectura en vivo del contrato.** La divergencia se evidencia con estado observado sembrado, no leyendo la bóveda en Testnet. Lo cierra [#237](https://github.com/reyduar/Vaqcrow/issues/237).
2. **El adaptador no se ejercitó contra PostgREST en vivo.** Los 7 tests del adaptador usan dobles del cliente Supabase; la persistencia real se evidencia a nivel SQL (§4.4, §4.6). No existe una suite de integración con credenciales para las tablas de campaña.
3. **Idempotencia contra el proyecto remoto.** La migración se aplicó una vez en el remoto (#256) y no se re-ejecutó allí para esta evidencia, porque sería escribir DDL sobre la base de la demo. La idempotencia está probada en local (§4.1) y la paridad local–remoto por huella idéntica y por la comparación de triggers, función y políticas (§4.2).
4. **Suite de integración de `funding_intent` rota.** `apps/api/tests/integration/funding-intent-persistence.integration.test.ts` sigue apuntando a `funding_intent` y falla con `PGRST205` desde el renombrado. Es consecuencia esperada del retiro, pero la suite no se retiró ni se actualizó.
5. **Deriva de versiones de migraciones anteriores.** Las seis migraciones previas a esta Feature figuran en el historial remoto con versiones distintas a las de sus archivos (por ejemplo, `20260918130151` en el remoto frente a `20260918114635_create_application_review.sql`). La de esta Feature coincide. La deriva es anterior a #239 y queda fuera de su alcance.

## 6. Supersesión de #24

Esta Feature **supersede el camino de fondeo** de [#24](https://github.com/reyduar/Vaqcrow/issues/24) ("Feature: Build, verify and submit funding intent"): la API deja de ser autora del movimiento de dinero mediante un XDR firmado y persistido, y el contrato pasa a custodiar los fondos. [#24](https://github.com/reyduar/Vaqcrow/issues/24) y el Epic [#7](https://github.com/reyduar/Vaqcrow/issues/7) ("Epic: Stellar funding and confirmation") **siguen cerrados** (verificado con `gh issue view` el 24/09/2026: ambos `CLOSED`) y **no se reescriben**: su código, su evidencia (`docs/planning/funding-intent-submission-and-xdr-verification-evidence.md`) y la tabla, ahora `funding_intent_legacy`, se conservan como historia entregada.

## 7. Mapeo de criterios de aceptación

### Feature #239

| Criterio (textual) | Verificación | Fuente |
|---|---|---|
| A campaign and its contributions persist and are readable | Inserción y lectura de `campaign` en SQL (§4.4); tests del adaptador de persistencia y lectura de campañas y aportes (§4.4); pgTAP de tablas (§4.6). Límite 2 de §5. | Local, re-ejecutado |
| The mirror can be reconciled against the contract state and divergence is detectable | Divergencia sembrada → `diverged` → corrección a `in_sync`; replay tardío `UPDATE 0` (§4.4); tests del caso de uso. Límite 1 de §5. | Local, re-ejecutado |
| `funding_intent` is either repurposed or retired with a documented, reversible migration | Renombrado a `funding_intent_legacy`, reversión documentada en la cabecera y ejecutada en transacción (§4.5); runtime retirado en #269. | Local, re-ejecutado; PR #269 |
| RLS and grants are explicit, with no default `anon` or `authenticated` grants | RLS habilitada y grants sólo para `service_role`; `42501` para `anon` y `authenticated` (§4.3). | Remoto, sólo lectura; local |
| Refund notification data is available off-chain without storing PII in logs | Tabla `campaign_refund_contact` con grants sólo de `service_role` (§4.3); tests `updates a refund contact after a duplicate key without logging its PII` y `sanitizes a database failure without logging the row or PostgREST message` (§4.4). | Local, re-ejecutado |

### Task #257

| Criterio (textual) | Verificación |
|---|---|
| The evidence document exists under `docs/planning/` and is written in Spanish | Este archivo. |
| Every acceptance criterion of #239 is mapped with its verification | Tabla anterior. |
| Migration idempotency is evidenced with the command output | §4.1, con salida del comando. |
| The reconciliation is evidenced with a seeded divergence | §4.4. |
| The supersession of #24 is stated, with #24 and Epic #7 left closed | §6. |
| Any verification not run is declared as a bounded limitation | §5. |

## 8. Estado de entrega

- #250 y #256 están mergeadas en `main` (§1). Este documento se entrega en la rama `Vaqcrow#257_Task_Document_evidence_for_the_campaign_persistence_and_reconciliation`; la Feature #239 se cierra cuando esta rama se mergee.
- Seguimientos sugeridos, fuera del alcance de #239: retirar o actualizar la suite de integración de `funding_intent` (§5, límite 4), alinear el historial de migraciones previas (§5, límite 5) y conectar la lectura del contrato con el espejo en [#237](https://github.com/reyduar/Vaqcrow/issues/237).
