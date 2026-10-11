# Bitácora — Ensayo de la demo y empaquetado de evidencia (Feature #33)

> Rama: `Vaqcrow#33_Feat_Rehearse_the_demo_and_package_evidence`, creada desde `main` `534f295`.
> Evidencia de cierre: [[docs/planning/demo-rehearsal-and-evidence-packaging-evidence|Evidencia de cierre de la Feature #33]].
> Unidad: sólo demo/documentación. **No se tocó código de producto** ni el script del ensayo.

## Qué se corrió (2026-10-11)

### 1. Ensayo hosteado — tres corridas

Script: `scripts/demo/rehearsal/hosted-rehearsal.mjs` (commit `6b6e272`). Recorrido a nivel API, sin navegador, contra la API de Railway, el Supabase remoto y Stellar Testnet. Option A (registros frescos por corrida; nada se resetea).

Comando que funcionó (desde `apps/api`; el perfil cloud se carga sólo por `--env-file`, nunca se lee ni se imprime):

```bash
node --env-file=../../.env.cloud ../../scripts/demo/rehearsal/hosted-rehearsal.mjs
```

> [!info] Nota de comando
> La forma `pnpm --filter @vaqcrow/api exec …` corrió con cwd en la raíz del repo y falló con `node: ../../.env.cloud: not found`. La forma desde `apps/api` (arriba) es la que funcionó.

FACTS públicos de las tres corridas (todas **verde**):

| # | runId | applicationId | campaignId | contractAddress | contributionTxHash | status | Fuente |
|---|---|---|---|---|---|---|---|
| 1 | `d16c3808` | — | — | — | — | — | reportado por el padre (FACTS no persistidos) |
| 2 | `f03640cf` | `d377c4c9-c923-4998-8226-0723c3c90be9` | `cfd44430-e7bf-4701-919c-ef3ce1ab12c4` | `CBIFVYSC6ILDBSPGVGFFKA7XXJBMJI5XSGD6BAZGMQBUHUZRJXPZQORO` | `5b2ec2f9ae76379ff3562fcbcdf362208ece20c45c395d4656f7e153ff739ca3` | `success` | re-ejecutado |
| 3 | `55f080b2` | `8f41722f-b839-473a-8e66-f38741360ec6` | `20b3f80b-77c0-49e8-a956-1e45e755e8a5` | `CB6RXGUQS4AQH2EGO2YV77JHD6ATSZRGGADMESN6LLC2TK3ACQK767VR` | `387f5646a7d877213d8021fbfe872405f24c6b04631c8dd1bba141735e688e2a` | `success` | re-ejecutado |

En las dos re-ejecutadas: decisión admin `approved` aplicada, despliegue `confirmed` (intento 1), campaña `funding`, `goalStroops 150000000000`, aporte de `15000000000` (el tope `goal/10`) observado `success`, y `completeness.complete:false` (esperado: documentos sintéticos; asesor, nunca bloquea). La corrida 1 se cita como reportada por el padre (sus FACTS no se conservaron).

Enlaces de explorador (construibles desde los hashes/contrato; la ruta sirve 200, ver el límite en la evidencia):

- `https://stellar.expert/explorer/testnet/tx/<hash>`
- `https://stellar.expert/explorer/testnet/contract/<C…>`

### 2. Preflight del perfil cloud

```bash
pnpm demo:preflight --env-file .env.cloud
```

Todo verde salvo **los dos chequeos de saldo de cuentas demo** (SME e inversor), que requieren cuentas del operador (`--sme` / `--investor`). No es defecto: el ensayo crea sus propias cuentas. Confirma la fábrica con tope `CCDN…SV7J` y la cuenta de plataforma fondeada.

### 3. Ensayo en vivo local (e2e U9) — **no se pudo observar en verde**

`pnpm --filter @vaqcrow/web run test:e2e:live` (Playwright, `apps/web/e2e-live/admin-review.live.spec.ts`). Cuatro intentos, **todos fallaron por el estado del stack local**, no por el spec ni por el código:

| Intento | runId | Paso | Error |
|---|---|---|---|
| 1 | `b83993e0` | 2 (subida) | el nombre del PDF no aparece; API: `PGRST000 … recovery mode`, `[SupabaseAuth] … timeout`; Postgres re-inicializado `20:57:56Z` |
| 2 | `a52d14a4` | 2 (wallet) | el panel queda en `Conectando…`; API: `[SupabaseAuth] … timeout` |
| 3 | `48b2f4d5` | 2 (subida) | misma aserción que el intento 1 |
| 4 | `26eb639b` | 0 (tasa) | `GET /admin/rates/current` → `503 {"code":"unavailable"}` |

Entorno: API del perfil docker con timeouts de Supabase Auth, `supabase_pg_meta_vaqcrow` `unhealthy`. No se reinició el stack (fuera de la superficie de esta unidad). Historial verde del mismo spec: **Corridas E–K** en [[odd/tasks/application-review-and-vault-deployment|application-review-and-vault-deployment]] y el primer aporte por UI de PR #473 (commit `6ea5549`).

### 4. Corrección del perfil `.env.cloud` (higiene local)

`APP_ENV=local` + RPC a `localhost` → `APP_ENV=demo` + RPC canónico de Testnet + `NEXT_PUBLIC_API_BASE_URL`. El archivo es ignorado por git (`.gitignore:36`) y **la API desplegada nunca lo lee**; sólo afecta a las herramientas que lo cargan desde la máquina del operador. Verificado por el preflight (defaults canónicos de Testnet; `NEXT_PUBLIC_API_BASE_URL` presente).

## Brechas honestas (frente a #104)

- ✅ Tres ensayos por rol (a nivel API), hashes, enlaces de explorador construibles.
- ⚠️ "Across the template screens": el ensayo primario no usa navegador; el e2e de pantallas no se re-observó verde.
- ❌ Video de respaldo, capturas de pantalla y XDR decodificado: **no producidos**.
- ⚠️ JSON de IA: sólo los *findings* del chequeo de completitud; el JSON de evaluación no se archivó.
- ⚠️ Dataset sintético "congelado": el ensayo lo genera en proceso, sin artefacto aparte.

## Próximo paso

- #34 (congelar build y presentación) tras cerrar #33.
- Completar el paquete (§8 de la evidencia) y re-ejecutar el e2e U9 en un stack local sano.
