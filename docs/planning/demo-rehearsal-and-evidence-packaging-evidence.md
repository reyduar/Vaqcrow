# Evidencia de cierre de la Feature #33 — Issue #106

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#104](https://github.com/reyduar/Vaqcrow/issues/104) (implementación), [#105](https://github.com/reyduar/Vaqcrow/issues/105) (pruebas) y [#106](https://github.com/reyduar/Vaqcrow/issues/106) (evidencia) de la Feature [#33](https://github.com/reyduar/Vaqcrow/issues/33) ("Feature: Rehearse the demo and package evidence", Epic [#10](https://github.com/reyduar/Vaqcrow/issues/10)). Corre los ensayos en este árbol de trabajo y mapea cada criterio de aceptación, citado textualmente, a su resultado y a la fuente de ese resultado. La bitácora de iteración que lo alimenta es [[odd/tasks/demo-rehearsal-and-evidence|Bitácora: ensayo de la demo y empaquetado de evidencia]].

> [!warning] Alcance real de esta entrega: tres ensayos a nivel API, no un paquete completo de video/pantallas
> El ensayo hosteado (`scripts/demo/rehearsal/hosted-rehearsal.mjs`) es **un recorrido a nivel API, sin navegador**. Demuestra el contrato de rutas real del stack desplegado y produce **hashes y direcciones públicas**, pero **no** produce video, capturas de pantalla, ni un artefacto de XDR decodificado. Los criterios de #33/#104 que piden ensayos "across the template screens" y un paquete con video/capturas/JSON de IA se cubren **parcialmente**; lo que falta queda listado como pasos del operador en §8. Es un hallazgo, no una omisión silenciosa.

## 1. Contexto y objetivo

La Feature #33 reúne resiliencia y despliegue y cierra con tres ensayos internos de los workflows por rol (PyME, admin, inversor) más un paquete de evidencia de respaldo. Depende de #31 y #32 (cerradas y con evidencia propia) y de #438 (el retiro del recorrido guionado, en `main` desde PR #466). Habilita a #34 (congelar build y presentación).

| Task | Rama | Estado del issue (2026-10-11) |
|---|---|---|
| #104 — implementar | `Vaqcrow#33_Feat_Rehearse_the_demo_and_package_evidence` | script `6b6e272`; este documento |
| #105 — probar | (misma rama de la Feature) | ensayos hosteados + e2e opt-in; sin commit de producción propio |
| #106 — documentar | (misma rama de la Feature) | este documento |

El trabajo vive en la rama `Vaqcrow#33_Feat_Rehearse_the_demo_and_package_evidence`, creada desde `main` `534f295`. No hay PR ni merge en esta Feature y este documento **no reporta un estado mergeado**. Solo cambian artefactos de demo/documentación: `scripts/demo/rehearsal/*` (commit `6b6e272`) y los dos documentos de evidencia de esta unidad.

## 2. Cómo leer esta evidencia

- **Fuentes, siempre nombradas.** (a) **Re-ejecutado** — un comando corrido el 2026-10-11 en este árbol de trabajo, con su salida real (§4, §5, §6). (b) **Registrado** — una entrada fechada de una bitácora previa; se cita, **no** se re-ejecutó aquí (§6.4).
- **Solo datos públicos.** Ningún email, contraseña, API key, token, clave secreta ni PII aparece aquí. Los **hashes de transacción, direcciones de contrato y claves públicas** sí: son identificadores públicos on-chain (y ya están en Testnet). El **XDR se mantiene fuera** por completo: el ensayo lo firma y lo envía en proceso, pero solo conserva el hash.
- **Sin claims de producción.** La entrega es de demo: Testnet sin valor económico, Supabase remoto de demo, LLM asesor, conversión ARS↔activo simulada. Nada aquí afirma disponibilidad, SLA, valor económico ni custodia de fondos ajenos.
- **Ensayo = verificación acotada, no test de PR.** El ensayo hosteado y el e2e en vivo son **opt-in**; nunca corren en `pnpm run verify`, en `turbo test` ni en CI (ver `docs/architecture/environments.md`).

## 3. Qué es el ensayo (Task #104)

Fuente: `scripts/demo/rehearsal/README.md` y `scripts/demo/rehearsal/hosted-rehearsal.mjs` (commit `6b6e272`), más la salida observada en §4.

