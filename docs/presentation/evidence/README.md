# Paquete de evidencia — XDR decodificado (#33)

Artefactos de respaldo del ensayo hosteado de #33. Cierran la brecha **«XDR decodificado (artefacto)»** que la evidencia de #33 §8 deja como pendiente del operador.

- **Qué son:** el *envelope* decodificado de las dos transacciones de aporte confirmadas en Stellar Testnet durante el ensayo hosteado (`scripts/demo/rehearsal/hosted-rehearsal.mjs`).
- **Fuente:** Horizon Testnet (GET público), sin claves, sin secretos y sin escritura remota.
- **Artefactos:** `contribution-run2-f03640cf.json`, `contribution-run3-55f080b2.json`.

## Qué prueba cada artefacto

Cada JSON decodifica la tx firmada por el inversor y muestra, sin ambigüedad, el camino **no custodial**:

```
invoke_contract  vault.contribute(inversor, 15000000000)
  └─ auth: source_account
       └─ SAC.transfer(inversor → vault, 15000000000)   ← custodia en el contrato, atómico
```

- `contribute` es la invocación de la bóveda de campaña; los `15 000 000 000` stroops son `goal/10` (el tope por inversor).
- La sub-invocación `transfer` es el **SAC de XLM** moviendo los fondos del inversor **a la bóveda**, no a Vaqcrow.
- La firma es `source_account`: la del inversor. La plataforma **no** firma aportes.

| Run | runId | Inversor (source) | Bóveda (contrato) | Monto (stroops) | Ledger | Tx |
|---|---|---|---|---|---|---|
| 2 | `f03640cf` | `GACFFP46…GK5E` | `CBIFVYSC…QORO` | `15000000000` | 5145687 | [`5b2ec2f9…73ca3`](https://stellar.expert/explorer/testnet/tx/5b2ec2f9ae76379ff3562fcbcdf362208ece20c45c395d4656f7e153ff739ca3) |
| 3 | `55f080b2` | `GCQPC6A7…MCOY` | `CB6RXGUQ…767VR` | `15000000000` | 5145702 | [`387f5646…e688e2a`](https://stellar.expert/explorer/testnet/tx/387f5646a7d877213d8021fbfe872405f24c6b04631c8dd1bba141735e688e2a) |

Cada artefacto lleva su `ledger` y `created_at` exactos.

## JSON de evaluación de IA

El assessment **real** que produjo la IA (proveedor tras un adaptador) para cada aplicación del ensayo, tal como quedó persistido y pasó a **revisión humana**. Cierra la brecha **«JSON de IA (artefacto de evaluación)»** de #33 §8.

- **Artefactos:** `ai-assessment-run2-f03640cf.json`, `ai-assessment-run3-55f080b2.json`.
- **Origen:** fila de `public.application_assessment` del proyecto Supabase remoto (una por aplicación, inmutable).

| Run | `riskBand` | `confidence` | `recommendedAction` | `assessmentId` |
|---|---|---|---|---|
| 2 (`f03640cf`) | `medium` | `0.6` | `human_review` | `asm_7f3c9a2e` |
| 3 (`55f080b2`) | `medium` | `0.55` | `human_review` | `asm_sales_2026_01_08` |

**Qué prueba.** La IA **no aprueba**: recomienda `human_review`, cita evidencia por afirmación (`evidenceRefs`), marca anomalías y faltantes, expresa **incertidumbre** (`confidence` 0.55–0.6) y **detecta que los datos son simulados** («All evidence is labeled SIMULADO…»). El `metadata` deja la trazabilidad: modelo `glm-5.3-flash`, `promptVersion: assessment-v1`, `generatedAt`. La decisión final la tomó un humano (§4 de #33: `{applied: true, outcome: approved}`).

## Regenerar

### XDR decodificado

Script reproducible (no necesita claves; lee de Horizon público):

```bash
# desde la raíz del repo
node scripts/demo/rehearsal/decode-testnet-tx.mjs <txHash> docs/presentation/evidence/<nombre>.json
```

El script vive fuera de los workspaces, así que ancla un `createRequire` a `apps/api/package.json` (mismo patrón que el ensayo) para resolver `@stellar/stellar-sdk`. Imprime/guarda el `envelope_xdr`, el `source`, el `fee`, las operaciones y el árbol de `auth`.

### JSON de evaluación de IA

Lectura **read-only** del proyecto Supabase remoto (requiere autorización del owner; no escribe ni migra):

```sql
select application_id, attempt_id, correlation_id, created_at, assessment, metadata
from public.application_assessment
where application_id in (
  'd377c4c9-c923-4998-8226-0723c3c90be9',  -- run 2 / f03640cf
  '8f41722f-b839-473a-8e66-f38741360ec6'   -- run 3 / 55f080b2
);
```

Los `applicationId` salen de #33 §4; el artefacto es la fila completa (assessment + metadata), sin secretos (la tabla no guarda prompts crudos, salida cruda del proveedor ni credenciales).

## Límites honestos

- **Testnet, sin valor económico.** Un hash de Testnet prueba ejecución técnica, no una inversión real ni disponibilidad en producción.
- **Prueba la forma de la llamada on-chain**, no la validez del negocio ni la relevancia de los documentos (que el ensayo marca sintéticos a propósito).
- Las **capturas** y el **video** siguen pendientes (#33 §8); este paquete cierra las brechas del XDR decodificado y del JSON de IA.
