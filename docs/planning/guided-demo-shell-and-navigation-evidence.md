# Evidencia de cierre de la Feature #16 — Issue #52

> Documento de cierre de Feature. No implementa ni re-deriva evidencia nueva: consolida y cita la evidencia ya verificada de los issues [#50](https://github.com/reyduar/Vaqcrow/issues/50) y [#51](https://github.com/reyduar/Vaqcrow/issues/51), y agrega únicamente lo que ninguno de los dos documenta (límites operativos vigentes, el encuadre futuro del resultado visible en la demo y el mapeo contra los tres criterios de aceptación propios del #52). No reemplaza a las observaciones de Engram `sdd/build-guided-demo-shell-and-navigation/verify-report` (obs #379) ni `sdd/test-guided-demo-shell-and-navigation/verify-report` (obs #391); ambas siguen siendo la fuente de verdad de lo que cada Task probó.

## 1. Contexto y objetivo

El issue [#52](https://github.com/reyduar/Vaqcrow/issues/52) ("Document evidence build guided demo shell and navigation") es la tercera y última Task de la Feature [#16](https://github.com/reyduar/Vaqcrow/issues/16) ("Build guided demo shell and navigation"), que a su vez implementa el slice 1 `demo-shell` de `DEMO.md` §13 y la salida verificable del Día 2 del plan de catorce días (§8: "Shell de demo y estados — Navegación completa con fixtures y banners"). Las otras dos Tasks ya están completas y mergeadas: [#50](https://github.com/reyduar/Vaqcrow/issues/50) implementó el shell guiado de seis rutas en 4 PRs encadenadas ([#128](https://github.com/reyduar/Vaqcrow/pull/128), [#129](https://github.com/reyduar/Vaqcrow/pull/129), [#130](https://github.com/reyduar/Vaqcrow/pull/130), [#131](https://github.com/reyduar/Vaqcrow/pull/131)); [#51](https://github.com/reyduar/Vaqcrow/issues/51) cerró la superficie de testing con traversal real y recuperación real del error boundary en 1 PR ([#132](https://github.com/reyduar/Vaqcrow/pull/132), commit `2798777`).

El objetivo de este documento es dar a un revisor un único punto de entrada que confirme el cierre de la Feature #16: qué quedó implementado, qué quedó probado, qué límites operativos siguen vigentes hoy y qué resultado, todavía futuro, respaldará esta evidencia en la demo. Es un cambio **solo de documentación**: cero diff de código de producción, cero reescritura de tests.

## 2. Cómo leer esta evidencia

- **Regla de citación.** Las secciones 3 y 4 **citan, nunca re-derivan**: cada cifra lleva su cita `obs #379` u `obs #391` en la misma viñeta o fila de tabla, nunca en un encabezado general — por ejemplo "18/18 tareas completas (obs #379)". Ningún número de esas secciones se volvió a calcular para este documento.
- **Autoría nueva.** Las secciones 5, 6, 8, 9 y la subsección 4.1 son autoría de este documento: ninguna de las dos evidencias previas enumera los límites operativos vigentes como un conjunto, encuadra el resultado como futuro, corre un gate de regresión fechado ni mapea los tres criterios de aceptación propios del #52.
- **Formato.** Los comandos aparecen en bloques ```sh``` con `$ <comando>` seguido de su salida real.
- **Reproducción local, no CI.** Este repositorio no tiene `.github/workflows/`; toda la evidencia citada aquí y en sus fuentes es reproducción local bajo `nvm use v24.21.0` (el `package.json` raíz exige `engines: ">=24.0.0 <25.0.0"`).

## 3. Qué quedó implementado

Citado de `sdd/build-guided-demo-shell-and-navigation/verify-report` (obs #379), sin re-derivar:

- El shell guiado expone seis rutas bajo `apps/web/src/app/(demo)/` (`request → ai-assessment → approval → funding → distribution → evidence`), una página por paso más `layout.tsx`, `loading.tsx` y `error.tsx` compartidos (obs #379).
- La navegación entre pasos se deriva de un array congelado `demo-steps.ts` de solo funciones puras, sin `useState` en el camino de identidad del paso (obs #379).
- La ruta raíz (`app/page.tsx`) ejecuta `redirect("/request")`, y `WorkspaceStatus` se reubicó dentro del paso `funding` como probe de scaffold (obs #379).
- Auditoría de imports: cero imports de `@vaqcrow/domain` o `@vaqcrow/contracts` en toda la superficie nueva (obs #379).
- 18/18 tareas completas y 10/10 escenarios del spec cubiertos por tests que pasan, confirmados por inspección directa de archivos, no por confianza en los checkmarks (obs #379).
- `pnpm --filter @vaqcrow/web test`: 22 archivos / 57 tests, `exit 0` (obs #379).
- `next build`: las 6 rutas de demo más `/` quedaron prerenderizadas estáticamente (obs #379).
- `depcruise apps/*/src packages/*/src`: "no dependency violations found (87 modules, 131 dependencies cruised)" (obs #379).

## 4. Qué quedó probado

Citado de `sdd/test-guided-demo-shell-and-navigation/verify-report` (obs #391), con los conteos de la era #50 citados de obs #379 donde se indica:

- Los 10 escenarios del spec del #50 (6 requisitos) están cubiertos por tests que pasan (obs #379), y los 5 escenarios del spec del #51 (2 requisitos) también (obs #391); ningún conteo de esta sección se volvió a derivar para este documento.
- La suite web pasa 24 archivos / 62 tests con `exit 0`, incluidos los 3 tests de `layout.traversal.test.tsx` (traversal real hacia adelante y atrás) y los 2 de `error.recovery.test.tsx` (recuperación real del error boundary, no solo invocación del callback) (obs #391).
- 21/21 tareas completas, cero dependencia nueva y cero cambio de archivo de producción (obs #391).

| Comando | Resultado observado | Fuente |
|---|---|---|
| `pnpm --filter @vaqcrow/web test` | exit 0 — 24 archivos / 62 tests | obs #391 |
| `pnpm --filter @vaqcrow/web lint` | exit 0 — 0 errores, 3 warnings preexistentes ajenos (`fetch-http-client.ts`, `freighter-wallet.ts`) | obs #391 |
| `pnpm --filter @vaqcrow/web exec tsc --noEmit` | exit 0 — sin salida | obs #391 |
| `pnpm run verify` (raíz) | exit 0 — depcruise 92 módulos / 150 dependencias, 0 violaciones; vitest raíz 23/23 | obs #391 |
| `next build` (dentro de `verify`) | 6 rutas demo + `/` prerenderizadas estáticamente | obs #379 |

### 4.1 Gate de regresión de este cambio (no es evidencia nueva)

```sh
$ nvm use v24.21.0
$ git rev-parse --short HEAD
28a1257
$ pnpm run verify
...
@vaqcrow/web:test:  Test Files  24 passed (24)
@vaqcrow/web:test:       Tests  62 passed (62)
...
@vaqcrow/web:build: ✓ Generating static pages using 7 workers (9/9) in 96ms
...
$ depcruise apps/*/src packages/*/src --config .dependency-cruiser.cjs
✔ no dependency violations found (92 modules, 150 dependencies cruised)
$ vitest run
 Test Files  2 passed (2)
      Tests  23 passed (23)
```

Verificado el 2026-09-17 sobre el commit `28a1257` de la rama de este cambio: `pnpm run verify` → **exit 0**. Esta corrida es un **gate de regresión** de un cambio solo de documentación, no una fuente de evidencia nueva; los conteos de la sección 4 siguen siendo los citados de obs #379 y obs #391.

## 5. Límites operativos vigentes

1. **Solo shell y navegación, no el slice 1 completo.** Este documento cubre exclusivamente la porción de estructura y navegación de `DEMO.md` §13 slice 1 `demo-shell`, no la barra completa de ese slice ("Caso sintético, estados y rotulado de simulaciones" → "Journey navegable y fixture congelado"). Hoy no existen fixtures ni etiquetas `SIMULADO`: cada paso renderiza únicamente `StepPlaceholder` ("Step content coming soon..."). Ese trabajo queda diferido a [#17](https://github.com/reyduar/Vaqcrow/issues/17), [#18](https://github.com/reyduar/Vaqcrow/issues/18) y [#19](https://github.com/reyduar/Vaqcrow/issues/19), todos en `Backlog`.
2. **Sin Stellar, sin IA, sin persistencia en esta superficie.** El shell no invoca Freighter, evaluación de IA ni ningún adaptador de Supabase; solo estructura de navegación.
3. **`error.recovery.test.tsx` prueba el contrato de React, no el wiring del App Router.** El propio archivo documenta (líneas 1-10) que la suite prueba el contrato de error boundary de React en aislamiento, no la integración de segmento de ruta de Next.js.
4. **Reproducción exige Node fijado.** El `package.json` raíz exige `engines: ">=24.0.0 <25.0.0"`; toda la evidencia citada se reprodujo bajo `nvm use v24.21.0`.

## 6. Resultado visible en la demo

Ningún enunciado de esta sección afirma que la demo ya se pueda ver o usar hoy. Lo que existe — seis rutas navegables con estructura y navegación probadas (secciones 3 y 4) — es la base sobre la que se apoyarán pasos futuros de la demo:

- Cuando [#17](https://github.com/reyduar/Vaqcrow/issues/17) agregue el caso sintético y el dataset congelado, esos datos podrán renderizarse dentro de la estructura de rutas ya navegable, sin tocar el modelo de navegación.
- Cuando [#18](https://github.com/reyduar/Vaqcrow/issues/18) y [#19](https://github.com/reyduar/Vaqcrow/issues/19) agreguen el rotulado `SIMULADO` y los banners de estado, podrán montarse dentro de los mismos `layout.tsx`/`loading.tsx`/`error.tsx` compartidos que #50 y #51 ya probaron.

Hasta que esas Features salgan de `Backlog`, no hay ningún journey de demo ejecutable extremo a extremo con fixtures o rotulado de simulaciones.

## 7. Correcciones de documentación de este cambio

```sh
$ rg -n 'demo-shell|[Ss]hell de demo|[Ss]hell guiad' docs/
docs/planning/DEMO.md:267:| 2 | Shell de demo y estados | Navegación completa con fixtures y banners | Día 1 |
docs/planning/DEMO.md:290:Dependencia crítica: `demo-shell -> AI assessment -> ...
docs/planning/DEMO.md:377:| 1 | `demo-shell` | Caso sintético, estados y rotulado de simulaciones | Journey navegable y fixture congelado |
docs/planning/demo-tasks-list.md:9:> [#51](#^issue-51) quedó en `Done` ...
docs/planning/demo-tasks-list.md:425:- **Objetivo:** entregar el slice de implementación delimitado para el shell guiado y su navegación.
docs/planning/demo-tasks-list.md:440:- **Entrega:** 1 PR — [#132](https://github.com/reyduar/Vaqcrow/pull/132) ...
docs/planning/demo-tasks-list.md:451:- **Objetivo:** capturar evidencia de finalización reproducible del shell guiado y su navegación.
```

**Resultado: ninguna corrección necesaria.** El barrido devolvió siete coincidencias y ninguna está desactualizada. `DEMO.md:267`, `DEMO.md:290` y `DEMO.md:377` son filas de planificación **prospectivas**: describen el objetivo eventual del slice (fixtures, banners, rotulado de simulaciones), no el estado del código; siguen siendo correctas tal como están escritas, y "corregirlas" sería reescribir el plan, no corregir un dato desactualizado. **No deben tocarse en este ni en ningún cambio hasta que #17/#18/#19 las cumplan.** `demo-tasks-list.md:9,425,440,451` describen las entradas de #50, #51 y #52 y ya reflejan el estado real posterior al merge de la PR [#132](https://github.com/reyduar/Vaqcrow/pull/132). Esta sección se conserva con resultado negativo, y no vacía, para que el barrido quede registrado y el negativo sea reproducible.

## 8. Verificación de los criterios de aceptación del issue #52

| # | Criterio | Resultado |
|---|---|---|
| 1 | La evidencia identifica la Feature #16, el método de verificación y el resultado observado | ✅ PASS — §1 identifica la Feature #16 y sus Tasks; §3/§4 citan el método (tests independientes, obs #379/#391) y el resultado observado |
| 2 | La evidencia es reproducible y está acotada a la feature | ✅ PASS — §4.1 re-ejecuta `pnpm run verify` una única vez y cita el `exit 0` fechado del 2026-09-17 sobre el commit `28a1257`; §2 define el formato de reproducción local |
| 3 | Se excluyen datos sensibles y afirmaciones no respaldadas | ✅ PASS — sin credenciales, rutas absolutas de máquina ni datos personales en este documento; §5/§6 acotan explícitamente el alcance sin afirmar una demo completada |

## 9. Riesgos y limitaciones aceptadas

**Flake preexistente en `tests/boundaries.test.ts` — fuera de alcance.** El verify-report del #50 (obs #379) dejó registrado un WARNING no bloqueante: en una máquina, un meta-test de `tests/boundaries.test.ts` superó el timeout por defecto de 5000 ms. Ese archivo es preexistente y ajeno a #50, #51 y #52 (última modificación en el commit `e118c1a`, anterior a esas ramas), el gate real de boundaries (`depcruise`) pasó limpio en esa misma corrida, y el `pnpm run verify` raíz del #51 salió `exit 0` sin que el flake reprodujera (obs #391). Este documento lo menciona únicamente como riesgo conocido heredado: **#52 no lo investigó, no lo re-ejecutó, no lo re-verificó y no lo corrigió**; sigue abierto como tarea ortogonal, sin issue asignado.

## 10. Estado de entrega

Cambio SDD `document-evidence-guided-demo-shell-and-navigation` ejecutado como una sola unidad de trabajo (forecast de `sdd-tasks`: ~110-140 líneas autoradas, archivo nuevo único, riesgo **Bajo** de presupuesto de 400 líneas, sin necesidad de encadenar PRs). Este documento es el único archivo modificado; no se tocó código fuente, pruebas, configuración ni `demo-tasks-list.md`. Ciclo SDD completo (explore → propose → spec → design → tasks → apply), con persistencia en Engram bajo el topic `sdd/document-evidence-guided-demo-shell-and-navigation/*`. Rama de trabajo: `Vaqcrow#52_Task_Document_evidence_build_guided_demo_shell_and_navigation`.

### Qué queda desbloqueado

Con #52 completo, la Feature [#16](https://github.com/reyduar/Vaqcrow/issues/16) ("Build guided demo shell and navigation") queda cerrada. Quedan libres de este bloqueo nativo: [#17](https://github.com/reyduar/Vaqcrow/issues/17) (caso sintético y dataset) y [#30](https://github.com/reyduar/Vaqcrow/issues/30).

### Próximos pasos sugeridos

1. Revisar y mergear el Pull Request de esta rama contra `main`.
2. Sincronizar `demo-tasks-list.md` (mover #52 a `Done`, backfillear el PR, actualizar la lista `Ready` de la línea 7) en un commit de sincronización de roadmap posterior al merge, no en este cambio — mismo patrón que la sincronización tras #50 y #51.