`hosted-rehearsal.mjs` recorre el flujo de roles completo **contra el stack desplegado**: la API de Railway (`https://api-production-c07f.up.railway.app`), el proyecto Supabase remoto (Auth + Storage + Postgres) y **Stellar Testnet**. Firma en proceso con `@stellar/stellar-sdk` (la `Keypair` vive sólo en memoria). Cubre, en un solo run:

| Paso | Ruta real |
| ---- | ----- |
| 0 | `POST /admin/rates` (v1 cuando la tabla está vacía) |
| 1 | GoTrue `signup` → Admin API `email_confirm` → password grant |
| 2 | `POST /profile/wallet/challenge` + `/profile/wallet` (mensaje SEP-53) |
| 3 | `POST /businesses` |
| 4 | `POST /storage/uploads` × 3 documentos + 1 foto (multipart) |
| 5 | `POST /completeness-check` (asesor: siempre `200`, solo advierte) |
| 6 | `POST /sme-requests` → `applicationId` |
| 7 | `GET /application-reviews/:id/context`, `PUT …/documents/:id/verdict`, `POST …/decisions` |
| 8 | `GET /application-reviews/:id/deployment` hasta `confirmed` → `campaignId` |
| 9 | `GET /campaigns/:id` → `contractAddress` |
| 10 | inversor: GoTrue `signup`/`confirm`, Friendbot, vínculo de wallet |
| 11 | `POST /campaigns/:id/invocations` → firma del XDR → `/invocations/submission` → observa la tx |
| 12 | `GET /campaigns/:id` refleja el aporte |

Cada paso imprime `[reh] step: …` y el run termina con una línea `FACTS` con los ids/hashes públicos. El run es **Option A**: crea registros frescos por corrida, **nada se resetea**. Una falla imprime `[reh] FAILED: <paso> -> HTTP <status> <cuerpo saneado>` y sale con código distinto de cero. Los documentos y la foto son sintéticos y lo dicen en su texto.

### 3.1 Comando (forma observada que funciona)

Desde `apps/api` (el workspace resuelve `@stellar/stellar-sdk`; el perfil cloud se carga **sólo** por `--env-file`, nunca se lee ni se imprime):

```bash
node --env-file=../../.env.cloud ../../scripts/demo/rehearsal/hosted-rehearsal.mjs
```

> [!info] Nota de comando observada (2026-10-11)
> La forma `pnpm --filter @vaqcrow/api exec node --env-file=../../.env.cloud ../../scripts/demo/rehearsal/hosted-rehearsal.mjs` corrió con el cwd en la **raíz del repo** y falló con `node: ../../.env.cloud: not found`. La forma equivalente desde `apps/api` (§3.1) es la que funcionó; también es la documentada por el propio encabezado del script y el `README.md`. No se tocó el script.

### 3.2 Gotcha del script (bug de script, no de producto)

`Keypair.signMessage(message)` devuelve un `Uint8Array` plano, no un `Buffer`; `signature.toString("base64")` sobre un `Uint8Array` ignora el argumento y devuelve una lista de bytes separada por comas, que la API rechaza `400 { code: "invalid_request" }`. El script lo envuelve: `Buffer.from(sig).toString("base64")`. Es un bug de script documentado, ya resuelto en `6b6e272`.

## 4. Los tres ensayos (evidencia primaria)

Tres ensayos internos completos. El primero lo reportó el padre (sólo se conserva su `runId`; sus FACTS completos no quedaron persistidos en el repo). Los dos siguientes se **re-ejecutaron acá el 2026-10-11** y los tres terminaron en verde. Campos pedidos: runId, applicationId, campaignId, contractAddress, contributionTxHash, contributionStatus.

