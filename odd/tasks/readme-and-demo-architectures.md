# README y arquitecturas de la demo — local (docker) y producción (nube)

## Objetivo

Que el README deje de describir un proyecto que ya no es el actual, y que existan **dos arquitecturas dibujadas**: la local en modo desarrollo con Docker y la de producción en la nube. Más la verificación de los diagramas que ya existen.

## Por qué

El README tiene afirmaciones que el trabajo de las últimas dos semanas invalidó, y varios diagramas del repo siguen mostrando el camino de fondeo **superseded** (intención XDR) o destinos **TBD** que ya están decididos y desplegados.

## Hechos verificados (usar estos; no re-derivar)

### Lo que existe hoy en el repositorio

- `apps/web` (Next.js 16, App Router), `apps/api` (Fastify + Node), `packages/domain`, `packages/contracts`, **`packages/ai`** (existe; el README lo lista como futuro), `contracts/` (workspace Rust con `campaign-vault` y `campaign-factory`), `supabase/` (config + migraciones, no una sola).
- **NO existen**: `apps/worker`, `packages/stellar`, `packages/simulators`, `packages/db`, `packages/config`, `packages/testing`, `packages/ui`. El README los lista como previstos; está bien mantenerlos como previstos, pero sin implicar que existen.

### Perfil local (docker) — lo que corre

| Pieza | Dónde | Puerto |
|---|---|---|
| Supabase local (CLI) | contenedores Docker | `54321` |
| API | contenedor desde `apps/api/Dockerfile` vía `docker-compose.local.yml` | `3000` |
| Stellar Quickstart | contenedor Docker (opcional, para contratos y para el recorrido local de la bóveda) | `8000` |
| Web | `next dev` en el host | `3001` |

- `pnpm env:docker:up` levanta Supabase + Quickstart + la API; `pnpm env:docker:status` informa sin imprimir claves.
- El recorrido completo de la bóveda corre contra Quickstart de forma **opt-in**: `pnpm env:docker:bootstrap` → `./scripts/env/generate-docker-env.sh --force` → `pnpm env:docker:up`. La clave de plataforma vive en el keystore como `vaqcrow-platform` y **no sirve para Testnet**.
- `pnpm run test:db` (pgTAP) y `pnpm --filter @vaqcrow/api test:integration` usan este perfil por defecto.

### Perfil de producción (nube) — lo que corre

| Pieza | Dónde | Dominio |
|---|---|---|
| Web | **Vercel** (`vaqcrow-web`), producción desde `main` | `https://vaqcrow-web-nine.vercel.app` |
| API | **Railway** (`vaqcrow-api`, servicio `api`, región us-west2, desde `main`) | `https://api-production-c07f.up.railway.app` |
| Base de datos | **Supabase remoto** (proyecto de la demo) | — |
| Cadena | **Stellar Testnet**: Soroban RPC para la bóveda, Horizon para cuentas y pagos clásicos | — |
| IA | Proveedor **`opencode-go`** (ya elegido; el README dice "por definir") | — |

- Fábrica de bóvedas en Testnet: `CDVSSQ55LBBYHAK5DNQG2UNPIG3PMPJELKJ7LKSNOBAIHAEHPMX75GXJ`. Owner = cuenta de plataforma.
- `NEXT_PUBLIC_API_BASE_URL` se hornea en el bundle web en build time.
- Producción **sí existe y está viva**. El README dice "No existen despliegues productivos actualmente".
- `apps/worker` sigue sin existir: las confirmaciones asíncronas viven en la API.

### El camino de fondeo cambió (clave para los diagramas)

- El fondeo **ya no** es una intención XDR que la API autora y verifica. **La custodia es del contrato Soroban**: una bóveda por campaña, liquidación atómica al alcanzar el objetivo y reembolso permissionless al vencer.
- El camino XDR de `#24` fue **superseded** por `#239`; sigue cerrado como historia entregada, pero **no es el camino del demo**.
- **Quién firma qué**: la persona usuaria firma con Freighter la invocación del contrato (aporte, retiro, reembolso) — su clave nunca sale del navegador. La **plataforma** firma `factory.deploy()` y el `CreateAccount` de la PyME con `STELLAR_PLATFORM_SECRET_KEY`, y su único punto de uso es `platform-signer.ts`.
- Supabase es **espejo** de la cadena, que es la fuente de verdad del dinero.
- La evaluación de IA **es real** (proveedor `opencode-go`) detrás de un adaptador; el README dice "fixture consultivo simulado".

## Entregables

### E1 — README: actualizar y agregar las dos arquitecturas

Corregir en `README.md`:

- **`## Estado actual`** (líneas ~13–16): reflejar que la evaluación de IA es real, que Stellar/Freighter y la **custodia por contrato** están implementados, que existe `packages/ai`, que las migraciones de Supabase son varias, y corregir los conteos de tests (hoy son muchos más que 75 archivos; usar un número verificable o quitar el número si no se puede verificar). **No inventar métricas**: si no se puede verificar un conteo, describir sin número.
- **`## Qué demuestra la demo`** (líneas ~31–33): los pasos 4 a 6 describen la intención XDR y la confirmación por Horizon como camino de fondeo. Reescribirlos con la **bóveda**: el inversor aporta firmando la invocación, la bóveda custodia, el contrato liquida al alcanzar el objetivo o reembolsa al vencer, y la distribución de revenue share sigue por el camino clásico.
- **`## Real versus simulado`** (línea ~44): "evaluación de riesgo por IA — fixture consultivo simulado" → real con adaptador reemplazable.
- **`## Decisión de arquitectura`** (líneas ~74, ~83): `packages/ai` pasa de "previsto" a implementado; `supabase/` no es "config + 1 migración".
- **`## Stack previsto para la demo`** (línea ~94): el proveedor LLM ya no es "por definir".
- **`## Despliegue propuesto`** (líneas ~100–106): web en Vercel **desplegado**, API en Railway **desplegada**, y borrar/enmendar "No existen despliegues productivos actualmente". Mantener el matiz de que es una demo en Testnet, no producción real.
- **`## Próximo paso`** (línea ~219): está muy desactualizado (habla de `#44`, que hace rato se cerró, y de conteos de 35/1/72). Reescribirlo con el estado real: el grueso que falta son los Días 9–14 del plan (ventas, cálculo, distribución Testnet, integración vertical, resiliencia, ensayo y freeze). Verificar los conteos del tablero antes de escribir cualquier número, o describir sin números.

