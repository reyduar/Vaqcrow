# Evidencia de cierre de la Feature #18 — Issue #58

> Documento de cierre de Feature. No implementa ni re-deriva evidencia nueva sobre el comportamiento: consolida la implementación del issue [#56](https://github.com/reyduar/Vaqcrow/issues/56) y las pruebas del issue [#57](https://github.com/reyduar/Vaqcrow/issues/57), y registra únicamente resultados observados en una corrida propia de este cambio (§4.1) sobre el commit `44754d1`. Todo lo que muestra la demo es **SIMULADO** y no depende de Stellar Testnet, Horizon ni de un proveedor de LLM.

## 1. Contexto y objetivo

El issue [#58](https://github.com/reyduar/Vaqcrow/issues/58) ("Task: Document evidence for SME request and evidence review") es la tercera y última Task de la Feature [#18](https://github.com/reyduar/Vaqcrow/issues/18) (solicitud de la PyME y revisión de evidencia), derivada de `docs/planning/DEMO.md`. Las otras dos Tasks:

- [#56](https://github.com/reyduar/Vaqcrow/issues/56) ("Implement SME request and evidence review") entregada como una cadena stacked-to-main de seis PRs, [#154](https://github.com/reyduar/Vaqcrow/pull/154) a [#159](https://github.com/reyduar/Vaqcrow/pull/159).
- [#57](https://github.com/reyduar/Vaqcrow/issues/57) ("Test SME request and evidence review") en la PR [#161](https://github.com/reyduar/Vaqcrow/pull/161) contra `main` (reemplaza a la PR [#160](https://github.com/reyduar/Vaqcrow/pull/160), mergeada contra una rama ya mergeada; ver §5, límite 1).

El objetivo es dar a un revisor un único punto de entrada que identifique la Feature #18, el método de verificación y los resultados observados, con trazabilidad hacia la implementación y las pruebas focalizadas, sin datos sensibles ni afirmaciones de producción no respaldadas (criterios de aceptación del #58). Es un cambio **solo de documentación**: cero diff de código de producción, de tests, de manifiestos y de lockfile.

> [!warning] Estado de la cadena de PRs al redactar este documento
> Verificado con `gh pr view` y `git merge-base --is-ancestor` contra `origin/main`: los seis PRs de #56 (#154 a #159) están mergeados y sus commits (`6915c1d` a `f91d677`) están en `main`. La PR #160 (tests de #57) se mergeó a las 23:34 UTC contra la rama del slice 6, después de que la cascada ya había llevado esa rama a `main`, por lo que su commit `44754d1` **no llegó a `main`** y #57 quedó abierto. Se repara con la PR #161 (mismo diff, commit `c45e789`, base `main`), abierta al momento de redactar. Es el mismo riesgo del patrón stacked-to-main registrado en la evidencia del #43 (§5, límite 5). Ver §5, límite 1.

## 2. Cómo leer esta evidencia

- **Trazabilidad.** Cada afirmación de implementación cita ruta de archivo, commit y PR. Los SHAs son los de las ramas de trabajo (no los commits de merge).
- **Corrida propia.** Los resultados de §4.1 se observaron ejecutando los comandos en primer plano sobre el commit `44754d1`, con Node `v24.21.0` (`PATH=/opt/homebrew/opt/node@24/bin:$PATH`; el `package.json` raíz exige `engines: ">=24.0.0 <25.0.0"`). No se cita ninguna cifra de memoria.
- **Reproducción local, no CI.** No existe `.github/workflows/`; toda la verificación es local.
- **Formato.** Comandos en bloques ```sh``` con `$ <comando>` y su salida real, resumida a las líneas relevantes.
- **Sin material sensible.** No hay credenciales, semillas, claves, XDR ni datos personales. La referencia de PyME `sme:SYN-PH-0001` es un identificador sintético.

## 3. Qué quedó implementado (#56)

### 3.1 Cadena de PRs y slices

| Slice | PR | Contenido | Commits | Líneas (con tests) |
|---|---|---|---|---|
| 1 | [#154](https://github.com/reyduar/Vaqcrow/pull/154) | Contratos y lógica de evidencia | `6915c1d`, `69b9976` | 451 |
| 2 | [#155](https://github.com/reyduar/Vaqcrow/pull/155) | Adaptador Axios y dependencias | `8093668` | 342 |
| 3 | [#156](https://github.com/reyduar/Vaqcrow/pull/156) | Formulario y panel de revisión | `d04a9a9`, `f08b0fc` | 496 |
| 4 | [#157](https://github.com/reyduar/Vaqcrow/pull/157) | Errores de campo saneados y timeout en el adaptador HTTP | `a489f1c` | 155 |
| 5 | [#158](https://github.com/reyduar/Vaqcrow/pull/158) | Gateway, mapper y errores de envío saneados | `751a89b`, `52b9ebc` | 533 |
| 6 | [#159](https://github.com/reyduar/Vaqcrow/pull/159) | Cableado de la página `request` | `f91d677` | 627 |

La columna de líneas es el conteo de líneas autoradas de cada slice, tests incluidos (ver §5, límite 6).

### 3.2 Comportamiento y archivos

- **Contratos normalizados** (`6915c1d`): `packages/contracts/src/sme-evidence.ts` define los schemas zod de solicitud de PyME, período de ventas, referencia de evidencia y hallazgo de revisión, exportados desde `packages/contracts/src/index.ts`. La solicitud usa contratos normalizados y `apps/web` consume `packages/contracts` (nunca `packages/domain`).
- **Lógica pura de evidencia** (`69b9976`): `apps/web/src/application/evidence/evidence-review.ts` resuelve referencias de evidencia y deriva hallazgos `missing`, `anomalous` y `contradictory`, sin completar nunca un dato faltante. Un caso contradictorio sintético se agregó en `apps/web/src/application/fixtures/contradictory-request.ts`.
- **Decisión D1 (aprobada por el usuario).** Se considera contradictorio el total declarado en la solicitud que no coincide con la suma de los períodos reportados de ventas. Solo se suman períodos `reported`, con igualdad exacta (ARS enteros); el hallazgo se dispara con independencia de que haya períodos faltantes.
- **Adaptador HTTP** (`8093668`, `a489f1c`): `apps/web/src/infrastructure/http/axios-http-client.ts` implementa `HttpClientPort` (`apps/web/src/application/ports/http-client-port.ts`). Axios queda accesible solo detrás de ese adaptador; el timeout viene de configuración y los errores no-2xx se exponen como errores de campo saneados.
- **Formulario y panel** (`d04a9a9`, `f08b0fc`): `apps/web/src/presentation/components/sme-request-form.tsx` (React Hook Form, solo estado de formulario del navegador) y `evidence-review-panel.tsx`; la presentación no importa Axios ni `packages/contracts` salvo tipos. Los tipos de vista viven en `apps/web/src/application/evidence/review-view-model.ts`.
- **Gateway y mapper** (`751a89b`): `apps/web/src/application/ports/sme-request-gateway.ts` (puerto), `apps/web/src/infrastructure/sme/http-sme-request-gateway.ts` (adaptador), `apps/web/src/application/evidence/review-mapper.ts`, `submit-sme-request.ts` y `sme-request-errors.ts`. Los campos permitidos (`declaredTotalArs`, `periodStart`, `periodEnd`) y los códigos (`required`, `not_integer`, `out_of_range`, `invalid_format`, `before_start`) se traducen a copy en español; lo desconocido cae en un mensaje genérico.
- **Cableado de la página** (`f91d677`): `apps/web/src/presentation/components/sme-request-workspace.tsx`, `apps/web/src/state/use-sme-request.ts` (SWR para estado de servidor) y `apps/web/src/infrastructure/sme/default-gateway.ts`, montados desde `apps/web/src/app/(demo)/request/page.tsx`.
- **Decisión D3 (aprobada por el usuario).** Sin `NEXT_PUBLIC_API_BASE_URL` no hay gateway: la página muestra solo los fixtures sintéticos y el envío informa que el servicio no está disponible; **nunca** reporta éxito.
- **Rutas de backend provisionales.** El gateway asume `POST /sme-requests` y `GET /sme-requests/current` (respuesta `{ request, salesPeriods }`, errores `{ errors: [{ field, code }] }`). **No existe ningún endpoint en `apps/api`** (ver §5, límite 2).

### 3.3 Puerta de dependencias (axios, swr, react-hook-form)

Antes de tocar `apps/web/package.json` o `pnpm-lock.yaml` (commit `8093668`) se buscó soporte en skills y MCP: **skill: ninguna** (el registro no tiene una skill para axios, swr ni react-hook-form); **MCP: context7**. Se instalaron solo `axios ^1.20.0`, `swr ^2.5.1` y `react-hook-form ^7.88.0`. Para la UI se cargaron además las skills `heroui-react` y `frontend-design` y el MCP de HeroUI (Button/Input).

### 3.4 Revisión nativa y un defecto real hallado

Los cuatro linajes de revisión nativa (slice 1, slice 2, slice 3 y slices 4/5/6) terminaron **aprobados** y con la autoridad reconocida y quemada. La revisión del slice 5 (`751a89b`) señaló un WARNING que se verificó como real: un `code` de backend como `constructor` se resolvía contra un miembro heredado de `Object.prototype` al indexar `FIELD_MESSAGES[field][code]`, en lugar de caer en el mensaje genérico. Se corrigió con TDD estricto en el commit `52b9ebc` (RED observado, luego GREEN), protegiendo el acceso con `Object.hasOwn`. Ese commit quedó posterior al candidato revisado y **no fue re-revisado por sí mismo**. El slice 6 se rebasó sobre él.

## 4. Qué quedó probado (#57)

La PR [#161](https://github.com/reyduar/Vaqcrow/pull/161) (commit `c45e789`, cherry-pick de `44754d1` de la PR [#160](https://github.com/reyduar/Vaqcrow/pull/160); 137 líneas, solo tests, sin cambios de producción, manifiestos ni lockfile) auditó la cobertura existente contra los criterios de la Feature y agregó **10 tests**, todos deterministas y con dobles/fixtures (sin red):

| Archivo | Escenario cubierto |
|---|---|
| `apps/web/src/application/evidence/evidence-review.test.ts` | períodos anómalos excluidos de la suma; hallazgos `missing` y `contradictory` a la vez; caracterización de un período `reported` con monto nulo (suma 0, sin hallazgo) |
| `apps/web/src/application/evidence/review-mapper.test.ts` | `buildEvidenceRegistry` omite períodos `missing` desde una entrada directa; la referencia de un período faltante queda sin resolver de punta a punta |
| `apps/web/src/infrastructure/http/axios-http-client.test.ts` | timeout mapeado a un error de red saneado |
| `apps/web/src/presentation/components/sme-request-workspace.test.tsx` | falla de red; 422 con campo y código desconocidos (`constructor`); reintento tras falla; monto no entero que nunca llega al gateway |
| `packages/contracts/src/sme-evidence.test.ts` | caracterización: el schema acepta un período `missing` con monto numérico |

Los 10 son **tests de caracterización**: pasan porque el comportamiento ya existía, **ninguno fue RED**. Dos fijan a propósito brechas conocidas (§5, límite 3) y deberán actualizarse si ese comportamiento cambia.

**Desvío de TDD estricto (declarado).** Para el hook de estado `apps/web/src/state/use-sme-request.ts` el RED se confirmó *después* de escribir la implementación, moviéndola temporalmente para observar la falla. Se registra tal cual, sin presentarlo como RED previo.

### 4.1 Gate de verificación de este cambio

Verificado sobre el commit `44754d1` de la rama `Vaqcrow#58_Task_Document_evidence_for_SME_request_and_evidence_review`, Node `v24.21.0`, ejecutando cada comando en primer plano:

```sh
$ pnpm --filter @vaqcrow/contracts test
 Test Files  4 passed (4)
      Tests  58 passed (58)

$ pnpm --filter @vaqcrow/web test
 Test Files  48 passed (48)
      Tests  243 passed (243)

$ pnpm --filter @vaqcrow/web typecheck; echo exit=$?
exit=0

$ pnpm run lint; echo exit=$?
@vaqcrow/web:lint: ✖ 3 problems (0 errors, 3 warnings)
 Tasks:    4 successful, 4 total
exit=0

$ pnpm run boundaries
✔ no dependency violations found (173 modules, 371 dependencies cruised)

$ pnpm run verify; echo exit=$?
@vaqcrow/domain:test:   Tests  41 passed (41)
@vaqcrow/contracts:test: Tests  58 passed (58)
@vaqcrow/api:test:      Tests  27 passed (27)
@vaqcrow/web:test:      Tests  243 passed (243)   (48 archivos)
 Tasks:    6 successful, 6 total   (test)
 Tasks:    4 successful, 4 total   (build)
✔ no dependency violations found (173 modules, 371 dependencies cruised)
 Test Files  2 passed (2) / Tests  23 passed (23)   (test:boundaries)
exit=0
```

Los 3 warnings de lint son preexistentes y ajenos (`fetch-http-client.ts`, `freighter-wallet.ts`). `pnpm run verify` encadena lint, typecheck, test, build, boundaries y test:boundaries, y terminó con **exit 0**. Esta es la única corrida registrada; no se ejecutó ningún otro check.

## 5. Límites y brechas vigentes

1. **La PR de tests de #57 quedó varada y hubo que rehacerla.** La cadena de #56 (#154 a #159) sí llegó completa a `main`, pero #160 se mergeó contra la rama del slice 6 después de la cascada, así que `44754d1` no está en `main` y #57 no se cerró. Se reabrió como #161 sobre `main` con el mismo diff (5 archivos, 137 líneas), re-verificado allí: 243 tests de web, 58 de contracts, typecheck exit 0. Hasta que #161 se mergee, `main` no contiene los 10 tests de #57. Lección: al mergear cadenas apiladas hay que verificar la rama destino de cada PR, no solo su estado `merged`, y mergear el PR hoja antes de que la cascada lo deje sin base.
2. **No existe endpoint de backend.** `POST /sme-requests` y `GET /sme-requests/current` son rutas provisionales sin implementación en `apps/api`. La demo funciona solo con fixtures sintéticos (D3); ningún envío real se persiste.
3. **Brechas conocidas fijadas por tests (no corregidas).** (a) Un período `reported` con monto nulo se suma como 0 sin generar hallazgo. (b) El contrato acepta un período `missing` con un monto numérico. Ambas están caracterizadas por los tests de #57.
4. **Los períodos no se filtran por el rango de la solicitud** (`periodStart`/`periodEnd`).
5. **Sin `try/finally` en `submit`** de `apps/web/src/state/use-sme-request.ts`. Se verificó como de bajo riesgo, porque `submitSmeRequest` ya captura los errores del gateway y `buildSmeRequest` es puro; queda como endurecimiento candidato.
6. **Slices sobre el presupuesto de 400 líneas.** Los seis slices de #56 midieron 451, 342, 496, 155, 533 y 627 líneas (tests incluidos); cuatro superan el presupuesto. Se recomienda la etiqueta `size:exception` en esas PRs. El slicing se hizo una sola vez sobre commits cohesivos.
7. **Brechas de producto abiertas.** `smeReference` es la constante `sme:SYN-PH-0001`; los períodos del backend usan la procedencia neutra "Registro del servicio de solicitudes"; los períodos faltantes muestran "Evidencia sin resolver"; el copy de éxito "Solicitud registrada en el entorno de demostración (SIMULADO)" requiere revisión.
8. **Otras advertencias de revisión no bloqueantes**, sin corregir: errores de servidor no se limpian al editar el formulario; ids estáticos de input se duplicarían con dos instancias del formulario.
9. **Sin E2E ni servicios en vivo.** No se ejecutó Playwright, ni Testnet/Horizon, ni proveedor de LLM, ni la suite de integración de Supabase (`test:integration`), que no forma parte de `verify`. La verificación depende solo de dobles y fixtures.
10. **Sin afirmaciones de producción.** Identidad, KYC/KYB, ventas y evidencia son sintéticas; la IA es solo asesora. Nada de esto constituye una demo completada de extremo a extremo.

## 6. Resultado visible en la demo

En la ruta `request` la demo muestra hoy, sobre datos sintéticos y con rótulo SIMULADO: la solicitud de la PyME, la tabla de ventas y el panel de revisión que expone períodos faltantes, anómalos y el caso contradictorio (total declarado distinto de la suma de períodos reportados), sin completar nunca lo faltante. Sin `NEXT_PUBLIC_API_BASE_URL` el envío informa servicio no disponible. No hay todavía flujo ejecutable de extremo a extremo con backend real, evaluación de IA ni liquidación en Stellar Testnet.

## 7. Mapeo de criterios de aceptación

### Issue #58

| # | Criterio (issue #58) | Resultado |
|---|---|---|
| 1 | "Evidence identifies Feature #18, the verification method, and observed results." | PASS. §1 identifica la Feature #18 y sus Tasks; §2 y §4.1 describen el método y los resultados observados |
| 2 | "Evidence is traceable to the implementation and focused tests." | PASS. §3 y §4 citan rutas, commits y PRs |
| 3 | "Sensitive data and unsupported production claims are excluded." | PASS. §2 y §5 (límite 10) |

### Issue #56 (implementación)

| Criterio (resumen) | Evidencia |
|---|---|
| Comportamiento de la Feature #18 dentro de su frontera | §3.2 |
| Captura de solicitud, ventas y evidencia; faltantes o contradictorios visibles con rótulo SIMULADO | §3.2 (D1) y §6 |
| Fallas no declaran éxito ni debilitan los límites de control humano, simulación o secretos | §3.2 (D3) y §3.4 |
| Axios solo tras el adaptador/puerto HTTP; presentación sin Axios ni `packages/contracts` (salvo tipos) | §3.2 y `pnpm run boundaries` en §4.1 |
| SWR para estado de servidor; React Hook Form solo para estado de formulario | §3.2 |
| Puerta de dependencias registrada antes de tocar manifiestos | §3.3 |

### Issue #57 (pruebas)

| Criterio (issue #57) | Evidencia |
|---|---|
| "Deterministic tests demonstrate the core behavior of Feature #18." | §4 |
| "Rejection and fallback behavior is covered where applicable." | §4 (422 desconocido, falla de red, timeout, reintento) |
| "The focused suite passes without live external services or sensitive data." | §4.1 (243 tests web, 58 contracts) |

### Feature #18

| Alcance de la Feature | Evidencia |
|---|---|
| Implementación (#56) | §3 |
| Pruebas (#57) | §4 |
| Evidencia (#58) | este documento |

## 8. Estado de entrega

- Cambio de documentación con un único archivo nuevo; no se tocó código fuente, tests, manifiestos, lockfile ni `docs/planning/demo-tasks-list.md`.
- **Sincronización de roadmap diferida.** La actualización de `docs/planning/demo-tasks-list.md` (mover #56/#57/#58 a `Done`, registrar los PRs #154 a #159 y #161 (#160 quedó reemplazado), cerrar la Feature #18) pertenece a un commit posterior de sincronización, no a este cambio.
- Rama de trabajo: `Vaqcrow#58_Task_Document_evidence_for_SME_request_and_evidence_review`.

### Próximos pasos sugeridos

1. Resolver el estado de la cadena de PRs (§5, límite 1): mergear la PR #161 a `main` (muestra solo su commit) y verificar que `44754d1`/`c45e789` figure en `main`.
2. Revisar y mergear la PR de esta rama contra `main`.
3. Decidir si las brechas de §5 (límites 3 a 5) se corrigen en una Task de seguimiento.
4. Sincronizar el roadmap tras el merge.