| # | runId | applicationId | campaignId | contractAddress | contributionTxHash | contributionStatus | Fuente |
|---|---|---|---|---|---|---|---|
| 1 | `d16c3808` | (no persistido) | (no persistido) | (no persistido) | (no persistido) | (no persistido) | Registrado por el padre |
| 2 | `f03640cf` | `d377c4c9-c923-4998-8226-0723c3c90be9` | `cfd44430-e7bf-4701-919c-ef3ce1ab12c4` | `CBIFVYSC6ILDBSPGVGFFKA7XXJBMJI5XSGD6BAZGMQBUHUZRJXPZQORO` | `5b2ec2f9ae76379ff3562fcbcdf362208ece20c45c395d4656f7e153ff739ca3` | `success` | Re-ejecutado |
| 3 | `55f080b2` | `8f41722f-b839-473a-8e66-f38741360ec6` | `20b3f80b-77c0-49e8-a956-1e45e755e8a5` | `CB6RXGUQS4AQH2EGO2YV77JHD6ATSZRGGADMESN6LLC2TK3ACQK767VR` | `387f5646a7d877213d8021fbfe872405f24c6b04631c8dd1bba141735e688e2a` | `success` | Re-ejecutado |

Hechos adicionales observados en los dos runs re-ejecutados (mismos pasos, valores propios por corrida):

| Hecho | Run 2 (`f03640cf`) | Run 3 (`55f080b2`) |
|---|---|---|
| `smePublicKey` (destino inmutable de la bóveda) | `GANM6AJHITC3ZAJQHFPOZTC7FJQ5IHRXDUUMWXODUJGC7EUAHTGEZDLX` | `GAHJ2D66RTN4T23J5RQRPM3KPAYBXUFNVWRMAZ5IWYU5MONWQ2ZHGVXW` |
| `investorPublicKey` | `GACFFP46NT6CQLRM764NVAKHIPTA3S2WCV5GKNOXW6B43XAQS7U5GK5E` | `GCQPC6A7PQYFYJXJ2IWBAGPLRDFSLBUONIPQOEAYU7T6KABTK5P5MCOY` |
| decisión admin | `{applied: true, outcome: approved}` | `{applied: true, outcome: approved}` |
| despliegue | `{state: confirmed, attempts: 1}` | `{state: confirmed, attempts: 1}` |
| estado de campaña | `funding` | `funding` |
| `goalStroops` | `150000000000` | `150000000000` |
| `contributionStroops` | `15000000000` (`goal/10`, el tope por inversor) | `15000000000` |
| veredicto de documento | `{verdict: valid}` | `{verdict: valid}` |
| `completeness` | `{complete:false, findings:[content_irrelevant, content_irrelevant, content_irrelevant, content_unverified]}` | idéntico |

> [!info] El `complete:false` es lo esperado, no un fallo
> La verificación de completitud (datos declarados + pasada de visión) marca los **documentos sintéticos** como no relevantes. Es **asesora y nunca bloquea el envío**; el ensayo continuó y el admin aprobó. Está documentado en el `README.md` del ensayo.

**Enlaces de explorador (construibles desde los hashes/contrato anteriores).** El contrato y la transacción tienen ruta en Stellar Expert Testnet:

- Transacción: `https://stellar.expert/explorer/testnet/tx/<contributionTxHash>` — p.ej. `https://stellar.expert/explorer/testnet/tx/5b2ec2f9ae76379ff3562fcbcdf362208ece20c45c395d4656f7e153ff739ca3`.
- Contrato: `https://stellar.expert/explorer/testnet/contract/<contractAddress>` — p.ej. `https://stellar.expert/explorer/testnet/contract/CBIFVYSC6ILDBSPGVGFFKA7XXJBMJI5XSGD6BAZGMQBUHUZRJXPZQORO`.

> [!warning] Qué prueba el 200 del explorador y qué no
> Ambas rutas sirven `HTTP 200` en Testnet, pero el 200 también se obtiene con un id inexistente (probado con un hash y un contrato falsos): es una app de una sola página. El 200 confirma que la **ruta sirve**, no que la entidad exista. La existencia de la tx/contrato la prueba el propio run (la contribución observada `success` y el contrato leído por la API), no el explorador.

## 5. Preflight del perfil cloud (re-ejecutado)

Comando (desde la raíz del repo), re-ejecutado el 2026-10-11:

