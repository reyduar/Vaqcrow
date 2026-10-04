# Bitácora — Feature #406: conectar la wallet Freighter de la PyME antes de la revisión

Rama de la Feature: `Vaqcrow#406_Feat_Connect_the_PyME_Freighter_wallet_before_review` (placeholder de integración).
Rama de trabajo: `Vaqcrow#407_Task_Implement_the_PyME_Freighter_wallet_connection` (stacked sobre #401, la punta de la pila #398/#399/#400/#401).

## Objetivo

Que la PyME conecte (o cree) Freighter, la app obtenga su public key y la **guarde en su perfil** tras un challenge firmado de un solo uso; que la key sea el **destino inmutable** de la bóveda y **precondición del envío a revisión**; y entregar el **wallet card** del template, reutilizable por los flujos de inversor.

## Hechos de la exploración (2026-10-04)

- **El puerto y el adaptador ya existen.** `WalletPort` (`apps/web/src/application/ports/wallet-port.ts:41-45`) y `FreighterWallet` (`apps/web/src/infrastructure/wallet/freighter-wallet.ts:77`) están implementados y los consumen los flujos de inversor (`funding-workspace`, `distribution-workspace`, `campaign-workspace`, `workspace-status`). **#406 no necesita un puerto nuevo**; el nombre `WalletConnectionPort` del issue corresponde al `WalletPort` del repo.
- **`public.profile` no tiene columna de wallet** (`supabase/migrations/20260930180000_create_identity_and_audit.sql:26-42`); patrón de grants/RLS: `service_role` escribe, `authenticated` sólo lee lo propio (`:64-82`).
- **No hay challenge/nonce** ni verificación de firma fuera de sobres de transacción (`stellar-campaign-vault-invocation.ts:209-219` usa `Keypair.fromPublicKey(...).verify`). `@stellar/stellar-sdk` vive sólo en `infrastructure/` (regla de dependencias).
- **Inmutabilidad:** `campaign` guarda `sme_account_id` (`20260924132528_add_campaign_sme_account.sql:24`) y enlaza con el dueño vía `sme_request.owner_user_id` → `campaign.application_id`. No existe hoy una query dueño→campaña.
- **Wallet card del template:** `docs/design/template/Vaqcrow Portafolio.dc.html:116-137` («Freighter conectada de forma no custodial», `STELLAR TESTNET`, «Saldo disponible», «Activo de prueba sin valor económico», key acortada + Copiar/Copiada, Explorador, Desconectar).
- **Wizard:** `review-step.tsx:99-111` (`connectWallet`) deja la key **sólo en estado del componente**; `sendReview` (`:113-138`) bloquea sin key.

## Alcance a construir (vs. lo existente)

1. **Migración (docker→remoto).** `profile.stellar_public_key` (nullable, `^G[A-Z2-7]{55}$`) + almacenamiento de un challenge de un solo uso (tabla + TTL/consumo). Escritura API-mediada (`service_role`), `ADMIN` lee.
2. **API.** Emitir y verificar un challenge firmado de un solo uso (`Keypair.fromPublicKey(...).verify` en `infrastructure/`); puerto/repositorio de perfil + adaptador Supabase; rechazo por red equivocada; guardar tras verificar; guarda de inmutabilidad (existe campaña/bóveda del dueño); precondición del envío.
3. **Web.** Pedir el challenge y firmarlo con el `WalletPort` existente; persistir la key por un puerto; **wallet card** fiel al template; cablearlo en `review-step`.
4. **Pruebas + evidencia.** RED de almacenamiento/challenge/inmutabilidad/red; doble de Freighter; sin wallet real ni Testnet.

## Decisiones del owner (2026-10-04)

| # | Pregunta (issue #406, «Not designed in the template») | Resolución (owner) |
|---|---|---|
| 1 | Estados de Freighter (no instalado, rechazo, red equivocada, cuenta sin fondos) | **Estados honestos por caso** (español neutro): no instalado + guía para crear wallet; usuario que rechaza; red equivocada (pedir Testnet); cuenta sin fondos (saldo 0 visible, **no** bloquea guardar la key). |
| 2 | Cambiar/reemplazar la key antes de la aprobación; qué muestra la revisión admin | **Reemplazable hasta el deploy.** Antes de que exista la bóveda, la PyME puede desconectar/reconectar y guardar una key nueva; una vez desplegada la bóveda queda **congelada**. La revisión admin muestra la key **acortada** como destino inmutable. |
| 3 | Dónde vive el paso de conexión | **Paso 4 «Revisión humana» del wizard** (como D12 y el código actual) + **wallet card en `/company`** (Mi campaña), según DEMO.md. |

## Tareas

- [ ] **T1 (#407) — Implementar.** Migración + API (challenge, perfil, inmutabilidad) + wallet card + cableado del wizard. Ruta: por definir.
- [ ] **T2 (#408) — Probar.** Pruebas deterministas de #406. Ruta: por definir.
- [ ] **T3 (#409) — Evidencia.** `docs/planning/pyme-wallet-connection-evidence.md`. Ruta: por definir.

## Próximo paso

Decisiones registradas (2026-10-04). Arranca **T1 (#407)** por la migración (T1a): `profile.stellar_public_key` + almacenamiento del challenge de un solo uso, local→remoto.