Agregar una sección nueva, después de `## Decisión de arquitectura`, con **las dos arquitecturas dibujadas**:

- **`### Arquitectura local (perfil docker)`** — diagrama Mermaid `graph TB` con: contenedores Docker (Supabase local :54321, Quickstart :8000, API :3000 construida desde `apps/api/Dockerfile`), el proceso `next dev` en el host (:3001), el navegador con Freighter, y el keystore de la Stellar CLI con la identidad `vaqcrow-platform`. Dejar claro qué es contenedor y qué es host.
- **`### Arquitectura de producción (nube)`** — diagrama Mermaid `graph TB` con: navegador + Freighter → Vercel (build estático + cliente con la base URL horneada) → API en Railway → Supabase remoto, Stellar Testnet (Soroban RPC para la bóveda, Horizon para cuentas y pagos), y el proveedor LLM. Marcar la **firma de la persona usuaria** vs la **firma de la plataforma** como flechas distintas.

Ambos diagramas en un bloque ` ```mermaid `, `graph TB`, `subgraph` con etiquetas en español, siguiendo el estilo ya usado en `docs/architecture/deploy-planning.md`. Sólo componentes reales — la lista de arriba es el universo permitido.

**No duplicar**: el diagrama de `docs/architecture/cloud-demo-architecture.md` es la vista de **flujo y firma**; el del README es la vista de **despliegue** (qué corre dónde). Enlazar al doc de arquitectura para el detalle. Decir en una línea por qué son dos vistas distintas.

### E2 — Corregir los diagramas desactualizados

| Archivo | Qué está mal | Qué hacer |
|---|---|---|
| `docs/planning/DEMO.md` (topología, `flowchart LR`) | `Destino web TBD`, `Destino API TBD`, `Destino de jobs TBD`; y el fondeo figurado como "XDR firmado" contra la API | Reemplazar los TBD por **Vercel** y **Railway** (y el worker sigue opcional/sin desplegar); ajustar el fondeo al camino de la bóveda. **Edición quirúrgica**: es un documento de plan, no reescribir su intención. |
| `docs/architecture/deploy-planning.md` (componentes) | `LLM["Proveedor LLM (TBD)"]`; y sólo "Stellar Testnet Horizon" | Proveedor real; agregar **Soroban RPC** y la **fábrica/bóveda**. No tocar sus otros dos diagramas (capas de testing, flujo de promotion) salvo que estén factualmente mal. |
| `docs/design/demo-ui.md` | "Revisar intención y XDR" y "Verificación XDR rechazada" | Reencuadrar al camino de la bóveda. **Verificar primero** el contexto de esas líneas (pueden referirse a un flujo de UI que sigue existiendo); si hay duda, dejar constancia en vez de forzar el cambio. |
| `docs/planning/product.md` (§7.4, secuencia) | La secuencia describe XDR + passthrough por la API | Es el plan del **producto real**, no de la demo. **No reescribir** su intención; si describe la demo, corregir, y si describe el producto, dejar y decirlo. |

### E3 — Reportar

Al final, una línea por diagrama del repo diciendo: **actualizado**, **correcto tal como está**, o **dejado a propósito** y por qué.

## Restricciones

- **No inventar métricas, conteos ni componentes.** Si un número no se puede verificar con un comando, no va.
- **No transcribir secretos**: sólo nombres de clave. Direcciones de contrato y claves **públicas** sí.
- **No leer ni tocar `.env.cloud` / `.env.docker`** (regla de permisos; usar los `.example`).
- Mantener el tono del README: español, directo, sin prosa promocional, y **sin afirmar producción real** — es una demo en Testnet con identidad, KYC y ventas simulados.
- Obsidian: callouts y wikilinks donde el archivo ya los use.
- No tocar `opencode.json` (está modificado en el árbol y no es parte de esto).

## Verificación

- Todos los bloques ` ```mermaid ` de cada archivo tocado quedan balanceados (una apertura, un cierre).
- `rg -n "TBD|por definir"` sobre los diagramas tocados: sólo debería quedar lo que sea genuinamente futuro.
- `rg -c '\bS[A-Z2-7]{55}\b'` sobre los archivos tocados devuelve 0.
- `pnpm run test:boundaries` y `pnpm run lint` — reportar el resultado observado. Si son cache hit, decirlo.
- `git status --short` no lista `.env.cloud` ni `.env.docker`.
- Reportar lo que no se pudo verificar.

## Estado

- [ ] E1, E2, E3 pendientes.
- [x] Relevamiento: hechos verificados arriba, incluido el escaneo de marcadores de obsolescencia en los diagramas.