```sh
$ pnpm demo:preflight --env-file .env.cloud
✔ API environment variables — 11 names present
✔ Web environment variables — NEXT_PUBLIC_API_BASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY present
✔ Transactional email (Resend) configuration — email disabled: RESEND_API_KEY unset (from Vaqcrow <no-reply@vaqcrow.com>, links http://localhost:3001)
✔ API GET /health — HTTP 200
✔ Horizon reachable, Testnet — HTTP 200, Testnet passphrase (canonical Testnet default https://horizon-testnet.stellar.org; STELLAR_HORIZON_URL unset)
✔ Soroban RPC healthy, Testnet — healthy, Testnet passphrase (canonical Testnet default https://soroban-testnet.stellar.org; STELLAR_RPC_URL unset)
✔ Campaign factory contract exists — CCDN…SV7J instance found
✔ Platform account funded — GBCO…X2ZG holds 10 XLM minimum
✖ SME account funded — no SME account (pass --sme or set DEMO_SME_PUBLIC_KEY)
✖ Investor account(s) funded — no investor account (pass --investor or set DEMO_INVESTOR_PUBLIC_KEYS)
✔ Remote schema has the journey tables — 9 tables readable
✔ revenue_share_distribution has campaign_id and period — both columns selectable
✔ An active ADMIN profile exists — an active ADMIN profile found

Not ready: 2 check(s) failed.
```

**Lectura.** Todo verde salvo **los dos chequeos de saldo de las cuentas demo** (SME e inversor), que requieren que el operador pase las cuentas (`--sme` / `--investor` o `DEMO_SME_PUBLIC_KEY` / `DEMO_INVESTOR_PUBLIC_KEYS`). No es un defecto: el ensayo hosteado **crea sus propias cuentas** (la de la PyME la crea la plataforma en el deploy; la del inversor la fondea Friendbot), así que no necesita cuentas pre-fondeadas. El preflight confirma que la fábrica con tope `CCDN…SV7J` existe y que la cuenta de plataforma tiene el mínimo de 10 XLM.

## 6. Ensayo en vivo local (el "segundo ensayo")

### 6.1 Qué es

