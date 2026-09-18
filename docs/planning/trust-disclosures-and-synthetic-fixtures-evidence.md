# Evidencia de cierre de la Feature #17 — Issue #55

> Documento de cierre de Feature. No implementa ni re-deriva evidencia nueva: consolida y cita la evidencia ya verificada de los issues [#53](https://github.com/reyduar/Vaqcrow/issues/53) y [#54](https://github.com/reyduar/Vaqcrow/issues/54), y agrega únicamente lo que ninguno de los dos documenta (límites operativos vigentes, el encuadre futuro del resultado visible en la demo, el barrido de documentos desactualizados y el mapeo contra los cuatro criterios de aceptación propios del #55). No reemplaza a las observaciones de Engram `sdd/feature-17-trust-disclosures/verify-2` (obs #439) ni `sdd/feature-17-test-trust-disclosures/verify-report` (obs #449); ambas siguen siendo la fuente de verdad de lo que cada Task probó.

## 1. Contexto y objetivo

El issue [#55](https://github.com/reyduar/Vaqcrow/issues/55) ("Document evidence for trust disclosures and synthetic fixtures") es la tercera y última Task de la Feature [#17](https://github.com/reyduar/Vaqcrow/issues/17) ("Implementar avisos de confianza y fixtures sintéticos"), que a su vez cubre el slice 1 `demo-shell` de `DEMO.md` §13 en su tramo "Caso sintético, estados y rotulado de simulaciones". Las otras dos Tasks ya están completas y mergeadas: [#53](https://github.com/reyduar/Vaqcrow/issues/53) implementó los avisos de confianza y los fixtures sintéticos (PR [#142](https://github.com/reyduar/Vaqcrow/pull/142)); [#54](https://github.com/reyduar/Vaqcrow/issues/54) cerró la superficie de testing correspondiente en 2 PRs encadenadas ([#143](https://github.com/reyduar/Vaqcrow/pull/143), [#144](https://github.com/reyduar/Vaqcrow/pull/144)).

El objetivo de este documento es dar a un revisor un único punto de entrada que confirme el cierre de la Feature #17: qué límites de confianza quedaron probados, con qué comandos de verificación y qué resultado observado (criterio de aceptación 1 del #55), la evidencia de rotulado visible de simulación y los disclaimers exigidos por `DEMO.md` (criterio 2), su trazabilidad reproducible hacia la implementación y los tests focalizados (criterio 3), y la exclusión de datos sensibles y afirmaciones de producción no respaldadas (criterio 4). Es un cambio **solo de documentación**: cero diff de código de producción, cero reescritura de tests.

## 2. Cómo leer esta evidencia

- **Regla de citación.** Las secciones 3 y 4 **citan, nunca re-derivan**: cada cifra lleva su cita `obs #439` u `obs #449` en la misma viñeta o fila de tabla, nunca en un encabezado general. Ningún número de esas secciones se volvió a calcular para este documento, salvo la re-ejecución fechada de §4.1, que es un gate de regresión y no una fuente nueva de cifras.
- **Autoría nueva.** Las secciones 5, 6, 7, 8, 9 y 10 son autoría de este documento: ninguna de las dos evidencias previas enumera los límites operativos vigentes como un conjunto, encuadra el resultado como futuro, barre los documentos de planificación por referencias desactualizadas, ni mapea los cuatro criterios de aceptación propios del #55.
- **Formato.** Los comandos aparecen en bloques ```sh``` con `$ <comando>` seguido de su salida real.
- **Reproducción local, no CI.** Este repositorio no tiene `.github/workflows/`; toda la evidencia citada aquí y en sus fuentes es reproducción local bajo `nvm use v24.21.0` (el `package.json` raíz exige `engines: ">=24.0.0 <25.0.0"`).

## 3. Qué quedó implementado

Citado de `sdd/feature-17-trust-disclosures/verify-2` (obs #439), sin re-derivar:

- `apps/web/src/presentation/components/badge.tsx` usa genuinamente `Chip` de `@heroui/react` como elemento raíz renderizado (no un import decorativo); `TONE_TO_CHIP_COLOR` mapea los 4 miembros de `BadgeTone` (`neutral→default`, `info→accent`, `caution→warning`, `critical→danger`) y nunca selecciona el valor `"success"` propio de HeroUI (obs #439).
- `apps/web/src/presentation/components/trust-banner.tsx` usa genuinamente el compuesto `Alert.Root`/`Alert.Indicator`/`Alert.Content`/`Alert.Title`/`Alert.Description` de `@heroui/react`, con `role` explícito (`role="note"` para `simulation`/`testnet`/`fallback`, `role="alert"` para `error`) fijado en `Alert.Root`, ya que HeroUI no define un rol por defecto; `STATUS_BY_VARIANT` tampoco selecciona nunca `"success"` (obs #439).
- `rg -l "@heroui/react" apps/web/src` devuelve exactamente `trust-banner.tsx` y `badge.tsx` como los dos componentes que genuinamente consumen la librería (obs #439).
- `sales-evidence-table.tsx` mantiene una tabla nativa `<table>`/`<th scope="col">`/`<th scope="row">`/`<td>` y consume `Badge` (vía HeroUI `Chip`) para la columna de estado y, a través de `SyntheticValue`, para las celdas de monto de ventas (obs #439).
- `prohibited-terms.test.tsx` usa el patrón `RETORNO_AS_CERTAINTY_PATTERN`, un regex case-insensitive que empareja "retorno" con lenguaje de certeza (`garantiz\w*|asegur\w*|certeza|100\s?%|sin\s+riesgo`) dentro de una ventana de 40 caracteres en cualquier orden, más amplio que la comparación literal original y alineado con la fila conceptual correspondiente de `demo-ui.md` §10.5 (obs #439).
- `pnpm --filter @vaqcrow/web typecheck` — exit 0, sin salida (obs #439).
- `pnpm --filter @vaqcrow/web lint` — exit 0, 0 errores, 3 warnings preexistentes ajenos (`fetch-http-client.ts`, `freighter-wallet.ts`) (obs #439).
- `pnpm --filter @vaqcrow/web test` — exit 0, **33 archivos / 109 tests**, sin regresión respecto de la corrida previa (obs #439).
- `pnpm --filter @vaqcrow/web build` — exit 0, Next.js 16.3.5/Turbopack, las 9 rutas (`/`, `/ai-assessment`, `/approval`, `/distribution`, `/evidence`, `/funding`, `/request`, `/_not-found`) prerenderizadas como contenido estático (obs #439).
- `pnpm run boundaries` — exit 0, "no dependency violations found (122 modules, 218 dependencies cruised)" (obs #439).
- Sin hallazgos: el CRITICAL y el WARNING de una re-verificación previa quedaron resueltos y re-derivados de forma independiente, no aceptados del autorreporte de la corrección (obs #439).

## 4. Qué quedó probado

Citado de `sdd/feature-17-test-trust-disclosures/verify-report` (obs #449), sin re-derivar:

- 29/29 tareas marcadas `[x]` en el artefacto de tasks del #54, cruzadas contra el historial real de git: exactamente 9 archivos cambiados (3 nuevos + 6 modificados), 340 inserciones / 13 eliminaciones, todo test-only; `git diff main -- .../synthetic-value.tsx` vacío, confirmando que ningún archivo de producción fue tocado (obs #449).
- `pnpm --filter @vaqcrow/web typecheck` — PASS, cero errores (obs #449).
- `pnpm --filter @vaqcrow/web lint` — PASS, 0 errores, 3 warnings preexistentes ajenos (`fetch-http-client.ts`, `freighter-wallet.ts`) (obs #449).
- `pnpm --filter @vaqcrow/web test` — PASS, **36 archivos / 137 tests**, todos verdes (obs #449).
- `pnpm --filter @vaqcrow/web build` — PASS, Next.js 16.3.5/Turbopack, las 8 rutas estáticas generadas (obs #449).
- `pnpm run boundaries` — PASS, "no dependency violations" (125 modules, 247 dependencies) (obs #449).
- 5/5 requisitos del spec y 11/11 escenarios cubiertos por tests que pasan; los 4 criterios de aceptación propios del #54 confirmados de forma independiente por inspección directa de código (AC1 rotulado SIMULADO, AC2 disclaimers exactos + invariantes del fixture congelado, AC3 guardia de términos prohibidos, AC4 sin imports de servicios en vivo) (obs #449).
- `step-disclosures.test.ts` cubre la contención de disclosures por ruta con una tabla `requiredByRoute` copiada a mano (no derivada del propio módulo bajo prueba): `request→simulation`, `ai-assessment→human-ai`, `approval→human-ai`, `funding→testnet+non-custody`, `distribution→testnet`, `evidence→simulation+testnet+non-custody+no-production`, 8 tests (obs #449).
- `trust-disclosures.integration.test.tsx` renderiza las 6 rutas reales vía `DemoLayout`+`RouteHarness` y confirma la co-presencia de los badges `DEMO`/`TESTNET` junto con los rótulos `SIMULADO` de `SyntheticValue`/`SalesEvidenceTable` en un único render de la ruta `request`, 7 tests (obs #449).
- `synthetic-value.test.tsx` usa `it.each` con dos valores distintos de `simuladoLabel` ("SIMULADO", "DATO DE PRUEBA") para probar que el texto lo determina el prop, no una cadena fija, 5 tests (obs #449).
- 3 hallazgos MINOR informativos (compensaciones documentadas), 0 CRITICAL/MAJOR (obs #449).

| Comando | Resultado observado | Fuente |
|---|---|---|
| `pnpm --filter @vaqcrow/web typecheck` | exit 0 | obs #439 y obs #449 |
| `pnpm --filter @vaqcrow/web lint` | exit 0 — 0 errores, 3 warnings preexistentes ajenos | obs #439 y obs #449 |
| `pnpm --filter @vaqcrow/web test` | exit 0 — 33 archivos/109 tests (obs #439) → 36 archivos/137 tests tras el #54 (obs #449) | obs #439 y obs #449 |
| `pnpm --filter @vaqcrow/web build` | exit 0 — rutas de demo prerenderizadas estáticamente | obs #439 y obs #449 |
| `pnpm run boundaries` | exit 0 — 122 módulos/218 dependencias (obs #439) → 125 módulos/247 dependencias tras el #54 (obs #449) | obs #439 y obs #449 |

### 4.1 Gate de regresión de este cambio (no es evidencia nueva)

```sh
$ nvm use v24.21.0
$ git rev-parse --short HEAD
b5d64fa
$ pnpm run verify

> vaqcrow@ lint /Users/REDACTED/Workspaces/Vaqcrow
> turbo run lint

turbo 2.10.13
• Packages in scope: @vaqcrow/contracts, @vaqcrow/domain, @vaqcrow/web
• Running lint in 3 packages
@vaqcrow/contracts:lint: cache hit, replaying logs
@vaqcrow/domain:lint: cache hit, replaying logs
@vaqcrow/web:lint: cache hit, replaying logs

 Tasks:    3 successful, 3 total
Cached:    3 cached, 3 total

> vaqcrow@ typecheck
> turbo run typecheck

@vaqcrow/contracts:typecheck: cache hit, replaying logs
@vaqcrow/domain:typecheck: cache hit, replaying logs
@vaqcrow/web:typecheck: cache hit, replaying logs

 Tasks:    3 successful, 3 total
Cached:    3 cached, 3 total

> vaqcrow@ test
> turbo run test

@vaqcrow/contracts:test: cache hit, replaying logs
@vaqcrow/domain:test: cache hit, replaying logs
@vaqcrow/web:test:  Test Files  36 passed (36)
@vaqcrow/web:test:       Tests  137 passed (137)

 Tasks:    3 successful, 3 total
Cached:    0 cached, 3 total

> vaqcrow@ build
> turbo run build

@vaqcrow/web:build: ✓ Compiled successfully
@vaqcrow/web:build: ✓ Generating static pages using 8 workers (8/8)

 Tasks:    3 successful, 3 total

> vaqcrow@ boundaries
> depcruise apps/*/src packages/*/src --config .dependency-cruiser.cjs

✔ no dependency violations found (125 modules, 247 dependencies cruised)

> vaqcrow@ test:boundaries
> vitest run

 Test Files  2 passed (2)
      Tests  23 passed (23)

$ echo exit code: $?
exit code: 0
```

Verificado el 2026-09-17 sobre el commit `b5d64fa` de la rama de este cambio: `pnpm run verify` → **exit 0**. Esta corrida es un **gate de regresión** de un cambio solo de documentación, no una fuente de evidencia nueva; los conteos de la sección 4 siguen siendo los citados de obs #439 y obs #449.

## 5. Límites operativos vigentes

1. **No existe todavía UI del riel de fondeo.** El componente `StepTrustDisclosures` y `StepPlaceholder` siguen siendo el contenido de la ruta `funding`; ninguna capability de #53/#54 renderiza datos específicos del riel de fondeo, por lo que ese trabajo queda documentado como no-implementado a la espera de [#18](https://github.com/reyduar/Vaqcrow/issues/18) y [#19](https://github.com/reyduar/Vaqcrow/issues/19).
2. **Sin Stellar real, sin IA real, sin persistencia en esta superficie.** Los avisos de confianza y los fixtures sintéticos son puramente de presentación: no invocan Freighter, evaluación de IA en vivo ni ningún adaptador de Supabase.
3. **`error.recovery.test.tsx` prueba el contrato de React, no el wiring del App Router.** Igual que en la evidencia del #52, esta suite prueba el contrato de error boundary de React en aislamiento, no la integración de segmento de ruta de Next.js; no fue tocada por #53/#54 y sigue siendo el mismo límite ya documentado.
4. **Reproducción exige Node fijado.** El `package.json` raíz exige `engines: ">=24.0.0 <25.0.0"`; toda la evidencia citada se reprodujo bajo `nvm use v24.21.0`.

## 6. Resultado visible en la demo

Ningún enunciado de esta sección afirma que la demo ya se pueda usar de punta a punta hoy. Lo que existe — avisos de confianza reales, un fixture congelado con rotulado `SIMULADO` por registro y una guardia de términos prohibidos, todos probados sobre las seis rutas navegables (secciones 3 y 4) — es la base sobre la que se apoyarán pasos futuros de la demo:

- Cuando [#18](https://github.com/reyduar/Vaqcrow/issues/18) agregue la evaluación asistida por IA sobre este mismo caso sintético, podrá consumir los avisos `human-ai` y el fixture ya probados aquí sin tocar su forma.
- Cuando [#19](https://github.com/reyduar/Vaqcrow/issues/19) agregue el riel de fondeo y la confirmación en Stellar Testnet, podrá reutilizar los avisos `testnet`/`non-custody` y el mismo `DemoEnvironmentHeader` persistente que la integración cruzada de #54 ya cubre.

Hasta que esas Features salgan de `Backlog`, no hay ningún journey de demo ejecutable extremo a extremo con evaluación de IA real ni liquidación en Stellar Testnet.

## 7. Barrido de documentos desactualizados

El barrido excluye este mismo documento del glob: su propia prosa cita términos como "avisos de confianza" y "fixtures sintéticos" en los encabezados de este §7 y en las secciones §1/§3/§5/§10, así que incluirlo generaría coincidencias contra sí mismo y el resultado dejaría de ser el barrido de documentos de planificación que esta sección audita.

```sh
$ rg -n '#53|#54|#55|pendiente|por construir|TODO' docs/design/demo-ui.md docs/planning/DEMO.md
```

No se encontraron referencias desactualizadas a las Tasks de la Feature #17 en `docs/design/demo-ui.md` ni en `docs/planning/DEMO.md`; las coincidencias de "pendiente" que existen en `demo-ui.md` corresponden a la lista de seguimiento de assets de marca (§11.9) y a la variante MOBILE de Stitch en backlog, ambas ajenas a #53/#54/#55.

```sh
$ rg -n '#53|#54|#55|Backlog' docs/planning/demo-tasks-list.md
```

`docs/planning/demo-tasks-list.md` líneas 678, 691 y 703 todavía muestran a #53, #54 y #55 con `Workflow: Backlog`, a pesar de que #53 y #54 ya están mergeados y cerrados en `main`. La línea 7 (el resumen de unidades `Ready`) tampoco reconoce a #53/#54 como completos. **Este es un hallazgo real de desactualización**, a diferencia del barrido del #52 (que no encontró ninguna). Sin embargo, siguiendo la misma decisión confirmada por el orquestador en el #52 (obs #399: "este cambio NO toca `docs/planning/demo-tasks-list.md`"), esta evidencia documenta el hallazgo con **resultado negativo diferido** en lugar de corregirlo en este cambio. El seguimiento formal de esta sincronización de roadmap queda registrado en el issue [#145](https://github.com/reyduar/Vaqcrow/issues/145) ("[Backlog] Sync demo-tasks-list.md roadmap status for issues #53/#54/#55"), que es el punto de seguimiento rastreado para esta desactualización — la sincronización real (mover #53/#54/#55 a `Done`, backfillear los PRs, actualizar la línea `Ready`) pertenece a un commit posterior de sincronización de roadmap, no a este cambio.

## 8. Mapeo de criterios de aceptación

| # | Criterio (verbatim, issue #55) | Resultado |
|---|---|---|
| 1 | "Evidence identifies Feature #17, the tested trust boundaries, the verification commands, and observed results." | ✅ PASS — §1 identifica la Feature #17 y sus tres Tasks (#53/#54/#55); §3/§4 citan los límites de confianza probados (Badge, TrustBanner, la guardia de términos prohibidos, la contención por ruta), los 5 comandos de verificación y sus resultados observados citados a obs #439/#449; §4.1 agrega el resultado fechado de este propio cambio |
| 2 | "Evidence demonstrates visible simulation labeling and the required disclaimers from DEMO.md." | ✅ PASS — §3 cita el rotulado `SIMULADO` verbatim vía `Badge`/`SyntheticValue`, sourced por registro del propio fixture (`demo-ui.md` §9.3, "La etiqueta `SIMULADO` viaja con el dato al resumirlo, graficarlo o citarlo; no vive solo en la pantalla de origen"); las cinco disclosures canónicas quedan citadas verbatim en el bloque de origen de `disclosures.ts`, verbatim de `DEMO.md` §12 |
| 3 | "Evidence is reproducible and traceable to the implementation and focused tests." | ✅ PASS — §2 define el formato de reproducción local (`nvm use v24.21.0`, sin CI); §4.1 re-ejecuta `pnpm run verify` una única vez sobre el commit `b5d64fa` de esta misma rama y cita el `exit 0` fechado del 2026-09-17; §3/§4 trazan cada aviso y fixture hacia su archivo de implementación (`disclosures.ts`, `step-disclosures.ts`, `panaderia-horizonte.ts`) y su test focalizado correspondiente |
| 4 | "Sensitive data and unsupported production claims are excluded." | ✅ PASS — sin credenciales, semillas, claves privadas, XDR innecesario ni datos personales reales en este documento; §5/§6 acotan explícitamente el alcance sin afirmar una demo completada, y el propio texto canónico "No apto para producción" (§12 de `DEMO.md`) es uno de los cinco disclaimers citados en §3 |

Las cinco disclosures canónicas, citadas verbatim de `apps/web/src/application/trust/disclosures.ts` (a su vez verbatim de `DEMO.md` §12):

> **Demostración con datos simulados.** La identidad, el KYC/KYB, las ventas y la conversión ARS/activo Stellar de este caso son sintéticos. No representan verificaciones ni movimientos de dinero real.

> **Stellar Testnet.** Las transacciones mostradas usan activos sin valor económico en Stellar Testnet. Un hash de Testnet demuestra ejecución técnica, no una inversión real ni disponibilidad en producción.

> **Firma no custodial.** Freighter es la wallet e interfaz de firma. La persona usuaria conserva sus claves; Vaqcrow construye y verifica la transacción y nunca recibe su seed.

> **IA con supervisión humana.** La IA organiza evidencia, identifica anomalías y propone una evaluación explicable. No inventa datos, no toma la decisión final, no calcula obligaciones financieras y no transfiere fondos.

> **No apto para producción.** Esta demo no constituye una oferta de inversión, recomendación financiera, aprobación regulatoria ni prueba de legalidad, rentabilidad, solvencia, custodia, calidad de proveedores u operación en Argentina.

## 9. Riesgos y limitaciones aceptadas

**Flake preexistente en `tests/boundaries.test.ts` — fuera de alcance.** Igual que en la evidencia del #52, un meta-test de `tests/boundaries.test.ts` superó en una máquina el timeout por defecto de 5000 ms. Ese archivo es preexistente y ajeno a #53, #54 y #55; el gate real de boundaries (`depcruise`, vía `pnpm run boundaries`) pasó limpio en las corridas de obs #439 y obs #449, y la re-ejecución de §4.1 de este cambio tampoco lo reprodujo. Este documento lo menciona únicamente como riesgo conocido heredado: **#55 no lo investigó, no lo re-ejecutó, no lo re-verificó y no lo corrigió**; sigue abierto como tarea ortogonal, sin issue asignado.

## 10. Estado de entrega

Con este documento completo, la Feature [#17](https://github.com/reyduar/Vaqcrow/issues/17) ("Implementar avisos de confianza y fixtures sintéticos") queda cerrada al mergear esta rama. Cambio SDD `document-evidence-trust-disclosures` ejecutado como una sola unidad de trabajo (forecast de `sdd-tasks`: ~150-190 líneas autoradas, archivo nuevo único, riesgo **Bajo** de presupuesto de 400 líneas, sin necesidad de encadenar PRs). Este documento es el único archivo agregado; no se tocó código fuente, pruebas, configuración ni `demo-tasks-list.md`. Ciclo SDD completo (explore → propose → spec → tasks → apply, diseño omitido por no existir decisiones de arquitectura), con persistencia en Engram bajo el topic `sdd/feature-17-document-evidence-trust-disclosures/*`. Rama de trabajo: `Vaqcrow#55_Task_Document_evidence_for_trust_disclosures_and_synthetic_fixtures`.

### Qué queda desbloqueado

Con #55 completo y la Feature #17 cerrada, queda libre de este bloqueo nativo el issue [#18](https://github.com/reyduar/Vaqcrow/issues/18) (evaluación asistida por IA), tal como registra `demo-tasks-list.md` línea 706.

### Próximos pasos sugeridos

1. Revisar y mergear el Pull Request de esta rama contra `main`.
2. Sincronizar `docs/planning/demo-tasks-list.md` (mover #53/#54/#55 a `Done`, backfillear los PRs, actualizar la lista `Ready` de la línea 7) en un commit de sincronización de roadmap posterior al merge, siguiendo el seguimiento del issue [#145](https://github.com/reyduar/Vaqcrow/issues/145) — no en este cambio, mismo patrón que la sincronización tras #50, #51 y #52.
