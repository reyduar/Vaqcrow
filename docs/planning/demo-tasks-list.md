# Hoja de ruta ejecutable para completar la demo de Vaqcrow

Este documento convierte el backlog canónico de GitHub en una secuencia humana de ejecución verificable. Incluye en su inventario los 108 ítems de tipo Issue de `reyduar/Vaqcrow` presentes en el Project canónico `Vaqcrow-TFM` #4: 8 Epics, 24 Features y 76 Tasks. El estado y las relaciones se verificaron el 18 de septiembre de 2026; 89 issues están en `Backlog`, 2 en `Ready` y 17 en `Done`. El incremento corresponde a [#134](https://github.com/reyduar/Vaqcrow/issues/134), cuya pertenencia y workflow `Backlog` se verificaron directamente en el Project #4.

## Comenzar aquí

> **Unidades actualmente `Ready`: [#44 — Implementar configuración tipada y límites de secretos](#^issue-44) y [#47 — Implementar la configuración de pruebas determinísticas y gates de CI](#^issue-47).**
>
> [#55](#^issue-55) quedó en `Done` (PR [#146](https://github.com/reyduar/Vaqcrow/pull/146) mergeada, tras un ciclo verify→fix→re-verify que corrigió un conteo de tests invertido en la prosa del §4.1), documentando la evidencia completa de avisos de confianza y fixtures sintéticos. Eso cerró [#17](#^issue-17) por completo (sus tres Tasks — [#53](#^issue-53), [#54](#^issue-54) y [#55](#^issue-55) — ya están en `Done`), cerrado manualmente el 18/09/2026 (GitHub no cierra Features automáticamente al completarse sus sub-issues, igual que ocurrió con [#16](#^issue-16)). [#18](#^issue-18) sigue bloqueado: además de [#17](#^issue-17) depende de [#13](#^issue-13), aún en `Backlog`. [#30](#^issue-30) sigue bloqueado por [#20](#^issue-20), [#24](#^issue-24) y [#28](#^issue-28), aún en `Backlog`. [#44](#^issue-44) y [#47](#^issue-47) siguen disponibles en paralelo si hay capacidad.

> **Gate compartido antes de dependencias.** Antes de instalar o configurar cualquier dependencia nombrada, buscar skills disponibles —rutas inyectadas, luego registro o fallback— e inspeccionar los servidores MCP conectados. Usar el soporte aplicable y registrar la skill/MCP utilizada o `none` antes de modificar manifest o lockfile. El descubrimiento no autoriza dependencias, configuración MCP ni crecimiento de alcance adicionales.

## Política de orden

1. Respetar primero el orden topológico de las dependencias nativas de GitHub. Una prioridad **nunca** permite adelantar trabajo bloqueado.
2. Entre unidades simultáneamente listas, ejecutar `Critical` antes que `High`, y `High` antes que `Medium`.
3. Si la prioridad coincide, preferir la unidad que desbloquea más dependientes directos.
4. Si todavía hay empate, usar el número de issue ascendente para obtener un orden determinístico.

Las olas no son barreras globales: una unidad puede comenzar en cuanto se completen **sus** prerrequisitos, aunque continúe trabajo independiente de una ola anterior. Las Tasks de un Feature no se programan hasta que hayan finalizado los Features que lo bloquean. Dentro de cada Feature, la secuencia habitual es implementación → pruebas → evidencia.

## Uso de ramas

- Las ramas de **Feature** son ramas de integración y seguimiento; no sustituyen las Tasks revisables.
- Las ramas de **Task** representan unidades de implementación revisables y deben conservar código, pruebas y documentación de su unidad cuando corresponda.
- Los **Epics** son contenedores de seguimiento: nunca se implementan directamente y no reciben rama de implementación.
- Todos los nombres de rama de este documento son **propuestas**. Esta tarea documental no crea ninguna rama.

Convención: `Vaqcrow#<número>_Feat_<título original normalizado>` para Features y `Vaqcrow#<número>_Task_<título original normalizado>` para Tasks. Se elimina el prefijo `Feature: ` o `Task: `, se sustituyen espacios y puntuación por `_`, y se conserva la escritura inglesa original; el `#` del prefijo se mantiene literalmente.

## Índice estable por olas de ejecución

### Contenedores de planificación

| Epic | Features contenidos |
|---|---|
| [#3 Fundamentos de la demo y monorepo (duplicado sin descomposición)](#^issue-3) | Ninguno; duplica el alcance de #4 |
| [#4 Fundamentos de la demo y monorepo](#^issue-4) | #11–#15 |
| [#5 Estructura de la demo y experiencia de confianza](#^issue-5) | #16–#19 |
| [#6 Evaluación explicable con IA](#^issue-6) | #20–#22 |
| [#7 Fondeo y confirmación en Stellar](#^issue-7) | #23–#25 |
| [#8 Cálculo y distribución de revenue share](#^issue-8) | #26–#28 |
| [#9 Integración, resiliencia y evidencia](#^issue-9) | #29–#31 |
| [#10 Entrega y presentación de la demo](#^issue-10) | #32–#34 |

### Olas ejecutables

| Ola | Features, en orden dentro de la ola | Tasks del Feature |
|---:|---|---|
| 0 | [#11 Inicializar workspace pnpm/Turborepo](#^issue-11) | [~~#35 Configurar workspace raíz~~](#^issue-35) → ([~~#110 Scaffold de API~~](#^issue-110) y [~~#111 Scaffold web~~](#^issue-111) en paralelo) → [~~#36 Probar límites~~](#^issue-36) → [~~#37 Documentar evidencia~~](#^issue-37) |
| 1 | [#12 Definir estados y contratos](#^issue-12) | [~~#38 Implementar ciclo mínimo de revisión~~](#^issue-38) → [~~#39 Probar~~](#^issue-39) → [~~#40 Documentar~~](#^issue-40) |
| 1 | [#15 Configurar pruebas y CI](#^issue-15) | [#47 Implementar](#^issue-47) → [#48 Probar](#^issue-48) → [#49 Documentar](#^issue-49) |
| 1 | [#14 Establecer configuración y secretos](#^issue-14) | [#44 Implementar](#^issue-44) → [#45 Probar](#^issue-45) → [#46 Documentar](#^issue-46) |
| 1 | Task sin padre | [~~#116 Agregar una utilidad de identificador de correlación a `packages/contracts`~~](#^issue-116), completada después de #110 y coordinada con #38 |
| 2 | [#16 Construir shell y navegación](#^issue-16) | [#50 Implementar](#^issue-50) → [#51 Probar](#^issue-51) → [#52 Documentar](#^issue-52) |
| 2 | [#20 Definir esquema y guardrails de IA](#^issue-20) | [#65 Implementar](#^issue-65) → [#66 Probar](#^issue-66) → [#67 Documentar](#^issue-67) |
| 2 | [#23 Encapsular Stellar y Freighter](#^issue-23) | [#74 Implementar](#^issue-74) → [#75 Probar](#^issue-75) → [#76 Documentar](#^issue-76) |
| 2 | [#13 Crear persistencia en Supabase](#^issue-13) | [#41 Implementar](#^issue-41) → [#42 Probar](#^issue-42) → [#43 Documentar](#^issue-43) |
| 3 | [#24 Construir y enviar intención de fondeo](#^issue-24) | [#77 Implementar](#^issue-77) → [#78 Probar](#^issue-78) → [#79 Documentar](#^issue-79) |
| 3 | [#17 Implementar avisos y fixtures](#^issue-17) | [#53 Implementar](#^issue-53) → [#54 Probar](#^issue-54) → [#55 Documentar](#^issue-55) |
| 3 | [#21 Implementar adaptador LLM](#^issue-21) | [#68 Implementar](#^issue-68) → [#69 Probar](#^issue-69) → [#70 Documentar](#^issue-70) |
| 3 | [#26 Implementar feed mensual](#^issue-26) | [#83 Implementar](#^issue-83) → [#84 Probar](#^issue-84) → [#85 Documentar](#^issue-85) |
| 4 | [#27 Calcular revenue share](#^issue-27) | [#86 Implementar](#^issue-86) → [#87 Probar](#^issue-87) → [#88 Documentar](#^issue-88) |
| 4 | [#18 Implementar solicitud y revisión](#^issue-18) | [#56 Implementar](#^issue-56) → [#57 Probar](#^issue-57) → [#58 Documentar](#^issue-58) |
| 4 | [#22 Derivar fallos de IA](#^issue-22) | [#71 Implementar](#^issue-71) → [#72 Probar](#^issue-72) → [#73 Documentar](#^issue-73) |
| 4 | [#25 Confirmar transacciones](#^issue-25) | [#80 Implementar](#^issue-80) → [#81 Probar](#^issue-81) → [#82 Documentar](#^issue-82) |
| 5 | [#28 Distribuir revenue share](#^issue-28) | [#89 Implementar](#^issue-89) → [#90 Probar](#^issue-90) → [#91 Documentar](#^issue-91) |
| 5 | [#19 Implementar aprobación humana](#^issue-19) | [#62 Implementar](#^issue-62) → [#63 Probar](#^issue-63) → [#64 Documentar](#^issue-64) |
| 6 | [#30 Integrar el recorrido vertical](#^issue-30) | [#95 Implementar](#^issue-95) → [#96 Probar](#^issue-96) → [#97 Documentar](#^issue-97) |
| 6 | [#29 Exponer dashboard de evidencia](#^issue-29) | [#92 Implementar](#^issue-92) → [#93 Probar](#^issue-93) → [#94 Documentar](#^issue-94) |
| 7 | [#31 Agregar resiliencia y telemetría](#^issue-31) | [#98 Implementar](#^issue-98) → [#99 Probar](#^issue-99) → [#100 Documentar](#^issue-100) |
| 7 | [#32 Preparar entornos de despliegue](#^issue-32) | [#101 Implementar](#^issue-101) → [#102 Probar](#^issue-102) → [#103 Documentar](#^issue-103) |
| 8 | [#33 Ensayar y empaquetar evidencia](#^issue-33) | [#104 Implementar](#^issue-104) → [#105 Probar](#^issue-105) → [#106 Documentar](#^issue-106) |
| 9 | [#34 Congelar build y presentación](#^issue-34) | [#107 Implementar](#^issue-107) → [#108 Probar](#^issue-108) → [#109 Documentar](#^issue-109) |

### Trabajo transversal fuera del camino crítico de la demo

| Issue | Alcance | Ubicación en la hoja de ruta |
|---|---|---|
| [#134 — Establecer límites de autenticación y sesión con Auth.js](https://github.com/reyduar/Vaqcrow/issues/134) | Auth.js v5 como límite futuro de autenticación/sesión, dependiente de #14; autorización y decisiones permanecen en backend. | Presente en Project #4 con workflow `Backlog`, pero fuera de las olas y del camino crítico acotado hasta una promoción explícita de alcance. |

## Contenedores de planificación

### #3 — Fundamentos de la demo y monorepo (duplicado sin descomposición)

^issue-3

- **Título original:** `Epic: Demo foundation and monorepo`
- **GitHub y estado:** [issue #3](https://github.com/reyduar/Vaqcrow/issues/3) · Tipo `Epic` · Área `infra` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** sin padre, sin Features hijas y sin bloqueos nativos.
- **Objetivo:** establecer workspace, dominio, persistencia, configuración, seguridad, pruebas y CI para la demo.
- **Orden:** repite el título, el objetivo y el alcance de [#4](#^issue-4), pero no contiene su descomposición. Se incluye en el inventario porque permanece como Issue en el Project #4, aunque no constituye una unidad ejecutable.

**Rama propuesta.** No se crea una rama de implementación: este Epic no tiene trabajo hijo y duplica el contenedor canónico [#4](#^issue-4).

### #4 — Fundamentos de la demo y monorepo

^issue-4

- **Título original:** `Epic: Demo foundation and monorepo`
- **GitHub y estado:** [issue #4](https://github.com/reyduar/Vaqcrow/issues/4) · Tipo `Epic` · Área `infra` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** sin padre y sin bloqueos nativos; contiene [#11](#^issue-11), [#12](#^issue-12), [#13](#^issue-13), [#14](#^issue-14) y [#15](#^issue-15).
- **Objetivo:** establecer workspace, dominio, persistencia, configuración, seguridad, pruebas y CI para la demo.
- **Orden:** agrupa la base técnica; no constituye una unidad ejecutable.

**Rama propuesta.** No se crea una rama de implementación: este Epic es un contenedor de seguimiento y nunca debe implementarse directamente.

### #5 — Estructura de la demo y experiencia de confianza

^issue-5

- **Título original:** `Epic: Demo shell and trust experience`
- **GitHub y estado:** [issue #5](https://github.com/reyduar/Vaqcrow/issues/5) · Tipo `Epic` · Área `demo` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** sin padre y sin bloqueos nativos; contiene [#16](#^issue-16), [#17](#^issue-17), [#18](#^issue-18) y [#19](#^issue-19).
- **Objetivo:** entregar la demo navegable de seis pasos con avisos sobre datos sintéticos y control humano.
- **Orden:** agrupa la experiencia y sus garantías; no constituye una unidad ejecutable.

**Rama propuesta.** No se crea una rama de implementación: este Epic es un contenedor de seguimiento y nunca debe implementarse directamente.

### #6 — Evaluación explicable con IA

^issue-6

- **Título original:** `Epic: Explainable AI assessment`
- **GitHub y estado:** [issue #6](https://github.com/reyduar/Vaqcrow/issues/6) · Tipo `Epic` · Área `ai` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** sin padre y sin bloqueos nativos; contiene [#20](#^issue-20), [#21](#^issue-21) y [#22](#^issue-22).
- **Objetivo:** implementar una evaluación estructurada real con evidencia, guardrails y fallback manual.
- **Orden:** agrupa la capacidad de IA; no constituye una unidad ejecutable.

**Rama propuesta.** No se crea una rama de implementación: este Epic es un contenedor de seguimiento y nunca debe implementarse directamente.

### #7 — Fondeo y confirmación en Stellar

^issue-7

- **Título original:** `Epic: Stellar funding and confirmation`
- **GitHub y estado:** [issue #7](https://github.com/reyduar/Vaqcrow/issues/7) · Tipo `Epic` · Área `stellar` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** sin padre y sin bloqueos nativos; contiene [#23](#^issue-23), [#24](#^issue-24) y [#25](#^issue-25).
- **Objetivo:** implementar fondeo no custodial con Freighter, verificación de XDR, envío a Testnet y confirmación de Horizon.
- **Orden:** agrupa el camino de fondeo; no constituye una unidad ejecutable.

**Rama propuesta.** No se crea una rama de implementación: este Epic es un contenedor de seguimiento y nunca debe implementarse directamente.

### #8 — Cálculo y distribución de revenue share

^issue-8

- **Título original:** `Epic: Revenue-share calculation and distribution`
- **GitHub y estado:** [issue #8](https://github.com/reyduar/Vaqcrow/issues/8) · Tipo `Epic` · Área `stellar` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** sin padre y sin bloqueos nativos; contiene [#26](#^issue-26), [#27](#^issue-27) y [#28](#^issue-28).
- **Objetivo:** implementar ventas sintéticas, cálculo determinístico y distribución en Testnet.
- **Orden:** agrupa el camino de revenue share; no constituye una unidad ejecutable.

**Rama propuesta.** No se crea una rama de implementación: este Epic es un contenedor de seguimiento y nunca debe implementarse directamente.

### #9 — Integración, resiliencia y evidencia

^issue-9

- **Título original:** `Epic: Integration, resilience and evidence`
- **GitHub y estado:** [issue #9](https://github.com/reyduar/Vaqcrow/issues/9) · Tipo `Epic` · Área `demo` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** sin padre y sin bloqueos nativos; contiene [#29](#^issue-29), [#30](#^issue-30) y [#31](#^issue-31).
- **Objetivo:** conectar el recorrido vertical y probar comportamiento resiliente, observable y sanitizado.
- **Orden:** agrupa integración y endurecimiento; no constituye una unidad ejecutable.

**Rama propuesta.** No se crea una rama de implementación: este Epic es un contenedor de seguimiento y nunca debe implementarse directamente.

### #10 — Entrega y presentación de la demo

^issue-10

- **Título original:** `Epic: Demo delivery and presentation`
- **GitHub y estado:** [issue #10](https://github.com/reyduar/Vaqcrow/issues/10) · Tipo `Epic` · Área `infra` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** sin padre y sin bloqueos nativos; contiene [#32](#^issue-32), [#33](#^issue-33) y [#34](#^issue-34).
- **Objetivo:** preparar despliegues independientes, runbook, ensayo y paquete final de evidencia.
- **Orden:** agrupa la entrega final; no constituye una unidad ejecutable.

**Rama propuesta.** No se crea una rama de implementación: este Epic es un contenedor de seguimiento y nunca debe implementarse directamente.

## Ola 0 — Bootstrap ejecutable

### #11 — Inicializar el workspace pnpm/Turborepo

^issue-11

- **Título original:** `Feature: Bootstrap pnpm/Turborepo workspace`
- **GitHub y estado:** [issue #11](https://github.com/reyduar/Vaqcrow/issues/11) · Tipo `Feature` · Área `infra` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#4](#^issue-4); sin bloqueos nativos.
- **Objetivo:** establecer un workspace raíz reproducible con `apps/api` y `apps/web` independientes, Clean Architecture pragmática y un modelo deliberadamente estrecho de código compartido.
- **Orden:** abre el grafo y desbloquea [#12](#^issue-12), [#14](#^issue-14), [#15](#^issue-15) y [#16](#^issue-16).

**Rama propuesta.** `Vaqcrow#11_Feat_Bootstrap_pnpm_Turborepo_workspace` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### ~~#35 — Configurar el workspace raíz pnpm/Turborepo~~

^issue-35

- **Título original:** `Task: Configure the root pnpm/Turborepo workspace`
- **GitHub y estado:** [issue #35](https://github.com/reyduar/Vaqcrow/issues/35) · Tipo `Task` · Área `infra` · Prioridad `Critical` · Workflow `Done`.
- **Jerarquía y bloqueos:** padre [#11](#^issue-11), cuyo Feature no tiene prerrequisitos; sin bloqueos nativos.
- **Objetivo:** configurar solo la base raíz de pnpm/Turborepo, los límites de paquetes, el tooling compartido y los manifests necesarios para crear después API y web de forma independiente.
- **Orden:** fue la primera unidad ejecutable y desbloqueó en paralelo [#110](#^issue-110) y [#111](#^issue-111).

**Rama propuesta.** `Vaqcrow#35_Task_Configure_the_root_pnpm_Turborepo_workspace` es una unidad de implementación revisable.

### ~~#110 — Crear la estructura base de la API Fastify con Clean Architecture~~

^issue-110

- **Título original:** `Task: Scaffold the Fastify API with Clean Architecture`
- **GitHub y estado:** [issue #110](https://github.com/reyduar/Vaqcrow/issues/110) · Tipo `Task` · Área `backend` · Prioridad `Critical` · Workflow `Done`.
- **Jerarquía y bloqueos:** padre [#11](#^issue-11), cuyo Feature no tiene prerrequisitos; bloqueada nativamente por [#35](#^issue-35).
- **Objetivo:** crear `apps/api` como aplicación Fastify independiente con límites de dominio y aplicación orientados hacia dentro y adaptadores de infraestructura hacia fuera.
- **Orden:** se completó en paralelo con [#111](#^issue-111); ambas dejan a [#36](#^issue-36) como siguiente unidad por dependencias.

**Rama propuesta.** `Vaqcrow#110_Task_Scaffold_the_Fastify_API_with_Clean_Architecture` es una unidad de implementación revisable.

### ~~#111 — Crear la estructura base de la web Next.js con Clean Architecture~~

^issue-111

- **Título original:** `Task: Scaffold the Next.js web app with Clean Architecture`
- **GitHub y estado:** [issue #111](https://github.com/reyduar/Vaqcrow/issues/111) · Tipo `Task` · Área `frontend` · Prioridad `Critical` · Workflow `Done`.
- **Jerarquía y bloqueos:** padre [#11](#^issue-11), cuyo Feature no tiene prerrequisitos; bloqueada nativamente por [#35](#^issue-35).
- **Objetivo:** crear `apps/web` como aplicación Next.js independiente, organizada para presentación, orquestación frontend, estado de cliente y adaptadores de navegador sin copiar las capas del backend.
- **Orden:** se completó en paralelo con [#110](#^issue-110); ambas dejan a [#36](#^issue-36) como siguiente unidad por dependencias.

**Rama propuesta.** `Vaqcrow#111_Task_Scaffold_the_Next_js_web_app_with_Clean_Architecture` es una unidad de implementación revisable.

### ~~#36 — Probar el workspace y los límites de Clean Architecture~~

^issue-36

- **Título original:** `Task: Test workspace and Clean Architecture boundaries`
- **GitHub y estado:** [issue #36](https://github.com/reyduar/Vaqcrow/issues/36) · Tipo `Task` · Área `infra` · Prioridad `Critical` · Workflow `Done`.
- **Jerarquía y bloqueos:** padre [#11](#^issue-11), cuyo Feature no tiene prerrequisitos; bloqueada nativamente por [#110](#^issue-110) y [#111](#^issue-111).
- **Objetivo:** verificar la reproducibilidad del workspace y los límites independientes de Clean Architecture de la API Fastify y la web Next.js una vez presentes ambos scaffolds.
- **Orden:** consolida las dos ramas paralelas y desbloquea [#37](#^issue-37).

**Rama e implementación.** `Vaqcrow#36_Task_Test_workspace_and_Clean_Architecture_boundaries`, mergeada vía [PR #122](https://github.com/reyduar/Vaqcrow/pull/122). Fixture-probó las 9 reglas de `dependency-cruiser` (5 ya cubiertas + 4 sin cobertura previa) y corrigió, con aprobación explícita del usuario, un bug de regex de doble barra que dejaba 4 de 8 ramas de proveedores sin matchear. Evidencia completa en [`workspace-boundary-enforcement.md`](./workspace-boundary-enforcement.md).

### ~~#37 — Documentar evidencia del workspace pnpm/Turborepo~~

^issue-37

- **Título original:** `Task: Document evidence for the pnpm/Turborepo workspace`
- **GitHub y estado:** [issue #37](https://github.com/reyduar/Vaqcrow/issues/37) · Tipo `Task` · Área `infra` · Prioridad `Critical` · Workflow `Done`.
- **Jerarquía y bloqueos:** padre [#11](#^issue-11), cuyo Feature no tiene prerrequisitos; bloqueada nativamente por [#36](#^issue-36), ya en `Done`.
- **Objetivo:** registrar evidencia concisa y reproducible del workspace raíz, los scaffolds independientes, sus límites arquitectónicos y el límite de contratos compartidos.
- **Orden:** cierra el trabajo ejecutable de [#11](#^issue-11) y habilita sus dependientes [#12](#^issue-12), [#14](#^issue-14), [#15](#^issue-15) y [#16](#^issue-16).

**Rama e implementación.** `Vaqcrow#37_Task_Document_evidence_for_the_pnpm_Turborepo_workspace`. Evidencia completa en [`document-workspace-evidence.md`](./document-workspace-evidence.md); `pnpm run verify` pasa en cero violaciones tras agregar el documento. Commit y Pull Request quedan como paso explícito posterior a esta implementación.

## Ola 1 — Contratos, calidad y configuración

### #12 — Definir estados de dominio y contratos compartidos

^issue-12

- **Título original:** `Feature: Define domain states and shared contracts`
- **GitHub y estado:** [issue #12](https://github.com/reyduar/Vaqcrow/issues/12) · Tipo `Feature` · Área `backend` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#4](#^issue-4); bloqueada nativamente por [#11](#^issue-11).
- **Objetivo:** definir máquinas de estado tipadas, identificadores y esquemas normalizados para API, eventos y adaptadores.
- **Orden:** desbloquea [#13](#^issue-13), [#16](#^issue-16), [#20](#^issue-20) y [#27](#^issue-27), la mayor cantidad de dependientes de esta ola.

**Rama propuesta.** `Vaqcrow#12_Feat_Define_domain_states_and_shared_contracts` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### ~~#38 — Implementar el ciclo mínimo de revisión de solicitudes y su contrato compartido~~

^issue-38

- **Título original:** `Task: Implement the minimal application-review lifecycle and shared contract`
- **GitHub y estado:** [issue #38](https://github.com/reyduar/Vaqcrow/issues/38) · Tipo `Task` · Área `backend` · Prioridad `Critical` · Workflow `Done`.
- **Jerarquía y bloqueos:** padre [#12](#^issue-12); dependencia textual [#37](#^issue-37), completada; relacionado con [#116](#^issue-116), completado, para reutilizar Zod 4 y la base de `CorrelationId` sin duplicarla.
- **Objetivo:** implementar el ciclo autoritativo mínimo de revisión de solicitudes, un `ApplicationId` opaco validable en runtime y schemas estrictos de estado y snapshot, manteniendo separados el dominio en `packages/domain` y el protocolo portable en `packages/contracts`.
- **Orden:** inició [#12](#^issue-12) y desbloqueó [#39](#^issue-39); excluyó evaluación con IA, persistencia, Stellar y telemetría.

**Rama e implementación.** `Vaqcrow#38_Task_Implement_the_minimal_application_review_lifecycle_and_shared_contract`, mergeada vía [PR #125](https://github.com/reyduar/Vaqcrow/pull/125). Ciclo SDD completo (explore→propose→spec→design→tasks→apply→verify→archive) con `sdd-verify` independiente en PASS (0 crítico/0 warning). Evidencia completa en [`application-review-lifecycle-evidence.md`](./application-review-lifecycle-evidence.md).

### ~~#39 — Probar exhaustivamente el ciclo de revisión de solicitudes y su contrato compartido~~

^issue-39

- **Título original:** `Task: Exhaustively test the application-review lifecycle and shared contract`
- **GitHub y estado:** [issue #39](https://github.com/reyduar/Vaqcrow/issues/39) · Tipo `Task` · Área `backend` · Prioridad `Critical` · Workflow `Done`.
- **Jerarquía y bloqueos:** padre [#12](#^issue-12), que requiere [#11](#^issue-11); depende de [#38](#^issue-38), completada.
- **Objetivo:** probar la matriz exhaustiva de las 36 combinaciones `(from, to)` de estados, la equivalencia de vocabulario entre `packages/domain` y `packages/contracts`, y un round-trip realista (`contracts` parsea → `domain` transiciona → `contracts` revalida) — alcance que #38 dejó explícitamente diferido a esta unidad.
- **Orden:** valida la implementación de [#38](#^issue-38) y desbloqueó [#40](#^issue-40).

**Rama e implementación.** `Vaqcrow#39_Task_Test_domain_states_and_shared_contracts`, mergeada vía [PR #126](https://github.com/reyduar/Vaqcrow/pull/126). Ciclo SDD completo (explore→propose→spec→design→tasks→apply→verify→archive) con `sdd-verify` independiente en PASS (0 crítico/0 warning/0 sugerencia). Cambio solo de tests, sin modificaciones a código de producción. Evidencia completa en [`application-review-lifecycle-testing-evidence.md`](./application-review-lifecycle-testing-evidence.md).

### ~~#40 — Documentar evidencia de estados de dominio y contratos compartidos~~

^issue-40

- **Título original:** `Task: Document evidence for domain states and shared contracts`
- **GitHub y estado:** [issue #40](https://github.com/reyduar/Vaqcrow/issues/40) · Tipo `Task` · Área `backend` · Prioridad `Critical` · Workflow `Done`.
- **Jerarquía y bloqueos:** padre [#12](#^issue-12), que requiere [#11](#^issue-11); dependía de [#39](#^issue-39), completada.
- **Objetivo:** registrar evidencia de verificación, límites operativos y resultado visible de la demo.
- **Orden:** cierra [#12](#^issue-12) y habilita [#13](#^issue-13), [#16](#^issue-16), [#20](#^issue-20) y [#27](#^issue-27).

**Rama e implementación.** `Vaqcrow#40_Task_Document_evidence_for_domain_states_and_shared_contracts`, mergeada vía [PR #127](https://github.com/reyduar/Vaqcrow/pull/127). Ciclo SDD completo (explore→propose→spec→design→tasks→apply→verify→archive) con `sdd-verify` independiente en PASS (0 crítico/0 warning/2 sugerencias no bloqueantes). Cambio solo de documentación, sin modificaciones a código de producción. Evidencia completa en [`domain-states-and-shared-contracts-evidence.md`](./domain-states-and-shared-contracts-evidence.md).

### #15 — Configurar pruebas determinísticas y gates de CI

^issue-15

- **Título original:** `Feature: Set up deterministic testing and CI gates`
- **GitHub y estado:** [issue #15](https://github.com/reyduar/Vaqcrow/issues/15) · Tipo `Feature` · Área `testing` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#4](#^issue-4); bloqueada nativamente por [#11](#^issue-11).
- **Objetivo:** configurar Vitest, Testing Library, Playwright y gates de calidad de PR con dobles locales.
- **Orden:** entre los Features `High` de la ola desbloquea más dependientes: [#20](#^issue-20) y [#32](#^issue-32).

**Rama propuesta.** `Vaqcrow#15_Feat_Set_up_deterministic_testing_and_CI_gates` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #47 — Implementar la configuración de pruebas determinísticas y gates de CI

^issue-47

- **Título original:** `Task: Implement set up deterministic testing and ci gates`
- **GitHub y estado:** [issue #47](https://github.com/reyduar/Vaqcrow/issues/47) · Tipo `Task` · Área `testing` · Prioridad `High` · Workflow `Ready`.
- **Jerarquía y bloqueos:** padre [#15](#^issue-15), que requiere [#11](#^issue-11), ya en `Done`; sin bloqueos nativos propios.
- **Objetivo:** entregar el slice de implementación delimitado para pruebas determinísticas y gates de CI.
- **Requisitos técnicos confirmados:** usar [Playwright](https://playwright.dev/) para browser E2E determinístico con fixtures o dobles locales; los checks de pull request no dependen de servicios externos vivos. Aplicar el gate compartido de skills/MCP antes de cualquier cambio de manifest o lockfile y registrar el soporte usado o `none`.
- **Orden:** inicia el Feature y desbloquea [#48](#^issue-48).

**Rama propuesta.** `Vaqcrow#47_Task_Implement_set_up_deterministic_testing_and_ci_gates` es una unidad de implementación revisable.

### #48 — Probar la configuración de pruebas determinísticas y gates de CI

^issue-48

- **Título original:** `Task: Test set up deterministic testing and ci gates`
- **GitHub y estado:** [issue #48](https://github.com/reyduar/Vaqcrow/issues/48) · Tipo `Task` · Área `testing` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#15](#^issue-15), que requiere [#11](#^issue-11); bloqueada nativamente por [#47](#^issue-47).
- **Objetivo:** probar el slice con comprobaciones determinísticas, sin depender de servicios externos vivos.
- **Orden:** valida la implementación y desbloquea [#49](#^issue-49).

**Rama propuesta.** `Vaqcrow#48_Task_Test_set_up_deterministic_testing_and_ci_gates` es una unidad de pruebas revisable.

### #49 — Documentar evidencia de pruebas determinísticas y gates de CI

^issue-49

- **Título original:** `Task: Document evidence set up deterministic testing and ci gates`
- **GitHub y estado:** [issue #49](https://github.com/reyduar/Vaqcrow/issues/49) · Tipo `Task` · Área `testing` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#15](#^issue-15), que requiere [#11](#^issue-11); bloqueada nativamente por [#48](#^issue-48).
- **Objetivo:** capturar evidencia reproducible de finalización de las pruebas determinísticas y los gates de CI.
- **Orden:** cierra [#15](#^issue-15) y habilita [#20](#^issue-20) y [#32](#^issue-32).

**Rama propuesta.** `Vaqcrow#49_Task_Document_evidence_set_up_deterministic_testing_and_ci_gates` es una unidad de documentación revisable.

### #14 — Establecer configuración tipada y límites de secretos

^issue-14

- **Título original:** `Feature: Establish typed configuration and secret boundaries`
- **GitHub y estado:** [issue #14](https://github.com/reyduar/Vaqcrow/issues/14) · Tipo `Feature` · Área `security` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#4](#^issue-4); bloqueada nativamente por [#11](#^issue-11).
- **Objetivo:** validar valores de entorno y mantener secretos de servidor fuera de bundles de navegador y logs.
- **Orden:** sigue a [#15](#^issue-15) por cantidad de dependientes y desbloquea [#23](#^issue-23).

**Rama propuesta.** `Vaqcrow#14_Feat_Establish_typed_configuration_and_secret_boundaries` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #44 — Implementar configuración tipada y límites de secretos

^issue-44

- **Título original:** `Task: Implement typed configuration and secret boundaries`
- **GitHub y estado:** [issue #44](https://github.com/reyduar/Vaqcrow/issues/44) · Tipo `Task` · Área `security` · Prioridad `High` · Workflow `Ready`.
- **Jerarquía y bloqueos:** padre [#14](#^issue-14), que requiere [#11](#^issue-11), ya en `Done`; sin bloqueos nativos propios.
- **Objetivo:** implementar el comportamiento y el contrato centrales del Feature de configuración y secretos.
- **Orden:** inicia el Feature y desbloquea [#45](#^issue-45).

**Rama propuesta.** `Vaqcrow#44_Task_Implement_typed_configuration_and_secret_boundaries` es una unidad de implementación revisable.

### #45 — Probar la configuración tipada y los límites de secretos

^issue-45

- **Título original:** `Task: Test establish typed configuration and secret boundaries`
- **GitHub y estado:** [issue #45](https://github.com/reyduar/Vaqcrow/issues/45) · Tipo `Task` · Área `security` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#14](#^issue-14), que requiere [#11](#^issue-11); bloqueada nativamente por [#44](#^issue-44).
- **Objetivo:** demostrar el slice mediante pruebas determinísticas focalizadas.
- **Orden:** valida la implementación y desbloquea [#46](#^issue-46).

**Rama propuesta.** `Vaqcrow#45_Task_Test_establish_typed_configuration_and_secret_boundaries` es una unidad de pruebas revisable.

### #46 — Documentar evidencia de configuración tipada y límites de secretos

^issue-46

- **Título original:** `Task: Document evidence establish typed configuration and secret boundaries`
- **GitHub y estado:** [issue #46](https://github.com/reyduar/Vaqcrow/issues/46) · Tipo `Task` · Área `security` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#14](#^issue-14), que requiere [#11](#^issue-11); bloqueada nativamente por [#45](#^issue-45).
- **Objetivo:** capturar evidencia de finalización reproducible sin exponer secretos ni resultados no observados.
- **Orden:** cierra [#14](#^issue-14) y habilita [#23](#^issue-23).

**Rama propuesta.** `Vaqcrow#46_Task_Document_evidence_establish_typed_configuration_and_secret_boundaries` es una unidad de documentación revisable.

### ~~#116 — Agregar una utilidad de identificador de correlación a `packages/contracts`~~

^issue-116

- **Título original:** `Task: Add correlation-id helper to packages/contracts`
- **GitHub y estado:** [issue #116](https://github.com/reyduar/Vaqcrow/issues/116) · Tipo `Task` · Área `backend` · Prioridad `Medium` · Workflow `Done`.
- **Jerarquía y bloqueos:** sin padre y sin bloqueos nativos. Su sección `Dependencies` declara una dependencia textual de [#110](#^issue-110) y una relación funcional con [#12](#^issue-12) y [#38](#^issue-38); no se inventa una relación padre.
- **Objetivo:** agregar a `packages/contracts` un tipo de identificador de correlación, un generador y un esquema o parser validable en runtime, y demostrar que `apps/api` puede propagar el identificador sin introducir dependencias de framework o proveedor en las capas internas.
- **Orden:** se completó en esta ola como follow-up independiente después de [#110](#^issue-110) y coordinó con [#38](#^issue-38) la elección de la biblioteca de validación para evitar dos soluciones competidoras.

**Rama propuesta.** `Vaqcrow#116_Task_Add_correlation_id_helper_to_packages_contracts` es una unidad de implementación revisable.

## Ola 2 — Shell, IA, Stellar y persistencia

### #16 — Construir la estructura guiada y la navegación de la demo

^issue-16

- **Título original:** `Feature: Build guided demo shell and navigation`
- **GitHub y estado:** [issue #16](https://github.com/reyduar/Vaqcrow/issues/16) · Tipo `Feature` · Área `frontend` · Prioridad `Critical` · Workflow `Done`.
- **Jerarquía y bloqueos:** padre [#5](#^issue-5); bloqueada nativamente por [#11](#^issue-11) y [#12](#^issue-12), ambas completas.
- **Objetivo:** implementar rutas de seis pasos, progreso y estados de carga, error y recuperación.
- **Orden:** desbloquea [#17](#^issue-17) y [#30](#^issue-30).
- **Entrega:** sus tres Tasks completas — [#50](#^issue-50) (implementación, PRs #128-#131), [#51](#^issue-51) (tests, PR #132) y [#52](#^issue-52) (evidencia, PR #133). Cerrado manualmente el 17/09/2026 (GitHub no cierra Features automáticamente al completarse sus sub-issues).

**Rama propuesta.** `Vaqcrow#16_Feat_Build_guided_demo_shell_and_navigation` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #50 — Implementar la estructura guiada y la navegación de la demo

^issue-50

- **Título original:** `Task: Implement build guided demo shell and navigation`
- **GitHub y estado:** [issue #50](https://github.com/reyduar/Vaqcrow/issues/50) · Tipo `Task` · Área `frontend` · Prioridad `Critical` · Workflow `Done`.
- **Jerarquía y bloqueos:** padre [#16](#^issue-16), ya desbloqueado ([#11](#^issue-11) y [#12](#^issue-12) completas); sin bloqueos nativos propios.
- **Objetivo:** entregar el slice de implementación delimitado para el shell guiado y su navegación.
- **Orden:** inicia el Feature y desbloquea [#51](#^issue-51).
- **Entrega:** 4 PRs encadenadas (stacked-to-main) — [#128](https://github.com/reyduar/Vaqcrow/pull/128) (modelo de navegación), [#129](https://github.com/reyduar/Vaqcrow/pull/129) (hook + componentes del shell), [#130](https://github.com/reyduar/Vaqcrow/pull/130) (boundaries + layout App Router) y [#131](https://github.com/reyduar/Vaqcrow/pull/131) (rutas + redirect raíz), todas mergeadas. Seis rutas: `request → ai-assessment → approval → funding → distribution → evidence`.

**Rama propuesta.** `Vaqcrow#50_Task_Implement_build_guided_demo_shell_and_navigation` es una unidad de implementación revisable.

### #51 — Probar la estructura guiada y la navegación de la demo

^issue-51

- **Título original:** `Task: Test build guided demo shell and navigation`
- **GitHub y estado:** [issue #51](https://github.com/reyduar/Vaqcrow/issues/51) · Tipo `Task` · Área `frontend` · Prioridad `Critical` · Workflow `Done`.
- **Jerarquía y bloqueos:** padre [#16](#^issue-16), que requiere [#11](#^issue-11) y [#12](#^issue-12); bloqueada nativamente por [#50](#^issue-50), ya `Done`.
- **Objetivo:** demostrar el slice mediante pruebas determinísticas focalizadas.
- **Orden:** valida la implementación y desbloquea [#52](#^issue-52).
- **Entrega:** 1 PR — [#132](https://github.com/reyduar/Vaqcrow/pull/132) (mergeada), 292 líneas, 3 archivos nuevos, cero cambios de producción. Cubre traversal real entre los seis pasos y recuperación real del error boundary; delta sobre la misma capability `demo-shell-navigation` de #50.

**Rama propuesta.** `Vaqcrow#51_Task_Test_build_guided_demo_shell_and_navigation` es una unidad de pruebas revisable.

### #52 — Documentar evidencia de la estructura guiada y la navegación

^issue-52

- **Título original:** `Task: Document evidence build guided demo shell and navigation`
- **GitHub y estado:** [issue #52](https://github.com/reyduar/Vaqcrow/issues/52) · Tipo `Task` · Área `frontend` · Prioridad `Critical` · Workflow `Done`.
- **Jerarquía y bloqueos:** padre [#16](#^issue-16), que requiere [#11](#^issue-11) y [#12](#^issue-12); bloqueada nativamente por [#51](#^issue-51), ya `Done`.
- **Objetivo:** capturar evidencia de finalización reproducible del shell guiado y su navegación.
- **Orden:** cierra [#16](#^issue-16) y habilita [#17](#^issue-17) y [#30](#^issue-30).
- **Entrega:** 1 PR — [#133](https://github.com/reyduar/Vaqcrow/pull/133) (mergeada), `docs/planning/guided-demo-shell-and-navigation-evidence.md`. Ciclo verify→fix→re-verify: el primer verify encontró un comando de sweep en §7 no reproducible (se auto-matcheaba con la prosa del propio documento); corregido con exclusión de glob y re-verificado byte a byte.

**Rama propuesta.** `Vaqcrow#52_Task_Document_evidence_build_guided_demo_shell_and_navigation` es una unidad de documentación revisable.

### #20 — Definir el esquema y los guardrails de evaluación de IA

^issue-20

- **Título original:** `Feature: Define AI assessment schema and guardrails`
- **GitHub y estado:** [issue #20](https://github.com/reyduar/Vaqcrow/issues/20) · Tipo `Feature` · Área `ai` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#6](#^issue-6); bloqueada nativamente por [#12](#^issue-12) y [#15](#^issue-15).
- **Objetivo:** validar evaluación estructurada, referencias de evidencia, incertidumbre y acciones cerradas.
- **Orden:** desbloquea [#21](#^issue-21) y [#30](#^issue-30).

**Rama propuesta.** `Vaqcrow#20_Feat_Define_AI_assessment_schema_and_guardrails` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #65 — Implementar el esquema y los guardrails de evaluación de IA

^issue-65

- **Título original:** `Task: Implement AI assessment schema and guardrails`
- **GitHub y estado:** [issue #65](https://github.com/reyduar/Vaqcrow/issues/65) · Tipo `Task` · Área `ai` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#20](#^issue-20), que requiere [#12](#^issue-12) y [#15](#^issue-15); sin bloqueos nativos propios.
- **Objetivo:** implementar el alcance delimitado del esquema y los guardrails de evaluación de IA.
- **Orden:** inicia el Feature y desbloquea [#66](#^issue-66).

**Rama propuesta.** `Vaqcrow#65_Task_Implement_AI_assessment_schema_and_guardrails` es una unidad de implementación revisable.

### #66 — Probar el esquema y los guardrails de evaluación de IA

^issue-66

- **Título original:** `Task: Test AI assessment schema and guardrails`
- **GitHub y estado:** [issue #66](https://github.com/reyduar/Vaqcrow/issues/66) · Tipo `Task` · Área `ai` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#20](#^issue-20), que requiere [#12](#^issue-12) y [#15](#^issue-15); bloqueada nativamente por [#65](#^issue-65).
- **Objetivo:** demostrar el esquema y los guardrails con pruebas determinísticas.
- **Orden:** valida la implementación y desbloquea [#67](#^issue-67).

**Rama propuesta.** `Vaqcrow#66_Task_Test_AI_assessment_schema_and_guardrails` es una unidad de pruebas revisable.

### #67 — Documentar evidencia del esquema y los guardrails de IA

^issue-67

- **Título original:** `Task: Document evidence for AI assessment schema and guardrails`
- **GitHub y estado:** [issue #67](https://github.com/reyduar/Vaqcrow/issues/67) · Tipo `Task` · Área `ai` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#20](#^issue-20), que requiere [#12](#^issue-12) y [#15](#^issue-15); bloqueada nativamente por [#66](#^issue-66).
- **Objetivo:** documentar evidencia reproducible de finalización del esquema y sus guardrails.
- **Orden:** cierra [#20](#^issue-20) y habilita [#21](#^issue-21) y [#30](#^issue-30).

**Rama propuesta.** `Vaqcrow#67_Task_Document_evidence_for_AI_assessment_schema_and_guardrails` es una unidad de documentación revisable.

### #23 — Encapsular la integración de Stellar y Freighter

^issue-23

- **Título original:** `Feature: Encapsulate Stellar and Freighter integration`
- **GitHub y estado:** [issue #23](https://github.com/reyduar/Vaqcrow/issues/23) · Tipo `Feature` · Área `stellar` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#7](#^issue-7); bloqueada nativamente por [#14](#^issue-14).
- **Objetivo:** encapsular el contexto de Testnet, la obtención de cuenta pública y la firma no custodial.
- **Orden:** desbloquea [#24](#^issue-24) y [#28](#^issue-28).

**Rama propuesta.** `Vaqcrow#23_Feat_Encapsulate_Stellar_and_Freighter_integration` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #74 — Implementar la integración de Stellar y Freighter

^issue-74

- **Título original:** `Task: Implement Stellar and Freighter integration`
- **GitHub y estado:** [issue #74](https://github.com/reyduar/Vaqcrow/issues/74) · Tipo `Task` · Área `stellar` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#23](#^issue-23), que requiere [#14](#^issue-14); sin bloqueos nativos propios.
- **Objetivo:** implementar la integración delimitada de Stellar y Freighter dentro de la arquitectura de demo.
- **Orden:** inicia el Feature y desbloquea [#75](#^issue-75).

**Rama propuesta.** `Vaqcrow#74_Task_Implement_Stellar_and_Freighter_integration` es una unidad de implementación revisable.

### #75 — Probar la integración de Stellar y Freighter

^issue-75

- **Título original:** `Task: Test Stellar and Freighter integration`
- **GitHub y estado:** [issue #75](https://github.com/reyduar/Vaqcrow/issues/75) · Tipo `Task` · Área `stellar` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#23](#^issue-23), que requiere [#14](#^issue-14); bloqueada nativamente por [#74](#^issue-74).
- **Objetivo:** demostrar la integración con pruebas determinísticas sin servicios externos vivos.
- **Orden:** valida la implementación y desbloquea [#76](#^issue-76).

**Rama propuesta.** `Vaqcrow#75_Task_Test_Stellar_and_Freighter_integration` es una unidad de pruebas revisable.

### #76 — Documentar evidencia de la integración de Stellar y Freighter

^issue-76

- **Título original:** `Task: Document evidence for Stellar and Freighter integration`
- **GitHub y estado:** [issue #76](https://github.com/reyduar/Vaqcrow/issues/76) · Tipo `Task` · Área `stellar` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#23](#^issue-23), que requiere [#14](#^issue-14); bloqueada nativamente por [#75](#^issue-75).
- **Objetivo:** documentar evidencia reproducible de finalización de la integración.
- **Orden:** cierra [#23](#^issue-23) y habilita [#24](#^issue-24) y [#28](#^issue-28).

**Rama propuesta.** `Vaqcrow#76_Task_Document_evidence_for_Stellar_and_Freighter_integration` es una unidad de documentación revisable.

### #13 — Crear el esquema Supabase y la persistencia idempotente

^issue-13

- **Título original:** `Feature: Create Supabase schema and idempotent persistence`
- **GitHub y estado:** [issue #13](https://github.com/reyduar/Vaqcrow/issues/13) · Tipo `Feature` · Área `database` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#4](#^issue-4); bloqueada nativamente por [#12](#^issue-12).
- **Objetivo:** persistir casos, evidencia, decisiones, intenciones, transacciones y metadatos de auditoría en Supabase PostgreSQL.
- **Orden:** se ubica después de los `Critical` listos y desbloquea [#18](#^issue-18), [#24](#^issue-24) y [#26](#^issue-26).

**Rama propuesta.** `Vaqcrow#13_Feat_Create_Supabase_schema_and_idempotent_persistence` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #41 — Implementar el esquema Supabase y la persistencia

^issue-41

- **Título original:** `Task: Implement the Supabase schema and persistence`
- **GitHub y estado:** [issue #41](https://github.com/reyduar/Vaqcrow/issues/41) · Tipo `Task` · Área `database` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#13](#^issue-13), que requiere [#12](#^issue-12); sin bloqueos nativos propios.
- **Objetivo:** implementar el comportamiento y el contrato centrales de persistencia del Feature.
- **Orden:** inicia el Feature y desbloquea [#42](#^issue-42).

**Rama propuesta.** `Vaqcrow#41_Task_Implement_the_Supabase_schema_and_persistence` es una unidad de implementación revisable.

### #42 — Probar el esquema Supabase y la persistencia

^issue-42

- **Título original:** `Task: Test the Supabase schema and persistence`
- **GitHub y estado:** [issue #42](https://github.com/reyduar/Vaqcrow/issues/42) · Tipo `Task` · Área `database` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#13](#^issue-13), que requiere [#12](#^issue-12); bloqueada nativamente por [#41](#^issue-41).
- **Objetivo:** añadir pruebas determinísticas focalizadas de éxito, rechazo y recuperación.
- **Orden:** valida la implementación y desbloquea [#43](#^issue-43).

**Rama propuesta.** `Vaqcrow#42_Task_Test_the_Supabase_schema_and_persistence` es una unidad de pruebas revisable.

### #43 — Documentar evidencia del esquema Supabase y la persistencia

^issue-43

- **Título original:** `Task: Document evidence for the Supabase schema and persistence`
- **GitHub y estado:** [issue #43](https://github.com/reyduar/Vaqcrow/issues/43) · Tipo `Task` · Área `database` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#13](#^issue-13), que requiere [#12](#^issue-12); bloqueada nativamente por [#42](#^issue-42).
- **Objetivo:** registrar evidencia de verificación, límites operativos y resultado visible de la demo.
- **Orden:** cierra [#13](#^issue-13) y habilita [#18](#^issue-18), [#24](#^issue-24) y [#26](#^issue-26).

**Rama propuesta.** `Vaqcrow#43_Task_Document_evidence_for_the_Supabase_schema_and_persistence` es una unidad de documentación revisable.

## Ola 3 — Primeros slices funcionales paralelos

### #24 — Construir, verificar y enviar la intención de fondeo

^issue-24

- **Título original:** `Feature: Build, verify and submit funding intent`
- **GitHub y estado:** [issue #24](https://github.com/reyduar/Vaqcrow/issues/24) · Tipo `Feature` · Área `backend` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#7](#^issue-7); bloqueada nativamente por [#13](#^issue-13) y [#23](#^issue-23).
- **Objetivo:** crear una intención de fondeo idempotente, verificar invariantes del XDR y exponer las API de envío y estado.
- **Orden:** tiene prioridad `Critical`, desbloquea [#25](#^issue-25) y [#30](#^issue-30), y usa las dependencias nativas para ordenar.

**Rama propuesta.** `Vaqcrow#24_Feat_Build_verify_and_submit_funding_intent` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #77 — Implementar el envío de intención de fondeo y la verificación de XDR

^issue-77

- **Título original:** `Task: Implement funding intent submission and XDR verification`
- **GitHub y estado:** [issue #77](https://github.com/reyduar/Vaqcrow/issues/77) · Tipo `Task` · Área `backend` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#24](#^issue-24), que requiere [#13](#^issue-13) y [#23](#^issue-23); sin bloqueos nativos propios.
- **Objetivo:** implementar el envío de la intención y la verificación de XDR dentro de la arquitectura delimitada.
- **Orden:** inicia el Feature y desbloquea [#78](#^issue-78).

**Rama propuesta.** `Vaqcrow#77_Task_Implement_funding_intent_submission_and_XDR_verification` es una unidad de implementación revisable.

### #78 — Probar el envío de intención de fondeo y la verificación de XDR

^issue-78

- **Título original:** `Task: Test funding intent submission and XDR verification`
- **GitHub y estado:** [issue #78](https://github.com/reyduar/Vaqcrow/issues/78) · Tipo `Task` · Área `backend` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#24](#^issue-24), que requiere [#13](#^issue-13) y [#23](#^issue-23); bloqueada nativamente por [#77](#^issue-77).
- **Objetivo:** demostrar envío y verificación con pruebas determinísticas de los caminos aplicables.
- **Orden:** valida la implementación y desbloquea [#79](#^issue-79).

**Rama propuesta.** `Vaqcrow#78_Task_Test_funding_intent_submission_and_XDR_verification` es una unidad de pruebas revisable.

### #79 — Documentar evidencia del envío de fondeo y la verificación de XDR

^issue-79

- **Título original:** `Task: Document evidence for funding intent submission and XDR verification`
- **GitHub y estado:** [issue #79](https://github.com/reyduar/Vaqcrow/issues/79) · Tipo `Task` · Área `backend` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#24](#^issue-24), que requiere [#13](#^issue-13) y [#23](#^issue-23); bloqueada nativamente por [#78](#^issue-78).
- **Objetivo:** documentar evidencia reproducible de finalización del envío y la verificación.
- **Orden:** cierra [#24](#^issue-24) y habilita [#25](#^issue-25) y [#30](#^issue-30).

**Rama propuesta.** `Vaqcrow#79_Task_Document_evidence_for_funding_intent_submission_and_XDR_verification` es una unidad de documentación revisable.

### #17 — Implementar avisos de confianza y fixtures sintéticos

^issue-17

- **Título original:** `Feature: Implement trust disclosures and synthetic fixtures`
- **GitHub y estado:** [issue #17](https://github.com/reyduar/Vaqcrow/issues/17) · Tipo `Feature` · Área `demo` · Prioridad `Critical` · Workflow `Done`.
- **Jerarquía y bloqueos:** padre [#5](#^issue-5); bloqueada nativamente por [#16](#^issue-16), ya `Done`.
- **Objetivo:** congelar los fixtures de Panadería Horizonte SRL y mostrar los avisos canónicos `SIMULADO`, `TESTNET` y de no producción.
- **Orden:** desbloquea [#18](#^issue-18) y precede a [#21](#^issue-21) por desempate numérico.
- **Entrega:** sus tres Tasks completas — [#53](#^issue-53) (implementación, PRs #137-#142, con un ciclo de fix por un hallazgo CRITICAL de `sdd-verify`), [#54](#^issue-54) (pruebas, PRs #143-#144) y [#55](#^issue-55) (evidencia, PR #146). Cerrado manualmente el 18/09/2026 (GitHub no cierra Features automáticamente al completarse sus sub-issues).

**Rama propuesta.** `Vaqcrow#17_Feat_Implement_trust_disclosures_and_synthetic_fixtures` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #53 — Implementar avisos de confianza y fixtures sintéticos

^issue-53

- **Título original:** `Task: Implement implement trust disclosures and synthetic fixtures`
- **GitHub y estado:** [issue #53](https://github.com/reyduar/Vaqcrow/issues/53) · Tipo `Task` · Área `demo` · Prioridad `Critical` · Workflow `Done`.
- **Jerarquía y bloqueos:** padre [#17](#^issue-17), que requiere [#16](#^issue-16); sin bloqueos nativos propios.
- **Objetivo:** entregar el slice delimitado de avisos de confianza y fixtures sintéticos.
- **Requisitos técnicos confirmados:** usar [HeroUI](https://www.heroui.com/) para primitivas accesibles, [Tailwind CSS](https://tailwindcss.com/) para tema/tokens centralizados sin constantes visuales locales y [React Icons `io5`](https://react-icons.github.io/react-icons/icons/io5/) para iconos; significado crítico siempre combina texto y semántica accesible. [`VaqcrowWebApp`](https://stitch.withgoogle.com/projects/5439082704079758723) (ID `5439082704079758723`) es referencia visual, y su HTML no es fuente autoritativa de producción. Aplicar el gate compartido de skills/MCP antes de modificar dependencias.
- **Orden:** inicia el Feature y desbloquea [#54](#^issue-54).
- **Entrega:** 5 PRs encadenadas — [#137](https://github.com/reyduar/Vaqcrow/pull/137)-[#141](https://github.com/reyduar/Vaqcrow/pull/141) (foundation → datos → primitivas UI → chrome/rutas → fix de HeroUI). `sdd-verify` encontró 1 CRITICAL (HeroUI instalado pero sin consumir en ningún componente); corregido reescribiendo `Badge`/`TrustBanner` sobre `Chip`/`Alert` de HeroUI y re-verificado limpio.

**Rama propuesta.** `Vaqcrow#53_Task_Implement_implement_trust_disclosures_and_synthetic_fixtures` es una unidad de implementación revisable; conserva literalmente la duplicación `Implement implement` del título original.

### #54 — Probar avisos de confianza y fixtures sintéticos

^issue-54

- **Título original:** `Task: Test trust disclosures and synthetic fixtures`
- **GitHub y estado:** [issue #54](https://github.com/reyduar/Vaqcrow/issues/54) · Tipo `Task` · Área `demo` · Prioridad `Critical` · Workflow `Done`.
- **Jerarquía y bloqueos:** padre [#17](#^issue-17), que requiere [#16](#^issue-16); bloqueada nativamente por [#53](#^issue-53), ya `Done`.
- **Objetivo:** demostrar avisos y fixtures mediante pruebas determinísticas.
- **Orden:** valida la implementación y desbloquea [#55](#^issue-55).
- **Entrega:** 2 PRs encadenadas — [#143](https://github.com/reyduar/Vaqcrow/pull/143) (3 archivos nuevos: `synthetic-value`, `step-disclosures` con tabla independiente por contención, integración cross-route) y [#144](https://github.com/reyduar/Vaqcrow/pull/144) (los 6 `page.test.tsx` reemplazados con aserciones reales). Suite final: 36 archivos / 137 tests.

**Rama propuesta.** `Vaqcrow#54_Task_Test_trust_disclosures_and_synthetic_fixtures` es una unidad de pruebas revisable.

### #55 — Documentar evidencia de avisos de confianza y fixtures sintéticos

^issue-55

- **Título original:** `Task: Document evidence for trust disclosures and synthetic fixtures`
- **GitHub y estado:** [issue #55](https://github.com/reyduar/Vaqcrow/issues/55) · Tipo `Task` · Área `demo` · Prioridad `Critical` · Workflow `Done`.
- **Jerarquía y bloqueos:** padre [#17](#^issue-17), que requiere [#16](#^issue-16); bloqueada nativamente por [#54](#^issue-54), ya `Done`.
- **Objetivo:** capturar evidencia reproducible de finalización de avisos y fixtures.
- **Orden:** cierra [#17](#^issue-17) y habilita [#18](#^issue-18).
- **Entrega:** 1 PR — [#146](https://github.com/reyduar/Vaqcrow/pull/146) (mergeada), `docs/planning/trust-disclosures-and-synthetic-fixtures-evidence.md`. Ciclo verify→fix→re-verify: el primer verify encontró un conteo de tests de `@vaqcrow/api`/`@vaqcrow/contracts` invertido en la prosa del §4.1; corregido en una línea y re-verificado limpio. El barrido de documentos desactualizados detectó que este mismo documento (`demo-tasks-list.md`) seguía marcando #53/#54/#55 como `Backlog`; ese hallazgo quedó registrado en [#145](https://github.com/reyduar/Vaqcrow/issues/145), que este commit resuelve.

**Rama propuesta.** `Vaqcrow#55_Task_Document_evidence_for_trust_disclosures_and_synthetic_fixtures` es una unidad de documentación revisable.

### #21 — Implementar un adaptador LLM reemplazable

^issue-21

- **Título original:** `Feature: Implement replaceable LLM adapter`
- **GitHub y estado:** [issue #21](https://github.com/reyduar/Vaqcrow/issues/21) · Tipo `Feature` · Área `ai` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#6](#^issue-6); bloqueada nativamente por [#20](#^issue-20).
- **Objetivo:** invocar un adaptador independiente del proveedor y persistir metadatos de modelo, prompt y versión.
- **Orden:** desbloquea [#22](#^issue-22).

**Rama propuesta.** `Vaqcrow#21_Feat_Implement_replaceable_LLM_adapter` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #68 — Implementar el adaptador LLM reemplazable

^issue-68

- **Título original:** `Task: Implement replaceable LLM adapter`
- **GitHub y estado:** [issue #68](https://github.com/reyduar/Vaqcrow/issues/68) · Tipo `Task` · Área `ai` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#21](#^issue-21), que requiere [#20](#^issue-20); sin bloqueos nativos propios.
- **Objetivo:** implementar el adaptador LLM reemplazable dentro del límite de la demo.
- **Orden:** inicia el Feature y desbloquea [#69](#^issue-69).

**Rama propuesta.** `Vaqcrow#68_Task_Implement_replaceable_LLM_adapter` es una unidad de implementación revisable.

### #69 — Probar el adaptador LLM reemplazable

^issue-69

- **Título original:** `Task: Test replaceable LLM adapter`
- **GitHub y estado:** [issue #69](https://github.com/reyduar/Vaqcrow/issues/69) · Tipo `Task` · Área `ai` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#21](#^issue-21), que requiere [#20](#^issue-20); bloqueada nativamente por [#68](#^issue-68).
- **Objetivo:** demostrar el adaptador con pruebas determinísticas.
- **Orden:** valida la implementación y desbloquea [#70](#^issue-70).

**Rama propuesta.** `Vaqcrow#69_Task_Test_replaceable_LLM_adapter` es una unidad de pruebas revisable.

### #70 — Documentar evidencia del adaptador LLM reemplazable

^issue-70

- **Título original:** `Task: Document evidence for replaceable LLM adapter`
- **GitHub y estado:** [issue #70](https://github.com/reyduar/Vaqcrow/issues/70) · Tipo `Task` · Área `ai` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#21](#^issue-21), que requiere [#20](#^issue-20); bloqueada nativamente por [#69](#^issue-69).
- **Objetivo:** documentar evidencia reproducible de finalización del adaptador.
- **Orden:** cierra [#21](#^issue-21) y habilita [#22](#^issue-22).

**Rama propuesta.** `Vaqcrow#70_Task_Document_evidence_for_replaceable_LLM_adapter` es una unidad de documentación revisable.

### #26 — Implementar el feed mensual de ventas

^issue-26

- **Título original:** `Feature: Implement monthly sales feed`
- **GitHub y estado:** [issue #26](https://github.com/reyduar/Vaqcrow/issues/26) · Tipo `Feature` · Área `backend` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#8](#^issue-8); bloqueada nativamente por [#13](#^issue-13).
- **Objetivo:** cargar el siguiente período sintético de ventas con procedencia, anomalía conocida y rotulado simulado explícito.
- **Orden:** se ejecuta después de los Features `Critical` listos y desbloquea [#27](#^issue-27).

**Rama propuesta.** `Vaqcrow#26_Feat_Implement_monthly_sales_feed` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #83 — Implementar el feed mensual de ventas

^issue-83

- **Título original:** `Task: Implement monthly sales feed`
- **GitHub y estado:** [issue #83](https://github.com/reyduar/Vaqcrow/issues/83) · Tipo `Task` · Área `backend` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#26](#^issue-26), que requiere [#13](#^issue-13); sin bloqueos nativos propios.
- **Objetivo:** implementar el feed mensual dentro de la arquitectura delimitada de la demo.
- **Orden:** inicia el Feature y desbloquea [#84](#^issue-84).

**Rama propuesta.** `Vaqcrow#83_Task_Implement_monthly_sales_feed` es una unidad de implementación revisable.

### #84 — Probar el feed mensual de ventas

^issue-84

- **Título original:** `Task: Test monthly sales feed`
- **GitHub y estado:** [issue #84](https://github.com/reyduar/Vaqcrow/issues/84) · Tipo `Task` · Área `backend` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#26](#^issue-26), que requiere [#13](#^issue-13); bloqueada nativamente por [#83](#^issue-83).
- **Objetivo:** demostrar el feed con pruebas determinísticas.
- **Orden:** valida la implementación y desbloquea [#85](#^issue-85).

**Rama propuesta.** `Vaqcrow#84_Task_Test_monthly_sales_feed` es una unidad de pruebas revisable.

### #85 — Documentar evidencia del feed mensual de ventas

^issue-85

- **Título original:** `Task: Document evidence for monthly sales feed`
- **GitHub y estado:** [issue #85](https://github.com/reyduar/Vaqcrow/issues/85) · Tipo `Task` · Área `backend` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#26](#^issue-26), que requiere [#13](#^issue-13); bloqueada nativamente por [#84](#^issue-84).
- **Objetivo:** documentar evidencia reproducible de finalización del feed.
- **Orden:** cierra [#26](#^issue-26) y habilita [#27](#^issue-27).

**Rama propuesta.** `Vaqcrow#85_Task_Document_evidence_for_monthly_sales_feed` es una unidad de documentación revisable.

## Ola 4 — Cálculo, revisión y confirmaciones

### #27 — Calcular revenue share versionado de forma determinística

^issue-27

- **Título original:** `Feature: Calculate versioned revenue share deterministically`
- **GitHub y estado:** [issue #27](https://github.com/reyduar/Vaqcrow/issues/27) · Tipo `Feature` · Área `backend` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#8](#^issue-8); bloqueada nativamente por [#12](#^issue-12) y [#26](#^issue-26).
- **Objetivo:** calcular obligaciones con unidades mínimas, reglas versionadas y redondeo explícito, sin usar el LLM.
- **Orden:** tiene prioridad `Critical` y desbloquea [#28](#^issue-28).

**Rama propuesta.** `Vaqcrow#27_Feat_Calculate_versioned_revenue_share_deterministically` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #86 — Implementar el cálculo determinístico de revenue share

^issue-86

- **Título original:** `Task: Implement deterministic revenue-share calculation`
- **GitHub y estado:** [issue #86](https://github.com/reyduar/Vaqcrow/issues/86) · Tipo `Task` · Área `backend` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#27](#^issue-27), que requiere [#12](#^issue-12) y [#26](#^issue-26); sin bloqueos nativos propios.
- **Objetivo:** implementar el cálculo determinístico dentro de la arquitectura delimitada de la demo.
- **Orden:** inicia el Feature y desbloquea [#87](#^issue-87).

**Rama propuesta.** `Vaqcrow#86_Task_Implement_deterministic_revenue_share_calculation` es una unidad de implementación revisable.

### #87 — Probar el cálculo determinístico de revenue share

^issue-87

- **Título original:** `Task: Test deterministic revenue-share calculation`
- **GitHub y estado:** [issue #87](https://github.com/reyduar/Vaqcrow/issues/87) · Tipo `Task` · Área `backend` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#27](#^issue-27), que requiere [#12](#^issue-12) y [#26](#^issue-26); bloqueada nativamente por [#86](#^issue-86).
- **Objetivo:** demostrar el cálculo con pruebas determinísticas.
- **Orden:** valida la implementación y desbloquea [#88](#^issue-88).

**Rama propuesta.** `Vaqcrow#87_Task_Test_deterministic_revenue_share_calculation` es una unidad de pruebas revisable.

### #88 — Documentar evidencia del cálculo determinístico de revenue share

^issue-88

- **Título original:** `Task: Document evidence for deterministic revenue-share calculation`
- **GitHub y estado:** [issue #88](https://github.com/reyduar/Vaqcrow/issues/88) · Tipo `Task` · Área `backend` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#27](#^issue-27), que requiere [#12](#^issue-12) y [#26](#^issue-26); bloqueada nativamente por [#87](#^issue-87).
- **Objetivo:** documentar evidencia reproducible de finalización del cálculo.
- **Orden:** cierra [#27](#^issue-27) y habilita [#28](#^issue-28).

**Rama propuesta.** `Vaqcrow#88_Task_Document_evidence_for_deterministic_revenue_share_calculation` es una unidad de documentación revisable.

### #18 — Implementar la solicitud de PyME y la revisión de evidencia

^issue-18

- **Título original:** `Feature: Implement SME request and evidence review`
- **GitHub y estado:** [issue #18](https://github.com/reyduar/Vaqcrow/issues/18) · Tipo `Feature` · Área `frontend` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#5](#^issue-5); bloqueada nativamente por [#13](#^issue-13) y [#17](#^issue-17).
- **Objetivo:** presentar identidad, KYC/KYB, evidencia de ventas, datos faltantes y referencias de anomalías, todo sintético.
- **Orden:** entre los Features `High` empatados precede por número y desbloquea [#19](#^issue-19).

**Rama propuesta.** `Vaqcrow#18_Feat_Implement_SME_request_and_evidence_review` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #56 — Implementar la solicitud de PyME y la revisión de evidencia

^issue-56

- **Título original:** `Task: Implement SME request and evidence review`
- **GitHub y estado:** [issue #56](https://github.com/reyduar/Vaqcrow/issues/56) · Tipo `Task` · Área `frontend` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#18](#^issue-18), que requiere [#13](#^issue-13) y [#17](#^issue-17); sin bloqueos nativos propios.
- **Objetivo:** capturar la solicitud sintética, historial y evidencia, permitir revisar faltantes o contradicciones y rotular toda simulación.
- **Requisitos técnicos confirmados:** [Axios](https://www.axios.com/) opera solo como transporte detrás del puerto/adaptador HTTP; presentación no importa Axios ni `packages/contracts`. [SWR](https://swr.vercel.app/) posee carga, caché y revalidación de estado de servidor mediante fetchers de aplicación/adaptador. [React Hook Form](https://react-hook-form.com/) posee estado de formulario en navegador, mientras validación de negocio y decisiones siguen siendo autoritativas en backend. No duplicar en SWR estado cliente de Zustand y aplicar el gate compartido de skills/MCP antes de modificar dependencias.
- **Orden:** inicia el Feature y desbloquea [#57](#^issue-57).

**Rama propuesta.** `Vaqcrow#56_Task_Implement_SME_request_and_evidence_review` es una unidad de implementación revisable.

### #57 — Probar la solicitud de PyME y la revisión de evidencia

^issue-57

- **Título original:** `Task: Test SME request and evidence review`
- **GitHub y estado:** [issue #57](https://github.com/reyduar/Vaqcrow/issues/57) · Tipo `Task` · Área `frontend` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#18](#^issue-18), que requiere [#13](#^issue-13) y [#17](#^issue-17); bloqueada nativamente por [#56](#^issue-56).
- **Objetivo:** probar de forma determinística el comportamiento central, rechazos y fallbacks aplicables.
- **Orden:** valida la implementación y desbloquea [#58](#^issue-58).

**Rama propuesta.** `Vaqcrow#57_Task_Test_SME_request_and_evidence_review` es una unidad de pruebas revisable.

### #58 — Documentar evidencia de la solicitud de PyME y su revisión

^issue-58

- **Título original:** `Task: Document evidence for SME request and evidence review`
- **GitHub y estado:** [issue #58](https://github.com/reyduar/Vaqcrow/issues/58) · Tipo `Task` · Área `frontend` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#18](#^issue-18), que requiere [#13](#^issue-13) y [#17](#^issue-17); bloqueada nativamente por [#57](#^issue-57).
- **Objetivo:** documentar evidencia reproducible y no sensible de la solicitud y la revisión.
- **Orden:** cierra [#18](#^issue-18) y habilita [#19](#^issue-19).

**Rama propuesta.** `Vaqcrow#58_Task_Document_evidence_for_SME_request_and_evidence_review` es una unidad de documentación revisable.

### #22 — Derivar los fallos de IA a revisión manual

^issue-22

- **Título original:** `Feature: Route AI failure to manual review`
- **GitHub y estado:** [issue #22](https://github.com/reyduar/Vaqcrow/issues/22) · Tipo `Feature` · Área `ai` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#6](#^issue-6); bloqueada nativamente por [#21](#^issue-21).
- **Objetivo:** tratar timeout, salida inválida y caída del proveedor con revisión manual y estados de respaldo veraces.
- **Orden:** desbloquea [#29](#^issue-29).

**Rama propuesta.** `Vaqcrow#22_Feat_Route_AI_failure_to_manual_review` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #71 — Implementar la derivación de fallos de IA a revisión manual

^issue-71

- **Título original:** `Task: Implement AI failure routing to manual review`
- **GitHub y estado:** [issue #71](https://github.com/reyduar/Vaqcrow/issues/71) · Tipo `Task` · Área `ai` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#22](#^issue-22), que requiere [#21](#^issue-21); sin bloqueos nativos propios.
- **Objetivo:** implementar la derivación a revisión manual dentro del límite de la demo.
- **Orden:** inicia el Feature y desbloquea [#72](#^issue-72).

**Rama propuesta.** `Vaqcrow#71_Task_Implement_AI_failure_routing_to_manual_review` es una unidad de implementación revisable.

### #72 — Probar la derivación de fallos de IA a revisión manual

^issue-72

- **Título original:** `Task: Test AI failure routing to manual review`
- **GitHub y estado:** [issue #72](https://github.com/reyduar/Vaqcrow/issues/72) · Tipo `Task` · Área `ai` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#22](#^issue-22), que requiere [#21](#^issue-21); bloqueada nativamente por [#71](#^issue-71).
- **Objetivo:** demostrar la derivación con pruebas determinísticas.
- **Orden:** valida la implementación y desbloquea [#73](#^issue-73).

**Rama propuesta.** `Vaqcrow#72_Task_Test_AI_failure_routing_to_manual_review` es una unidad de pruebas revisable.

### #73 — Documentar evidencia de la derivación de fallos de IA

^issue-73

- **Título original:** `Task: Document evidence for AI failure routing to manual review`
- **GitHub y estado:** [issue #73](https://github.com/reyduar/Vaqcrow/issues/73) · Tipo `Task` · Área `ai` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#22](#^issue-22), que requiere [#21](#^issue-21); bloqueada nativamente por [#72](#^issue-72).
- **Objetivo:** documentar evidencia reproducible de finalización del fallback manual.
- **Orden:** cierra [#22](#^issue-22) y habilita [#29](#^issue-29).

**Rama propuesta.** `Vaqcrow#73_Task_Document_evidence_for_AI_failure_routing_to_manual_review` es una unidad de documentación revisable.

### #25 — Confirmar transacciones Stellar de forma asíncrona

^issue-25

- **Título original:** `Feature: Confirm Stellar transactions asynchronously`
- **GitHub y estado:** [issue #25](https://github.com/reyduar/Vaqcrow/issues/25) · Tipo `Feature` · Área `stellar` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#7](#^issue-7); bloqueada nativamente por [#24](#^issue-24).
- **Objetivo:** consultar Horizon después del envío y exponer estados `submitted`, `confirmed` y `failed`.
- **Orden:** por desempate numérico sigue a [#22](#^issue-22) y desbloquea [#28](#^issue-28).

**Rama propuesta.** `Vaqcrow#25_Feat_Confirm_Stellar_transactions_asynchronously` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #80 — Implementar la confirmación asíncrona de Stellar

^issue-80

- **Título original:** `Task: Implement asynchronous Stellar confirmation`
- **GitHub y estado:** [issue #80](https://github.com/reyduar/Vaqcrow/issues/80) · Tipo `Task` · Área `stellar` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#25](#^issue-25), que requiere [#24](#^issue-24); sin bloqueos nativos propios.
- **Objetivo:** implementar la confirmación asíncrona dentro de la arquitectura delimitada.
- **Orden:** inicia el Feature y desbloquea [#81](#^issue-81).

**Rama propuesta.** `Vaqcrow#80_Task_Implement_asynchronous_Stellar_confirmation` es una unidad de implementación revisable.

### #81 — Probar la confirmación asíncrona de Stellar

^issue-81

- **Título original:** `Task: Test asynchronous Stellar confirmation`
- **GitHub y estado:** [issue #81](https://github.com/reyduar/Vaqcrow/issues/81) · Tipo `Task` · Área `stellar` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#25](#^issue-25), que requiere [#24](#^issue-24); bloqueada nativamente por [#80](#^issue-80).
- **Objetivo:** demostrar la confirmación con pruebas determinísticas.
- **Orden:** valida la implementación y desbloquea [#82](#^issue-82).

**Rama propuesta.** `Vaqcrow#81_Task_Test_asynchronous_Stellar_confirmation` es una unidad de pruebas revisable.

### #82 — Documentar evidencia de la confirmación asíncrona de Stellar

^issue-82

- **Título original:** `Task: Document evidence for asynchronous Stellar confirmation`
- **GitHub y estado:** [issue #82](https://github.com/reyduar/Vaqcrow/issues/82) · Tipo `Task` · Área `stellar` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#25](#^issue-25), que requiere [#24](#^issue-24); bloqueada nativamente por [#81](#^issue-81).
- **Objetivo:** documentar evidencia reproducible de finalización de la confirmación.
- **Orden:** cierra [#25](#^issue-25) y habilita [#28](#^issue-28).

**Rama propuesta.** `Vaqcrow#82_Task_Document_evidence_for_asynchronous_Stellar_confirmation` es una unidad de documentación revisable.

## Ola 5 — Distribución y decisión humana

### #28 — Firmar y distribuir revenue share en Testnet

^issue-28

- **Título original:** `Feature: Sign and distribute revenue share on Testnet`
- **GitHub y estado:** [issue #28](https://github.com/reyduar/Vaqcrow/issues/28) · Tipo `Feature` · Área `stellar` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#8](#^issue-8); bloqueada nativamente por [#23](#^issue-23), [#25](#^issue-25) y [#27](#^issue-27).
- **Objetivo:** construir, verificar, enviar y confirmar de forma asíncrona la transacción no custodial de distribución.
- **Orden:** desbloquea [#29](#^issue-29) y [#30](#^issue-30), por lo que precede a [#19](#^issue-19) dentro de la prioridad `Critical`.

**Rama propuesta.** `Vaqcrow#28_Feat_Sign_and_distribute_revenue_share_on_Testnet` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #89 — Implementar la distribución de revenue share en Testnet

^issue-89

- **Título original:** `Task: Implement Testnet revenue-share distribution`
- **GitHub y estado:** [issue #89](https://github.com/reyduar/Vaqcrow/issues/89) · Tipo `Task` · Área `stellar` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#28](#^issue-28), que requiere [#23](#^issue-23), [#25](#^issue-25) y [#27](#^issue-27); sin bloqueos nativos propios.
- **Objetivo:** implementar la distribución en Testnet dentro de la arquitectura delimitada.
- **Orden:** inicia el Feature y desbloquea [#90](#^issue-90).

**Rama propuesta.** `Vaqcrow#89_Task_Implement_Testnet_revenue_share_distribution` es una unidad de implementación revisable.

### #90 — Probar la distribución de revenue share en Testnet

^issue-90

- **Título original:** `Task: Test Testnet revenue-share distribution`
- **GitHub y estado:** [issue #90](https://github.com/reyduar/Vaqcrow/issues/90) · Tipo `Task` · Área `stellar` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#28](#^issue-28), que requiere [#23](#^issue-23), [#25](#^issue-25) y [#27](#^issue-27); bloqueada nativamente por [#89](#^issue-89).
- **Objetivo:** demostrar la distribución con pruebas determinísticas.
- **Orden:** valida la implementación y desbloquea [#91](#^issue-91).

**Rama propuesta.** `Vaqcrow#90_Task_Test_Testnet_revenue_share_distribution` es una unidad de pruebas revisable.

### #91 — Documentar evidencia de la distribución de revenue share en Testnet

^issue-91

- **Título original:** `Task: Document evidence for Testnet revenue-share distribution`
- **GitHub y estado:** [issue #91](https://github.com/reyduar/Vaqcrow/issues/91) · Tipo `Task` · Área `stellar` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#28](#^issue-28), que requiere [#23](#^issue-23), [#25](#^issue-25) y [#27](#^issue-27); bloqueada nativamente por [#90](#^issue-90).
- **Objetivo:** documentar evidencia reproducible de finalización de la distribución.
- **Orden:** cierra [#28](#^issue-28) y habilita [#29](#^issue-29) y [#30](#^issue-30).

**Rama propuesta.** `Vaqcrow#91_Task_Document_evidence_for_Testnet_revenue_share_distribution` es una unidad de documentación revisable.

### #19 — Implementar la evaluación y aprobación humanas

^issue-19

- **Título original:** `Feature: Implement human assessment and approval`
- **GitHub y estado:** [issue #19](https://github.com/reyduar/Vaqcrow/issues/19) · Tipo `Feature` · Área `frontend` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#5](#^issue-5); bloqueada nativamente por [#18](#^issue-18).
- **Objetivo:** presentar razones, evidencia e incertidumbre de IA y registrar aprobación o rechazo humanos explícitos.
- **Orden:** desbloquea [#29](#^issue-29).

**Rama propuesta.** `Vaqcrow#19_Feat_Implement_human_assessment_and_approval` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #62 — Implementar la evaluación y aprobación humanas

^issue-62

- **Título original:** `Task: Implement human assessment and approval`
- **GitHub y estado:** [issue #62](https://github.com/reyduar/Vaqcrow/issues/62) · Tipo `Task` · Área `frontend` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#19](#^issue-19), que requiere [#18](#^issue-18); sin bloqueos nativos propios.
- **Objetivo:** implementar evaluación y aprobación humanas dentro del límite de la demo.
- **Orden:** inicia el Feature y desbloquea [#63](#^issue-63).

**Rama propuesta.** `Vaqcrow#62_Task_Implement_human_assessment_and_approval` es una unidad de implementación revisable.

### #63 — Probar la evaluación y aprobación humanas

^issue-63

- **Título original:** `Task: Test human assessment and approval`
- **GitHub y estado:** [issue #63](https://github.com/reyduar/Vaqcrow/issues/63) · Tipo `Task` · Área `frontend` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#19](#^issue-19), que requiere [#18](#^issue-18); bloqueada nativamente por [#62](#^issue-62).
- **Objetivo:** demostrar evaluación y aprobación con pruebas determinísticas.
- **Orden:** valida la implementación y desbloquea [#64](#^issue-64).

**Rama propuesta.** `Vaqcrow#63_Task_Test_human_assessment_and_approval` es una unidad de pruebas revisable.

### #64 — Documentar evidencia de la evaluación y aprobación humanas

^issue-64

- **Título original:** `Task: Document evidence for human assessment and approval`
- **GitHub y estado:** [issue #64](https://github.com/reyduar/Vaqcrow/issues/64) · Tipo `Task` · Área `frontend` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#19](#^issue-19), que requiere [#18](#^issue-18); bloqueada nativamente por [#63](#^issue-63).
- **Objetivo:** documentar evidencia reproducible de finalización de la decisión humana.
- **Orden:** cierra [#19](#^issue-19) y habilita [#29](#^issue-29).

**Rama propuesta.** `Vaqcrow#64_Task_Document_evidence_for_human_assessment_and_approval` es una unidad de documentación revisable.

## Ola 6 — Integración vertical y panel de evidencia

### #30 — Integrar el recorrido vertical completo de la demo

^issue-30

- **Título original:** `Feature: Integrate the complete vertical demo journey`
- **GitHub y estado:** [issue #30](https://github.com/reyduar/Vaqcrow/issues/30) · Tipo `Feature` · Área `demo` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#9](#^issue-9); bloqueada nativamente por [#16](#^issue-16), [#20](#^issue-20), [#24](#^issue-24) y [#28](#^issue-28).
- **Objetivo:** conectar el único recorrido sintético desde solicitud, IA y aprobación hasta fondeo, confirmación y distribución.
- **Orden:** tiene prioridad `Critical` y desbloquea [#31](#^issue-31) y [#32](#^issue-32).

**Rama propuesta.** `Vaqcrow#30_Feat_Integrate_the_complete_vertical_demo_journey` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #95 — Implementar el recorrido vertical completo de la demo

^issue-95

- **Título original:** `Task: Implement complete vertical demo journey`
- **GitHub y estado:** [issue #95](https://github.com/reyduar/Vaqcrow/issues/95) · Tipo `Task` · Área `demo` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#30](#^issue-30), que requiere [#16](#^issue-16), [#20](#^issue-20), [#24](#^issue-24) y [#28](#^issue-28); sin bloqueos nativos propios.
- **Objetivo:** implementar el recorrido vertical completo dentro de la arquitectura delimitada.
- **Requisitos técnicos confirmados:** usar [Zustand](https://zustand.docs.pmnd.rs/learn/getting-started/introduction) solo para estado de workflow cliente entre rutas. No duplicar estado de servidor gestionado por SWR ni estado, decisiones o workflow autoritativos del backend. Aplicar el gate compartido de skills/MCP antes de cualquier cambio de manifest o lockfile.
- **Orden:** inicia el Feature y desbloquea [#96](#^issue-96).

**Rama propuesta.** `Vaqcrow#95_Task_Implement_complete_vertical_demo_journey` es una unidad de implementación revisable.

### #96 — Probar el recorrido vertical completo de la demo

^issue-96

- **Título original:** `Task: Test complete vertical demo journey`
- **GitHub y estado:** [issue #96](https://github.com/reyduar/Vaqcrow/issues/96) · Tipo `Task` · Área `demo` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#30](#^issue-30), que requiere [#16](#^issue-16), [#20](#^issue-20), [#24](#^issue-24) y [#28](#^issue-28); bloqueada nativamente por [#95](#^issue-95).
- **Objetivo:** demostrar el recorrido completo con pruebas determinísticas.
- **Orden:** valida la implementación y desbloquea [#97](#^issue-97).

**Rama propuesta.** `Vaqcrow#96_Task_Test_complete_vertical_demo_journey` es una unidad de pruebas revisable.

### #97 — Documentar evidencia del recorrido vertical completo

^issue-97

- **Título original:** `Task: Document evidence for complete vertical demo journey`
- **GitHub y estado:** [issue #97](https://github.com/reyduar/Vaqcrow/issues/97) · Tipo `Task` · Área `demo` · Prioridad `Critical` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#30](#^issue-30), que requiere [#16](#^issue-16), [#20](#^issue-20), [#24](#^issue-24) y [#28](#^issue-28); bloqueada nativamente por [#96](#^issue-96).
- **Objetivo:** documentar evidencia reproducible de finalización del recorrido completo.
- **Orden:** cierra [#30](#^issue-30) y habilita [#31](#^issue-31) y [#32](#^issue-32).

**Rama propuesta.** `Vaqcrow#97_Task_Document_evidence_for_complete_vertical_demo_journey` es una unidad de documentación revisable.

### #29 — Exponer el dashboard de evidencia de decisiones y transacciones

^issue-29

- **Título original:** `Feature: Expose decision and transaction evidence dashboard`
- **GitHub y estado:** [issue #29](https://github.com/reyduar/Vaqcrow/issues/29) · Tipo `Feature` · Área `demo` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#9](#^issue-9); bloqueada nativamente por [#19](#^issue-19), [#22](#^issue-22) y [#28](#^issue-28).
- **Objetivo:** presentar en una línea temporal decisiones, evidencia, estados, montos, hashes, enlaces del explorador y avisos de simulación.
- **Orden:** está lista en esta ola, pero sigue al Feature `Critical` [#30](#^issue-30); no tiene dependientes nativos directos.

**Rama propuesta.** `Vaqcrow#29_Feat_Expose_decision_and_transaction_evidence_dashboard` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #92 — Implementar el dashboard de evidencia

^issue-92

- **Título original:** `Task: Implement evidence dashboard`
- **GitHub y estado:** [issue #92](https://github.com/reyduar/Vaqcrow/issues/92) · Tipo `Task` · Área `demo` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#29](#^issue-29), que requiere [#19](#^issue-19), [#22](#^issue-22) y [#28](#^issue-28); sin bloqueos nativos propios.
- **Objetivo:** implementar el dashboard dentro de la arquitectura delimitada de la demo.
- **Orden:** inicia el Feature y desbloquea [#93](#^issue-93).

**Rama propuesta.** `Vaqcrow#92_Task_Implement_evidence_dashboard` es una unidad de implementación revisable.

### #93 — Probar el dashboard de evidencia

^issue-93

- **Título original:** `Task: Test evidence dashboard`
- **GitHub y estado:** [issue #93](https://github.com/reyduar/Vaqcrow/issues/93) · Tipo `Task` · Área `demo` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#29](#^issue-29), que requiere [#19](#^issue-19), [#22](#^issue-22) y [#28](#^issue-28); bloqueada nativamente por [#92](#^issue-92).
- **Objetivo:** demostrar el dashboard con pruebas determinísticas.
- **Orden:** valida la implementación y desbloquea [#94](#^issue-94).

**Rama propuesta.** `Vaqcrow#93_Task_Test_evidence_dashboard` es una unidad de pruebas revisable.

### #94 — Documentar evidencia del dashboard

^issue-94

- **Título original:** `Task: Document evidence for evidence dashboard`
- **GitHub y estado:** [issue #94](https://github.com/reyduar/Vaqcrow/issues/94) · Tipo `Task` · Área `demo` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#29](#^issue-29), que requiere [#19](#^issue-19), [#22](#^issue-22) y [#28](#^issue-28); bloqueada nativamente por [#93](#^issue-93).
- **Objetivo:** documentar evidencia reproducible de finalización del dashboard.
- **Orden:** cierra [#29](#^issue-29); no desbloquea dependientes nativos directos.

**Rama propuesta.** `Vaqcrow#94_Task_Document_evidence_for_evidence_dashboard` es una unidad de documentación revisable.

## Ola 7 — Resiliencia y despliegue

### #31 — Agregar telemetría de resiliencia y fallbacks veraces

^issue-31

- **Título original:** `Feature: Add resilience telemetry and truthful fallbacks`
- **GitHub y estado:** [issue #31](https://github.com/reyduar/Vaqcrow/issues/31) · Tipo `Feature` · Área `backend` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#9](#^issue-9); bloqueada nativamente por [#30](#^issue-30).
- **Objetivo:** tratar fallos de LLM, Horizon, Freighter y aplicación con reintentos acotados, observabilidad y estados de respaldo honestos.
- **Orden:** empata en prioridad y dependientes con [#32](#^issue-32), por lo que precede por número; desbloquea [#33](#^issue-33).

**Rama propuesta.** `Vaqcrow#31_Feat_Add_resilience_telemetry_and_truthful_fallbacks` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #98 — Implementar telemetría de resiliencia y fallbacks

^issue-98

- **Título original:** `Task: Implement resilience telemetry and fallbacks`
- **GitHub y estado:** [issue #98](https://github.com/reyduar/Vaqcrow/issues/98) · Tipo `Task` · Área `backend` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#31](#^issue-31), que requiere [#30](#^issue-30); sin bloqueos nativos propios.
- **Objetivo:** implementar telemetría y fallbacks dentro de la arquitectura delimitada.
- **Orden:** inicia el Feature y desbloquea [#99](#^issue-99).

**Rama propuesta.** `Vaqcrow#98_Task_Implement_resilience_telemetry_and_fallbacks` es una unidad de implementación revisable.

### #99 — Probar telemetría de resiliencia y fallbacks

^issue-99

- **Título original:** `Task: Test resilience telemetry and fallbacks`
- **GitHub y estado:** [issue #99](https://github.com/reyduar/Vaqcrow/issues/99) · Tipo `Task` · Área `backend` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#31](#^issue-31), que requiere [#30](#^issue-30); bloqueada nativamente por [#98](#^issue-98).
- **Objetivo:** demostrar telemetría y fallbacks con pruebas determinísticas.
- **Orden:** valida la implementación y desbloquea [#100](#^issue-100).

**Rama propuesta.** `Vaqcrow#99_Task_Test_resilience_telemetry_and_fallbacks` es una unidad de pruebas revisable.

### #100 — Documentar evidencia de telemetría de resiliencia y fallbacks

^issue-100

- **Título original:** `Task: Document evidence for resilience telemetry and fallbacks`
- **GitHub y estado:** [issue #100](https://github.com/reyduar/Vaqcrow/issues/100) · Tipo `Task` · Área `backend` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#31](#^issue-31), que requiere [#30](#^issue-30); bloqueada nativamente por [#99](#^issue-99).
- **Objetivo:** documentar evidencia reproducible de finalización de telemetría y fallbacks.
- **Orden:** cierra [#31](#^issue-31) y, junto con [#32](#^issue-32), habilita [#33](#^issue-33).

**Rama propuesta.** `Vaqcrow#100_Task_Document_evidence_for_resilience_telemetry_and_fallbacks` es una unidad de documentación revisable.

### #32 — Preparar entornos de despliegue independientes

^issue-32

- **Título original:** `Feature: Prepare independent deployment environments`
- **GitHub y estado:** [issue #32](https://github.com/reyduar/Vaqcrow/issues/32) · Tipo `Feature` · Área `infra` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#10](#^issue-10); bloqueada nativamente por [#15](#^issue-15) y [#30](#^issue-30).
- **Objetivo:** definir CI reproducible, entornos preview/demo, límites de secretos y artefactos independientes para web y API.
- **Orden:** sigue a [#31](#^issue-31) por desempate numérico y desbloquea [#33](#^issue-33).

**Rama propuesta.** `Vaqcrow#32_Feat_Prepare_independent_deployment_environments` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #101 — Implementar entornos de despliegue independientes

^issue-101

- **Título original:** `Task: Implement independent deployment environments`
- **GitHub y estado:** [issue #101](https://github.com/reyduar/Vaqcrow/issues/101) · Tipo `Task` · Área `infra` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#32](#^issue-32), que requiere [#15](#^issue-15) y [#30](#^issue-30); sin bloqueos nativos propios.
- **Objetivo:** implementar los entornos independientes dentro de la arquitectura delimitada.
- **Orden:** inicia el Feature y desbloquea [#102](#^issue-102).

**Rama propuesta.** `Vaqcrow#101_Task_Implement_independent_deployment_environments` es una unidad de implementación revisable.

### #102 — Probar entornos de despliegue independientes

^issue-102

- **Título original:** `Task: Test independent deployment environments`
- **GitHub y estado:** [issue #102](https://github.com/reyduar/Vaqcrow/issues/102) · Tipo `Task` · Área `infra` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#32](#^issue-32), que requiere [#15](#^issue-15) y [#30](#^issue-30); bloqueada nativamente por [#101](#^issue-101).
- **Objetivo:** demostrar los entornos con pruebas determinísticas.
- **Orden:** valida la implementación y desbloquea [#103](#^issue-103).

**Rama propuesta.** `Vaqcrow#102_Task_Test_independent_deployment_environments` es una unidad de pruebas revisable.

### #103 — Documentar evidencia de entornos de despliegue independientes

^issue-103

- **Título original:** `Task: Document evidence for independent deployment environments`
- **GitHub y estado:** [issue #103](https://github.com/reyduar/Vaqcrow/issues/103) · Tipo `Task` · Área `infra` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#32](#^issue-32), que requiere [#15](#^issue-15) y [#30](#^issue-30); bloqueada nativamente por [#102](#^issue-102).
- **Objetivo:** documentar evidencia reproducible de finalización de los entornos.
- **Orden:** cierra [#32](#^issue-32) y, junto con [#31](#^issue-31), habilita [#33](#^issue-33).

**Rama propuesta.** `Vaqcrow#103_Task_Document_evidence_for_independent_deployment_environments` es una unidad de documentación revisable.

## Ola 8 — Ensayo y paquete de evidencia

### #33 — Ensayar la demo y empaquetar evidencia

^issue-33

- **Título original:** `Feature: Rehearse the demo and package evidence`
- **GitHub y estado:** [issue #33](https://github.com/reyduar/Vaqcrow/issues/33) · Tipo `Feature` · Área `demo` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#10](#^issue-10); bloqueada nativamente por [#31](#^issue-31) y [#32](#^issue-32).
- **Objetivo:** ejecutar tres ensayos internos de menos de siete minutos y congelar el paquete de evidencia de respaldo.
- **Orden:** reúne resiliencia y despliegue, y desbloquea [#34](#^issue-34).

**Rama propuesta.** `Vaqcrow#33_Feat_Rehearse_the_demo_and_package_evidence` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #104 — Implementar el ensayo y el empaquetado de evidencia

^issue-104

- **Título original:** `Task: Implement demo rehearsal and evidence packaging`
- **GitHub y estado:** [issue #104](https://github.com/reyduar/Vaqcrow/issues/104) · Tipo `Task` · Área `demo` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#33](#^issue-33), que requiere [#31](#^issue-31) y [#32](#^issue-32); sin bloqueos nativos propios.
- **Objetivo:** implementar el ensayo y empaquetado dentro del alcance delimitado.
- **Orden:** inicia el Feature y desbloquea [#105](#^issue-105).

**Rama propuesta.** `Vaqcrow#104_Task_Implement_demo_rehearsal_and_evidence_packaging` es una unidad de implementación revisable.

### #105 — Probar el ensayo y el empaquetado de evidencia

^issue-105

- **Título original:** `Task: Test demo rehearsal and evidence packaging`
- **GitHub y estado:** [issue #105](https://github.com/reyduar/Vaqcrow/issues/105) · Tipo `Task` · Área `demo` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#33](#^issue-33), que requiere [#31](#^issue-31) y [#32](#^issue-32); bloqueada nativamente por [#104](#^issue-104).
- **Objetivo:** demostrar el ensayo y el paquete con pruebas determinísticas.
- **Orden:** valida la implementación y desbloquea [#106](#^issue-106).

**Rama propuesta.** `Vaqcrow#105_Task_Test_demo_rehearsal_and_evidence_packaging` es una unidad de pruebas revisable.

### #106 — Documentar evidencia del ensayo y su empaquetado

^issue-106

- **Título original:** `Task: Document evidence for demo rehearsal and evidence packaging`
- **GitHub y estado:** [issue #106](https://github.com/reyduar/Vaqcrow/issues/106) · Tipo `Task` · Área `demo` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#33](#^issue-33), que requiere [#31](#^issue-31) y [#32](#^issue-32); bloqueada nativamente por [#105](#^issue-105).
- **Objetivo:** documentar evidencia reproducible de finalización del ensayo y el paquete.
- **Orden:** cierra [#33](#^issue-33) y habilita [#34](#^issue-34).

**Rama propuesta.** `Vaqcrow#106_Task_Document_evidence_for_demo_rehearsal_and_evidence_packaging` es una unidad de documentación revisable.

## Ola 9 — Congelamiento final

### #34 — Congelar el build y los materiales de presentación

^issue-34

- **Título original:** `Feature: Freeze build and presentation materials`
- **GitHub y estado:** [issue #34](https://github.com/reyduar/Vaqcrow/issues/34) · Tipo `Feature` · Área `docs` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#10](#^issue-10); bloqueada nativamente por [#33](#^issue-33).
- **Objetivo:** etiquetar el build demostrable y preparar materiales finales que expliquen el alcance validado y las decisiones de producción abiertas.
- **Orden:** es el cierre terminal del grafo canónico.

**Rama propuesta.** `Vaqcrow#34_Feat_Freeze_build_and_presentation_materials` es la rama de integración y seguimiento del Feature; la implementación se entrega mediante sus Tasks.

### #107 — Implementar el congelamiento del build y la presentación

^issue-107

- **Título original:** `Task: Implement final build and presentation freeze`
- **GitHub y estado:** [issue #107](https://github.com/reyduar/Vaqcrow/issues/107) · Tipo `Task` · Área `docs` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#34](#^issue-34), que requiere [#33](#^issue-33); sin bloqueos nativos propios.
- **Objetivo:** implementar el congelamiento final dentro del alcance delimitado.
- **Orden:** inicia el Feature y desbloquea [#108](#^issue-108).

**Rama propuesta.** `Vaqcrow#107_Task_Implement_final_build_and_presentation_freeze` es una unidad de implementación revisable.

### #108 — Probar el congelamiento del build y la presentación

^issue-108

- **Título original:** `Task: Test final build and presentation freeze`
- **GitHub y estado:** [issue #108](https://github.com/reyduar/Vaqcrow/issues/108) · Tipo `Task` · Área `docs` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#34](#^issue-34), que requiere [#33](#^issue-33); bloqueada nativamente por [#107](#^issue-107).
- **Objetivo:** demostrar el congelamiento con comprobaciones determinísticas.
- **Orden:** valida la implementación y desbloquea [#109](#^issue-109).

**Rama propuesta.** `Vaqcrow#108_Task_Test_final_build_and_presentation_freeze` es una unidad de pruebas revisable.

### #109 — Documentar evidencia del congelamiento final

^issue-109

- **Título original:** `Task: Document evidence for final build and presentation freeze`
- **GitHub y estado:** [issue #109](https://github.com/reyduar/Vaqcrow/issues/109) · Tipo `Task` · Área `docs` · Prioridad `High` · Workflow `Backlog`.
- **Jerarquía y bloqueos:** padre [#34](#^issue-34), que requiere [#33](#^issue-33); bloqueada nativamente por [#108](#^issue-108).
- **Objetivo:** documentar evidencia reproducible de finalización del build y la presentación.
- **Orden:** cierra [#34](#^issue-34) y el recorrido canónico completo.

**Rama propuesta.** `Vaqcrow#109_Task_Document_evidence_for_final_build_and_presentation_freeze` es una unidad de documentación revisable.

## Trabajo transversal fuera del camino crítico de la demo

### #134 — Establecer límites de autenticación y sesión con Auth.js

^issue-134

- **Título original:** `[Backlog] Task: Establish Auth.js authentication and session boundaries`
- **GitHub y estado:** [issue #134](https://github.com/reyduar/Vaqcrow/issues/134) · Tipo `Task` · Área `Security` · Prioridad `High` · Workflow `Backlog` verificado en el Project canónico `Vaqcrow-TFM` #4.
- **Jerarquía y bloqueos:** sin padre; el cuerpo declara dependencia de [#14](#^issue-14). No se fabrica una relación jerárquica ni una ola.
- **Objetivo:** establecer [Auth.js v5 / NextAuth](https://authjs.dev/) en el límite server-side de Next.js para autenticación y sesión; el backend conserva autorización, permisos, comandos y decisiones de dominio, y un adaptador server-only conserva registros de autenticación.
- **Límite de alcance:** deja sin efecto la dirección opcional de Supabase Auth como autoridad de identidad/sesión para este alcance futuro. Supabase puede seguir como PostgreSQL/Storage, sin autoridad paralela. La demo actual conserva identidad sintética y #134 permanece fuera de su camino crítico salvo cambio de alcance explícito.
- **Requisitos técnicos confirmados:** configuración y secretos dependen de #14; pruebas usan dobles locales de proveedor/persistencia; antes de instalar Auth.js o dependencias de autenticación se aplica el gate compartido de skills/MCP y se registra el soporte usado o `none`.
- **Orden:** está inventariado porque pertenece al Project #4, pero no altera las olas ni bloquea el recorrido de dos semanas.

**Rama propuesta.** `Vaqcrow#134_Task_Establish_Auth_js_authentication_and_session_boundaries` sería una unidad transversal revisable solo cuando se promueva explícitamente su ejecución.

## Discrepancias y exclusiones

### Relación discrepante

- En [#24](#^issue-24), la sección textual `Dependencies` menciona `#12`, `#13` y `#23`, mientras que la relación nativa `blocked by` contiene solo `#13` y `#23`. Este documento usa las relaciones nativas para ordenar, como fuente autoritativa solicitada. No se pierde la precedencia efectiva de #12 porque [#13](#^issue-13) ya está bloqueado nativamente por [#12](#^issue-12).

### Issues fuera del flujo canónico

- [Epic #3](#^issue-3) continúa en el Project #4 y por eso se incluye en el inventario con ancla propia, pero no forma parte del orden ejecutable: no tiene trabajo hijo y repite el alcance de [#4](#^issue-4).
- [Tasks #59](https://github.com/reyduar/Vaqcrow/issues/59), [#60](https://github.com/reyduar/Vaqcrow/issues/60) y [#61](https://github.com/reyduar/Vaqcrow/issues/61) están cerradas como duplicados de [#56](#^issue-56), [#57](#^issue-57) y [#58](#^issue-58), respectivamente; no son ejecutables ni aparecen en el índice canónico.

## Fuentes verificadas

- Repositorio e issues: <https://github.com/reyduar/Vaqcrow/issues>.
- Project canónico `Vaqcrow-TFM` #4: <https://github.com/users/reyduar/projects/4>.
- [Plan de la demo](./DEMO.md).
- [Arquitectura del monorepo](../architecture/monorepo.md).