`pnpm --filter @vaqcrow/web run test:e2e:live` (Playwright, `apps/web/e2e-live/admin-review.live.spec.ts`, Feature #410 U9) maneja la **UI real** de los tres roles contra el perfil docker (`STELLAR_NETWORK=local`): Supabase local (Auth + Mailpit + Storage + Postgres), el contenedor de la API y la red local de Stellar Quickstart, con Freighter emulado. Es el ensayo *de pantallas* del rol; desde #472 (PR #473, commit `6ea5549`) el **primer aporte del inversor corre por la UI** (KYC simulado → firma Freighter → estado honesto «Enviada · pendiente de confirmación.»). Fuera de `turbo`, de `verify` y de CI: opt-in.

### 6.2 Resultado de esta sesión (2026-10-11): no se pudo observar en verde

Cuatro intentos en esta sesión, **todos fallaron** por el estado del stack local (no por el spec ni por el código de producto). El stack local estaba **degradado**: Postgres re-inicializó a las `20:57:56Z` y la API acumuló timeouts de verificación de Supabase Auth.

| Intento | runId | Paso que falló | Error observado | Evidencia de entorno |
|---|---|---|---|---|
| 1 | `b83993e0` | Paso 2 (subida) | tras `setInputFiles`, el nombre `declaraciones-de-ventas-sintetico.pdf` no aparece (la subida falló) | API: `PGRST000 Database connection error … recovery mode`; `[SupabaseAuth] … timeout`; Postgres re-inicializado `20:57:56Z` |
| 2 | `a52d14a4` | Paso 2 (wallet) | tras «Conectar Freighter», el panel queda en `Conectando… [disabled]` y nunca muestra «Wallet Freighter conectada» | API: `[SupabaseAuth] unexpected failure { cause: 'timeout' }` |
| 3 | `48b2f4d5` | Paso 2 (subida) | misma aserción de subida que el intento 1 | API: `[SupabaseAuth] … timeout` |
| 4 | `26eb639b` | Paso 0 (tasa) | `GET /admin/rates/current` → `503 {"code":"unavailable"}` | API: `[SupabaseAuth] … timeout`; `supabase_pg_meta_vaqcrow` `unhealthy` |

Estos son **fallos de entorno**: la API del perfil docker no puede verificar tokens contra Supabase Auth (timeouts repetidos) y una lectura respaldada por Supabase devuelve `503 unavailable`. No se tocó código de producto, ni el spec, ni contenedores (reiniciar el stack local excede la superficie de esta unidad). El síntoma del intento 2 (el `Conectando…` que nunca resuelve) es aguas abajo del mismo problema: el `POST /profile/wallet` autenticado cuelga cuando la verificación del token agota el tiempo.

### 6.3 Estado del entorno observado

```
Postgres:  re-inicializado 2026-10-11T20:57:56Z → listo 2026-10-11T20:58:03Z (una sola vez)
API /health (localhost:3000): HTTP 200 {"status":"ok"} (sin probes de dependencias en el perfil docker)
Supabase Auth health (127.0.0.1:54321): HTTP 200
supabase_db_vaqcrow: healthy · supabase_kong_vaqcrow: healthy · supabase_pg_meta_vaqcrow: unhealthy
API logs (últimos ~15 min): `[SupabaseAuth] unexpected failure { cause: 'timeout' }` ×5, `[SupabaseAuth] token verification failed` ×2
```

### 6.4 Historial verde del mismo spec (registrado, no re-ejecutado acá)

El mismo `admin-review.live.spec.ts` tiene un historial documentado de corridas verdes en el perfil docker: **Corridas E–K** de [[odd/tasks/application-review-and-vault-deployment|application-review-and-vault-deployment]] (2026-10-08), todas `1 passed` en 1,9–2,9 min — p.ej. Corrida G `d545770c` (2,1 min), H `e3550052` (1,9 min), I `1dd3fee2` (2,9 min), J `6f1b61cc` (2,6 min), K `bfa51d62` (2,2 min). PR #473 (merge `534f295`, desde `Vaqcrow#472_Task_Fix_the_investor_contribution_UI…`) llevó el primer aporte a la UI con commits `6ea5549` (test), `ee0ff7b` y `47ccb78` (fixes del gateway de campaña: autenticación y timeout de largo de cadena). **Esos resultados se citan; esta sesión no los re-observó en verde** y no se reporta un check no corrido.

## 7. Corrección del perfil `.env.cloud` (higiene del perfil local)

El perfil cloud local estaba mal apuntado: `APP_ENV=local` y un RPC a `localhost`. Se corrigió a `APP_ENV=demo`, el RPC canónico de Testnet y se agregó `NEXT_PUBLIC_API_BASE_URL`. **Higiene del perfil local**: `.env.cloud` es un archivo **ignorado por git** (`git check-ignore` → `.gitignore:36`) que **la API desplegada nunca lee** — Railway tiene sus propias variables. La corrección sólo afecta a las herramientas que cargan ese archivo desde la máquina del operador (el ensayo y el preflight).

Verificación observada de que el efecto está vigente (§5): el preflight reporta los **defaults canónicos de Testnet** (`STELLAR_HORIZON_URL unset` → `https://horizon-testnet.stellar.org`; `STELLAR_RPC_URL unset` → `https://soroban-testnet.stellar.org`) y `NEXT_PUBLIC_API_BASE_URL` presente. El valor de `APP_ENV` no se lee ni se imprime desde acá (el archivo es ignorado y no se lee directamente).

## 8. Brechas honestas frente a #104

El criterio grande de #104 pide, en una sola frase: **tres** ensayos, **a través de las pantallas del template**, y **congelar** un paquete con **video de respaldo, JSON de IA, XDR decodificado, hashes, capturas y enlaces de explorador**. Frente a eso:

| Pedido por #104 | Estado | Detalle / fuente |
|---|---|---|
| Tres ensayos internos de los workflows por rol | ✅ Cubierto | 3 runs hosteados (1 reportado + 2 re-ejecutados), §4 |
| Ensayos **a través de las pantallas** | ⚠️ Parcial | El ensayo hosteado es **a nivel API, sin navegador**. El e2e U9 sí es de pantallas, pero **no se re-observó en verde** esta sesión (§6.2). Historial verde citado (E–K). |
| Video de respaldo grabado | ❌ No producido | Paso del operador |
| Capturas de pantalla del paquete | ❌ No producido | Solo quedaron capturas de fallo del e2e (§6.2), no un set empaquetado |
| XDR decodificado (artefacto) | ❌ No producido | El ensayo firma y envía el XDR en proceso; **solo conserva el hash** (el XDR se mantiene fuera por diseño) |
| JSON de IA (artefacto de evaluación) | ⚠️ Parcial | Se registran los *findings* del chequeo de completitud (`content_irrelevant` ×3, `content_unverified`); el JSON de la evaluación asesora no se archivó. El run llegó a `human_review` con decisión aplicada, así que hubo assessment/handoff, pero su JSON no se conserva. |
| Hashes | ✅ Cubierto | 2 hashes de contribución + contrato y claves públicas por run (§4) |
| Enlaces de explorador | ✅ Cubierto (construibles) | §4; la ruta sirve 200, con el límite declarado |
| Registro y triaje de defectos | ⚠️ Parcial | El ensayo hosteado no encontró defectos (happy path); los fallos del e2e local fueron **de entorno**, documentados en §6.2 |
| Congelar el dataset sintético | ⚠️ Parcial | El ensayo **genera** documentos/foto sintéticos en proceso con constantes fijas; no hay un artefacto de dataset "congelado" aparte |

**Pasos del operador que quedan para el paquete completo:** (1) grabar el video de respaldo del recorrido por roles; (2) capturar el set de pantallas del template; (3) exportar el JSON de evaluación de IA y (si el owner lo decide) un XDR decodificado como artefacto; (4) re-ejecutar el e2e U9 en un stack local sano y adjuntar su salida. Ninguno se declara hecho acá.

## 9. Mapeo de criterios de aceptación

Los criterios se citan **textualmente** desde cada issue.

### Feature #33

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Run three internal rehearsals of the role workflows (PyME, admin, investor) across the template screens and freeze the fallback evidence package." | ⚠️ **PARCIAL.** Los tres ensayos por rol se corren (a nivel API, §4). "Across the template screens" queda **parcial** (el ensayo hosteado no usa navegador; el de pantallas U9 no se re-observó verde, §6). "Freeze the fallback evidence package" queda **parcial**: hashes + enlaces de explorador cubiertos; video, capturas, XDR y JSON de IA pendientes (§8). | §4, §6, §8 |
| 2 | "Required evidence and failure behavior are covered." | ⚠️ **PARCIAL.** La evidencia requerida (tres runs + preflight) está cubierta. El **comportamiento de fallo** del propio ensayo está cableado (retry acotado del assessment, retry del deploy, `FAILED: <paso> -> HTTP <status> <cuerpo saneado>`), pero **no se ejecutó un camino de fallo** en estos runs (los tres fueron happy path). Los caminos de fallo de producto se cubren en la evidencia de #31. | §3, §4; [[odd/tasks/demo-rehearsal-and-evidence]] |
| 3 | "No unsupported production claims or secrets are introduced." | ✅ **CUMPLIDO.** Sin claves secretas, tokens, PII ni XDR; se listan sólo hashes/contratos/claves públicas on-chain. Nada afirma producción (§2). | §2, revisión de este documento |

### Task #104 — implementación

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Feature #33 behavior is implemented within its documented boundary." | ✅ **CUMPLIDO.** Sólo se agregan el script del ensayo (`6b6e272`) y documentación; no se toca código de producto ni migraciones. | §3; `git show --stat 6b6e272` |
| 2 | "Run three internal rehearsals of the role workflows (PyME, admin, investor) across the template screens, record and triage defects, freeze the synthetic dataset, and package truthful backup video, AI JSON, decoded XDR, hashes, screenshots, and explorer links." | ⚠️ **PARCIAL.** Tres ensayos ✅ (API); pantallas ⚠️; hashes ✅ y enlaces de explorador ✅; **video ❌, capturas ❌, XDR ❌, JSON de IA ⚠️**; dataset "congelado" ⚠️; triaje de defectos ⚠️ (sin defectos de producto; los del e2e fueron de entorno). Detalle y pasos del operador en §8. | §4, §6, §8 |
| 3 | "Failure paths remain truthful and do not weaken security, simulation, or human-control boundaries." | ✅ **CUMPLIDO.** El ensayo nunca fabrica éxito: falla con el paso y el cuerpo saneado; no imprime secretos; la decisión la toma el admin (control humano); Testnet/simulación se preservan (documentos sintéticos rotulados, sin valor económico). | §3, §4 |

### Task #105 — pruebas

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Deterministic tests or bounded rehearsal checks demonstrate the core behavior of Feature #33." | ✅ **CUMPLIDO.** El ensayo hosteado es un *bounded rehearsal check* (polling y fallbacks acotados) y se corrió 3× en verde contra el stack real; el e2e U9 es la verificación de pantallas opt-in. | §3, §4, §6.4 |
| 2 | "Validation, rejection, and fallback behavior is covered where applicable." | ⚠️ **PARCIAL.** El ensayo registra la salida asesora (`complete:false`) sin bloquear y sus fallbacks de assessment/deploy están cableados, pero **no se ejercitó un rechazo ni un fallback real** en estos runs. La validación/rechazo de producto (p.ej. `422 investor_limit_exceeded`) la cubre el e2e U9 en su historial (E–K), no este ensayo. | §4, §6.4, §8 |
| 3 | "The focused verification passes without exposing sensitive data." | ⚠️ **PARCIAL.** El ensayo hosteado pasa 3× sin exponer datos sensibles ✅. Pero la otra verificación focal (el e2e local) **no pasó** en esta sesión por un stack local degradado (§6.2) — no es gate de PR ni CI, y su historial verde se cita. | §4, §6 |

### Task #106 — evidencia

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Evidence identifies Feature #33, verification commands or rehearsal steps, and observed results." | ✅ **CUMPLIDO.** Este documento identifica la Feature y sus Tasks, cita el comando del ensayo (§3.1), el del preflight (§5) y el del e2e (§6), y lista los resultados observados (§4–§6). | §1, §3, §4–§6 |
| 2 | "Evidence is traceable to implementation and focused verification." | ✅ **CUMPLIDO.** Cada resultado nombra su fuente (re-ejecutado vs registrado); el script se ubica en `scripts/demo/rehearsal/hosted-rehearsal.mjs` (commit `6b6e272`); la bitácora es [[odd/tasks/demo-rehearsal-and-evidence]]. | §2–§6; bitácora |
| 3 | "Sensitive data and unsupported production claims are excluded." | ✅ **CUMPLIDO.** Sin secretos, PII, claves secretas ni XDR; sin claims de producción (§2). | §2, §10 |

## 10. Límites, riesgos y contradicciones

- **El paquete no está completo.** Faltan video, capturas, XDR decodificado y JSON de IA (§8). Este documento **no** los declara hechos.
- **"Across the template screens" parcial.** El ensayo primario es a nivel API; la verificación de pantallas es el e2e U9, que no se re-observó verde esta sesión.
- **Stack local degradado (entorno).** La API del perfil docker acumula timeouts de Supabase Auth (`[SupabaseAuth] … timeout`), una lectura devuelve `503 unavailable` y `supabase_pg_meta_vaqcrow` está `unhealthy`; el e2e U9 no puede pasar en este estado. Repararlo (reiniciar el stack) excede la superficie de esta unidad y no se hizo. Es un defecto de entorno, no de producto ni del spec.
- **Opción A.** Cada ensayo crea registros frescos; el remoto acumula filas por corrida y **nada se resetea**.
- **Sin verificación de merge.** La Feature #33 **no está en `main`**; no hay PR en esta unidad. El cierre de las Tasks lo decide el owner.
- **`.env.cloud` no versionado.** El archivo es ignorado por git; la corrección (§7) es de perfil local y no afecta a la API desplegada.

## 11. Próximos pasos (#34)

- Este cambio es: los dos documentos de evidencia de esta unidad. No hay PR ni merge (los ejecuta el padre).
- La Feature #33 queda **abierta**; su cierre y el de #104/#105/#106 lo decide el owner.

> [!todo] Condiciones antes de cerrar la Feature #33
> 1. Producir el paquete de respaldo que falta (§8): video, capturas, JSON de IA y (si el owner lo decide) XDR decodificado.
> 2. Re-ejecutar el e2e U9 en un stack local sano y adjuntar su salida (hoy bloqueado por entorno, §6.2).
> 3. Decidir si el ensayo "across the template screens" se satisface con el e2e U9 o se agrega un recorrido de pantallas dedicado.
> 4. Revisar el criterio "failure behavior" de #33/#105 una vez ejercitado un camino de fallo real.
