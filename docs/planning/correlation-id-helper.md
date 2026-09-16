# Correlation ID: contrato validable y propagación en Fastify — Issue #116

> Documento de cierre de iteración. Registra qué se hizo, por qué, y qué decisiones se tomaron para implementar el [issue #116](https://github.com/reyduar/Vaqcrow/issues/116) ("Add correlation-id helper to packages/contracts"), follow-up del scaffold de la API Fastify ([#110](https://github.com/reyduar/Vaqcrow/issues/110), ver [scaffold-fastify-api.md](./scaffold-fastify-api.md)). No reemplaza la fuente de verdad arquitectónica ([monorepo.md](../architecture/monorepo.md)); es el registro de esta implementación puntual.

## Contexto y objetivo

`packages/contracts` seguía siendo un placeholder desde #35: exportaba solo un probe de cableado (`WorkspaceProbe`) y no tenía ninguna librería de validación en runtime. El issue #110 había dejado explícitamente diferido "contratos validables en runtime y correlation IDs" para no absorber ese trabajo dentro del scaffolding de `apps/api`. El issue #116 recoge exactamente esa deuda: un tipo de correlation ID opaco, un generador, un schema/parser que rechace valores malformados, y que `apps/api` demuestre generar y propagar ese ID en al menos una request — todo sin que `packages/contracts` ni la capa de aplicación importen Fastify o SDKs de proveedores.

La tarea se implementó con un ciclo completo de **Spec-Driven Development (SDD)**: exploración → investigación → propuesta → especificación → diseño → tareas → implementación → verificación → archivo. Al igual que en #110, diseño e implementación pasaron por un validador de contrato en contexto fresco que re-ejecutó los comandos reales del repositorio.

> **Nota sobre persistencia:** las 7 fases del ciclo SDD (exploración, propuesta, spec, diseño, tareas, apply-progress y verify-report) se persistieron inicialmente como archivos en `openspec/`, porque el dispatcher nativo resolvió ese store en vez de Engram (el default del proyecto) al encontrar un change ya materializado localmente. El 15/09/2026 se migró ese contenido íntegro a Engram (topic keys `sdd/correlation-id-helper/*`, mismo patrón usado en #110/#111) y se eliminó la carpeta `openspec/` del repositorio: no aporta valor versionarla junto al código, y Engram es ahora el artifact store por defecto para todos los ciclos SDD de este proyecto.

## Decisiones clave

### Zod 4 con branding, no un string plano ni un validador manual

El issue no fijaba librería de validación, y la tarea relacionada #38 ("Define/Implement domain states and shared contracts") tampoco había elegido una todavía. Escribir un parser a mano habría evitado una dependencia, pero habría duplicado exactamente el tipo de infraestructura de validación que #38 va a necesitar de todos modos.

**Decisión:** adoptar Zod 4 como dependencia directa de `packages/contracts` (vía catalog de pnpm, para que #38 reutilice la misma versión) y definir el contrato como `z.uuidv4().brand<"CorrelationId">()`. Un único schema es a la vez la fuente de verdad runtime y el tipo estático `CorrelationId`; los strings sueltos no calzan con el tipo aunque tengan formato UUID válido.

### El servidor genera el ID, no lo acepta del caller

Fastify permite un `requestIdHeader` que deja al caller elegir el ID de la request, pero esa opción **no valida nada** — habría dejado pasar cualquier string como identidad de logging/tracing.

**Decisión:** `requestIdHeader: false`, generación vía `genReqId` usando `generateCorrelationId()` de contracts, y un hook `onRequest` global que copia `request.id` al header de respuesta `x-correlation-id` antes de que la ruta, un 404 o un error terminen de resolverse. Un header `x-correlation-id` entrante se ignora explícitamente: la respuesta siempre lleva el ID generado por el servidor, nunca el del caller.

### Invariante de arranque, no chequeo por request

`generateCorrelationId()` depende de `globalThis.crypto.randomUUID`, disponible en Node 24 pero no garantizado en todo runtime. Verificarlo en cada request habría metido una rama de error sin necesidad en el hot path.

**Decisión:** `buildApp()` valida `globalThis.crypto.randomUUID` una sola vez, de forma síncrona, antes de construir Fastify, y lanza si falta. Con esa garantía ya establecida, el callback de `genReqId` no tiene rama de "runtime no disponible": no es necesario que sea defensivo contra algo que el arranque ya descartó.

### Portabilidad probada con un fixture DOM-only, no solo inspección de imports

`apps/web` también consume `packages/contracts`. Confiar en una lectura manual de imports para asegurar que el barrel no arrastra `node:crypto` o tipos ambientales de Node es frágil frente a cambios futuros.

**Decisión:** se agregó `tests/fixtures/boundaries/apps/web/runtime-contracts.consumer.ts`, compilado con su propio `tsconfig.json` (libs DOM, resolución de bundler, `types: []`) dentro del harness de boundaries. Cero diagnósticos ahí prueba objetivamente que el barrel de contracts es consumible sin ambiente Node. Se sumó también una sexta regla de `dependency-cruiser` con fixtures negativos (`imports-fastify.fixture.ts`, `imports-node-crypto.fixture.ts`) para que `packages/contracts` quede protegido igual que ya lo estaba `apps/api/src/application/`.

### Alcance explícitamente diferido

- **Schemas de dominio/eventos** (#38) y **telemetría/resiliencia** (#98) quedan fuera: este issue define únicamente el contrato de correlation ID y su propagación HTTP.
- **Política de confianza de headers entrantes** (aceptar o no un `x-correlation-id` del caller) queda como decisión explícita futura, no resuelta implícitamente por omisión.

## Defecto encontrado y corregido durante la implementación

**El primer intento de verificación falló por ESLint `no-constant-condition`.** El test que probaba en tiempo de compilación que un string sin branding no encaja en `CorrelationId` usaba una rama `if (false) { ... }` para forzar el chequeo de tipos sin ejecutar código en runtime — patrón que ESLint rechaza como condición constante.

**Corrección:** se reemplazó esa rama por `expectTypeOf(rawString).not.toMatchTypeOf<CorrelationId>()` de Vitest, que expresa la misma aserción de tipos sin depender de una condición inalcanzable. El resto de la implementación no cambió; la verificación completa (`pnpm run verify`) pasó limpia después del ajuste.

## Verificación de los 4 criterios de aceptación del issue #116

| # | Criterio | Resultado |
|---|---|---|
| 1 | `packages/contracts` exporta un tipo de correlation ID y un helper generador | ✅ PASS |
| 2 | `packages/contracts` exporta un schema/parser validable en runtime que rechaza input malformado | ✅ PASS |
| 3 | `apps/api` genera y propaga un correlation id en al menos una request, sin nuevos imports de framework/SDK en `application/` ni en `packages/contracts` | ✅ PASS |
| 4 | Tests unitarios cubren generación, validación exitosa y rechazo de valores malformados | ✅ PASS |

**Evidencia de verificación independiente:** 6/6 requisitos y 10/10 escenarios cumplidos, 0 hallazgos CRITICAL/WARNING, 25/25 tests en los tres archivos modificados/creados (contracts + build-app + boundaries), diff autorado de 270/400 líneas (excluyendo lockfile y artefactos OpenSpec). Bajo Node 24.21.0: `pnpm run verify` (lint 4/4, typecheck 6/6, tests 30/30, build 4/4, dependency-cruise limpio en 44 módulos/49 dependencias, boundary tests 11/11) e `pnpm run install:verify` (lockfile congelado, 5 proyectos del workspace ya actualizados) pasaron sin errores, re-ejecutados en esta sesión antes de commitear.

**Advertencia no bloqueante:** persisten 3 warnings preexistentes de `@typescript-eslint/no-unused-vars` en infraestructura web sin relación con este cambio.

## Estado de entrega

- Commit `bebb50a` en la rama `Vaqcrow#116_Task_Add_correlation_id_helper_to_packages_contracts`, pusheado y con **PR #121** abierto contra `main`: https://github.com/reyduar/Vaqcrow/pull/121.
- El push se hizo por HTTPS usando las credenciales de `gh` (la clave SSH no estaba disponible en este entorno de trabajo), sin modificar la configuración git persistente del repositorio.
- El issue #116 se movió a **"In review"** en el tablero Vaqcrow-TFM (proyecto #4), con el PR #121 ya vinculado automáticamente por GitHub al abrir la rama con el nombre del issue.
- El cambio SDD `correlation-id-helper` ya fue archivado (`sdd-archive`); sus 7 fases quedan persistidas en Engram bajo los topic keys `sdd/correlation-id-helper/{exploration,proposal,spec,design,tasks,apply-progress,verify-report}`, con `sdd/correlation-id-helper/archive-report` como índice de trazabilidad — no en archivos del repositorio.

## Qué queda desbloqueado

Con Zod 4 ya adoptado como dependencia directa y catalogada en `packages/contracts`, el issue #38 (schemas de dominio/eventos compartidos) puede reutilizar la misma versión sin evaluar un segundo validador. El correlation ID generado por el servidor y propagado en `x-correlation-id` también queda disponible como base para que #98 (telemetría de resiliencia) correlacione logs y métricas por request sin tener que definir su propio mecanismo de identidad.

## Próximos pasos sugeridos

1. Revisar y mergear el PR #121.
2. Al implementar #38, reutilizar el catalog entry `zod: ^4.6.5` en lugar de evaluar otra librería de validación.
3. Definir como decisión explícita separada si se acepta y valida un `x-correlation-id` entrante (política de confianza), ya que este cambio solo genera IDs server-side.
4. Evaluar nuevamente si conviene un workflow de CI (`.github/workflows/*`) que corra `pnpm run verify` en cada PR — sigue diferido desde #110.
