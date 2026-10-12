# Bitácora: paquete de evidencia del TFM (#33)

Cierra brechas del **paquete de respaldo** que la evidencia de #33 dejó como pasos del operador (`docs/planning/demo-rehearsal-and-evidence-packaging-evidence.md` §8).

## Brechas de §8 y su estado

| Brecha | Estado en esta unidad | Nota |
|---|---|---|
| XDR decodificado (artefacto) | ✅ **Producido** | `docs/presentation/evidence/*.json` para los 2 aportes confirmados |
| JSON de evaluación de IA | ✅ **Producido** | `ai-assessment-run2/3-*.json`, leído read-only del Supabase remoto (autorización del owner) |
| Capturas de pantalla del template | ⏳ Pendiente | Requiere navegador + stack sano (el docker local está degradado) |
| Video de respaldo | ⏳ Guion entregado; grabación = operador | `docs/presentation/video-script.md` |

## WU1 — XDR decodificado

- **Script:** `scripts/demo/rehearsal/decode-testnet-tx.mjs` — toma un hash, lee Horizon Testnet (GET público, sin claves) y decodifica con `@stellar/stellar-sdk`; ancla `createRequire` a `apps/api/package.json` (mismo patrón que `hosted-rehearsal.mjs`).
- **Artefactos:** `docs/presentation/evidence/contribution-run2-f03640cf.json`, `contribution-run3-55f080b2.json`.
- **Qué muestra:** `vault.contribute(inversor, 15000000000)` con sub-invocación atómica `SAC.transfer(inversor → vault, 15000000000)`; firma del inversor (`source_account`), nunca de la plataforma.
- **Verificado:** decodificación de los dos hashes de #33 §4 (`5b2ec2f9…`, `387f5646…`); run2 `GACFFP46…`→`CBIFVYSC…`, run3 `GCQPC6A7…`→`CB6RXGUQS…` (coincide con §4).

## Verificación

- Readback y sanity-check de los dos JSON (hash, ledger, `successful`, `function_name=contribute`, `i128=15000000000`).
- Read-only: solo un `GET` a Horizon público; sin secretos, sin escritura remota, sin migraciones.

## WU2 — JSON de evaluación de IA

- **Artefactos:** `docs/presentation/evidence/ai-assessment-run2-f03640cf.json`, `ai-assessment-run3-55f080b2.json`.
- **Fuente:** fila de `public.application_assessment` del Supabase remoto (read-only, con autorización del owner). Los `applicationId` salen de #33 §4.
- **Qué muestra:** `riskBand: medium`, `confidence` 0.6/0.55, `recommendedAction: human_review`, evidencia citada por afirmación, anomalías y faltantes, y **`SIMULADO` detectado por la propia IA**; `metadata`: `glm-5.3-flash`, `assessment-v1`. La IA **no aprueba**; la decisión la tomó el humano.
- **Verificado:** los dos JSON parsean y son fieles a la fila leída (band/confidence/action/model y los tres `claim` por run).

## WU3 — Guion del video

- **Artefacto:** `docs/presentation/video-script.md` — shot list de 9 escenas por rol, checklist previo, reglas de honestidad y qué resaltar en cada escena.
- **Alcance:** es el **plan** de grabación; el video lo graba el operador (no lo produce la máquina).

## Notas

- Ubicación: `docs/presentation/evidence/` (junto al deck, que consume esta evidencia).
- Pendientes que siguen sin declararse hechos: las **capturas** (navegador + stack sano) y la **grabación** del video.
