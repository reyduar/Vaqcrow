# Arquitectura del monorepo de Vaqcrow

Este documento fija la organización técnica prevista para Vaqcrow. La decisión es mantener un monorepo con aplicaciones desplegables de forma independiente y paquetes compartidos con límites explícitos. Es una propuesta de bootstrap autorizado: no implica que las aplicaciones, los paquetes ni los archivos de configuración ya existan.

## Decisión

Vaqcrow continuará como un **monorepo gestionado con pnpm y Turborepo**. El repositorio será una unidad de colaboración, contratos, testing y CI; no será una unidad obligatoria de despliegue.

La decisión se justifica por cinco condiciones actuales:

1. **Dominio compartido:** solicitudes, evidencia sintética, evaluación asistida por IA, decisiones humanas, intenciones, estados de transacción y cálculo de revenue share forman un journey vertical relacionado.
2. **Contratos y fixtures comunes:** web, API, worker y pruebas necesitan interpretar los mismos estados, esquemas y datos sintéticos sin copiar definiciones.
3. **Paquetes reutilizables:** dominio, contratos, IA, Stellar, simuladores, persistencia y UI pueden evolucionar como capacidades cohesivas.
4. **CI coordinada:** un cambio de contrato o dominio debe poder verificar sus consumidores y el recorrido crítico en una misma revisión.
5. **Tamaño actual:** el equipo y el proyecto todavía no justifican el costo operativo de repositorios y pipelines distribuidos; el monorepo permite avanzar con trazabilidad y menor coordinación.

La decisión no autoriza dependencias indiscriminadas. La simplicidad buscada es organizativa y operativa, no una licencia para acoplar aplicaciones o mezclar responsabilidades.

## Monorepo no es monolito de despliegue

| Concepto | Vaqcrow |
|---|---|
| Monorepo | Una estrategia para versionar aplicaciones, paquetes, contratos, fixtures y documentación relacionada en un repositorio común. |
| Monolito de despliegue | Un único artefacto y proceso que debe desplegarse y escalarse siempre como una unidad. No es una obligación del monorepo. |
| Runtime de la API | Un monolito modular Node.js/TypeScript con Fastify durante la demo y mientras los límites operativos no justifiquen otra separación. |
| Despliegues | `web`, `api` y `worker` pueden tener artefactos, proveedores, variables de entorno, escalado, rollback y ciclos de despliegue independientes. |

El monorepo permite compartir código sin convertir el runtime en un único proceso. La API puede seguir siendo modular internamente, mientras la web y el worker se despliegan aparte. Separar un servicio en producción será una decisión basada en límites de datos, seguridad, operación o escalado observados; no una consecuencia automática de tener varias carpetas.

## Árbol de carpetas propuesto

El siguiente árbol describe el destino arquitectónico. Las aplicaciones y los paquetes están planificados, no implementados.

```text
.
├── apps/
│   ├── web/                  # Next.js + React: interfaz de la demo y del producto
│   ├── api/                  # Node.js + TypeScript + Fastify: API y orquestación
│   └── worker/               # Opcional: confirmaciones y jobs asíncronos acotados
├── packages/
│   ├── domain/               # Estados, invariantes y cálculo determinístico
│   ├── contracts/            # Esquemas y contratos de API, eventos y adaptadores
│   ├── ai/                   # Evaluación estructurada, evidencia y adaptador LLM
│   ├── stellar/               # Freighter, XDR, Stellar SDK, Horizon y Testnet
│   ├── simulators/            # KYC/KYB, ventas y corredor ARS/activo simulados
│   ├── db/                    # PostgreSQL, migraciones y persistencia idempotente
│   ├── config/                # Configuración tipada y separación por entorno
│   ├── testing/               # Fixtures, builders y utilidades de prueba
│   └── ui/                    # Componentes visuales realmente compartidos
├── docs/
│   ├── architecture/
│   ├── design/
│   └── planning/
├── package.json               # Metadatos del workspace; previsto para el bootstrap
├── pnpm-workspace.yaml        # Workspace pnpm; previsto para el bootstrap
├── turbo.json                 # Pipeline Turborepo; previsto para el bootstrap
└── pnpm-lock.yaml             # Lockfile; previsto para el bootstrap
```

No se crea un paquete por tabla, pantalla, proveedor o archivo. Cada paquete debe representar una capacidad cohesionada con contrato, pruebas y motivo de reutilización o aislamiento técnico.

## Responsabilidades y límites

| Unidad | Responsabilidad | Límite principal |
|---|---|---|
| `apps/web` | Renderizar la experiencia Next.js/React, gestionar interacción, solicitar datos y comandos a la API y conducir la firma con Freighter mediante una interfaz segura para navegador. | No accede directamente a PostgreSQL, secretos de servidor, decisiones internas, proveedor LLM ni estados críticos de Supabase. |
| `apps/api` | Exponer la API Fastify, autorizar acciones, coordinar comandos, aplicar dominio, persistir estados, verificar XDR y coordinar adaptadores externos. | No espera indefinidamente a redes externas ni delega autorización o decisiones financieras al navegador. |
| `apps/worker` | Ejecutar confirmaciones, polling, outbox, reintentos limitados y jobs durables cuando la API no sea suficiente. | No inventa transiciones ni modifica estados fuera de las reglas del dominio. Puede no existir en la primera versión. |
| `packages/domain` | Modelar estados, invariantes, elegibilidad, obligaciones y cálculo de revenue share con reglas determinísticas. | No conoce Next.js, Fastify, PostgreSQL, Supabase, LLM, Freighter ni SDKs externos. |
| `packages/contracts` | Definir esquemas, tipos públicos y contratos de API, eventos y adaptadores normalizados. | No contiene secretos, acceso a infraestructura ni lógica de negocio escondida en DTOs. |
| `packages/ai` | Normalizar evidencia, validar salidas estructuradas, versionar prompt/modelo y encapsular el proveedor LLM. | La IA recomienda y explica; no aprueba, calcula obligaciones, firma ni transfiere fondos. |
| `packages/stellar` | Encapsular Stellar SDK, Freighter, construcción/verificación de XDR, Horizon y estados de Testnet. | Stellar demuestra liquidación técnica; no es la fuente de verdad de contratos, ventas o contabilidad interna. |
| `packages/simulators` | Proveer KYC/KYB, ventas y corredor ARS/activo sintéticos, reproducibles y reemplazables. | Los simuladores no se presentan como evidencia de proveedor, cobertura, legalidad o disponibilidad productiva. |
| `packages/db` | Encapsular PostgreSQL/Supabase, migraciones, consultas, idempotencia y mapeo de persistencia. | No decide UX ni autorización por sí solo; el navegador nunca escribe estados críticos directamente. |
| `packages/config` | Cargar y validar configuración por entorno, distinguiendo valores públicos de secretos de servidor. | No imprime secretos ni permite que una configuración privada llegue al bundle del navegador. |
| `packages/testing` | Centralizar fixtures sintéticos, builders, dobles determinísticos y utilidades compartidas. | Solo se usa desde pruebas y no debe convertirse en dependencia de producción. |
| `packages/ui` | Compartir componentes visuales accesibles cuando exista más de un uso real. | No contiene reglas de dominio, llamadas a proveedores ni acceso a infraestructura. |

## Dirección de dependencias

Las dependencias deben apuntar desde las aplicaciones y adaptadores hacia contratos y capacidades más estables. Ningún paquete puede importar una aplicación.

### Relaciones permitidas

- `apps/web` puede depender de `packages/ui`, `packages/contracts`, la parte pública de `packages/config` y la interfaz de navegador de `packages/stellar` necesaria para Freighter.
- `apps/api` puede depender de `packages/domain`, `packages/contracts`, `packages/ai`, `packages/stellar`, `packages/simulators`, `packages/db` y `packages/config`.
- `apps/worker` puede depender de `packages/domain`, `packages/contracts`, `packages/stellar`, `packages/db` y `packages/config`; solo agrega otras capacidades si el job lo necesita.
- `packages/ai`, `packages/stellar` y `packages/simulators` pueden implementar contratos normalizados sin exponer modelos específicos de proveedores al dominio.
- `packages/db` puede mapear persistencia a tipos del dominio y contratos públicos, pero no trasladar decisiones de infraestructura a la UI.
- `packages/testing` puede consumir las interfaces públicas de las aplicaciones y paquetes para pruebas; esa relación es exclusivamente de test.

### Relaciones prohibidas

- `packages/domain` importando React, Next.js, Fastify, Supabase, PostgreSQL, un SDK Stellar o un proveedor LLM.
- `apps/web` importando consultas internas de `packages/db`, credenciales de Supabase, secretos del servidor o internals de `apps/api`.
- `apps/api` importando componentes, páginas o módulos privados de `apps/web`.
- `apps/worker` importando páginas o estado de UI para decidir una transición.
- `packages/ui` importando `domain`, `db`, `ai`, `stellar` o simuladores para resolver comportamiento de negocio.
- `packages/ai` calculando montos, porcentajes, redondeos u obligaciones o iniciando firmas y transferencias.
- Cualquier aplicación accediendo directamente al modelo interno de otra aplicación.
- Dependencias circulares, utilidades globales sin dueño o un paquete creado solo para envolver una tabla.

Cuando una aplicación necesita una capacidad de otra, debe usar un contrato HTTP, un evento o un paquete público estable; nunca importar sus internals.

## Tecnologías por capa

| Capa | Tecnología prevista | Uso y frontera |
|---|---|---|
| Interfaz | Next.js y React | `apps/web` presenta los flujos, estados de confianza y acciones de la persona usuaria. |
| API | Node.js, TypeScript y Fastify | `apps/api` ofrece un servicio de larga duración para autorización, comandos, dominio, XDR e IA. Fastify no es una plataforma de hosting. |
| Datos | PostgreSQL mediante Supabase | Persistencia de solicitudes, decisiones, intenciones, estados, trazabilidad e idempotencia; Supabase Auth/Storage son capacidades acotadas y opcionales para la demo. |
| Stellar | Stellar SDK, Freighter y Horizon | Freighter firma sin custodia; el SDK construye/verifica; Horizon consulta y confirma; la red prevista para la demo es Stellar Testnet. |
| IA | Proveedor LLM detrás de un adaptador | La evaluación es real y estructurada cuando se habilite un proveedor; el proveedor concreto, modelo, presupuesto y timeout siguen TBD. |
| Calidad | Vitest, Testing Library y Playwright | Unidad/dominio, comportamiento visible de UI, funcional de API, contratos y journey E2E. |
| Workspace | pnpm y Turborepo | Instalar dependencias, coordinar tareas y reutilizar caché sin ocultar los límites de despliegue. |
| CI | GitHub Actions | Ejecutar gates reproducibles en pull requests y promover candidatos solo después de las verificaciones. |

El uso de un paquete o SDK no implica que la integración ya esté realizada. La fuente documental vigente de la demo distingue qué capacidades son reales, simuladas o pendientes.

## Despliegue separado

La unidad de repositorio será común, pero cada aplicación tendrá su propio artefacto, configuración de ejecución, observabilidad, rollback y autorización de despliegue.

1. **Web:** `apps/web` se desplegará como aplicación Next.js independiente. Vercel es el destino recomendado en la planificación, pero todavía no existe un despliegue.
2. **API:** `apps/api` se ejecutará como servicio Node.js/Fastify de larga duración en un hosting independiente, todavía TBD y reemplazable. Será el dueño de la autorización, los comandos y la persistencia crítica.
3. **Worker:** `apps/worker` tendrá un despliegue separado únicamente si el polling de Horizon, los reintentos o los jobs requieren un proceso durable independiente. Si no aporta seguridad o durabilidad, no se agrega.
4. **Servicios gestionados:** Supabase podrá proveer PostgreSQL, Auth y Storage acotado. Esto no convierte a Supabase en dueño del dominio ni obliga a desplegar web, API y worker juntos.

El navegador se comunica con la API por un contrato explícito y con Freighter para la firma no custodial. La API y, cuando exista, el worker acceden a PostgreSQL y a los servicios externos con credenciales de servidor. La respuesta inicial de envío debe distinguir `submitted` de la confirmación asíncrona de Horizon.

## Configuración, secretos y datos sintéticos

- `packages/config` debe validar la configuración por entorno y exponer al navegador solo valores públicos.
- Las credenciales se inyectan desde el entorno o desde un gestor de secretos del proveedor de despliegue; no se escriben en el repositorio ni en logs.
- Nunca se versionan seeds, claves privadas, tokens, credenciales, XDR innecesarios ni PII.
- Los fixtures de KYC/KYB, ventas y corredor son sintéticos, versionados, reproducibles y rotulados como `SIMULADO` donde se presentan.
- Local y CI usan dobles determinísticos. Preview y demo pueden usar Stellar Testnet con cuentas aisladas y activos sin valor económico, fuera de la suite rápida.
- Supabase Storage, si se usa, se limita a fixtures o evidencia sintética; no habilita por sí mismo la incorporación de documentos reales.
- El isotipo de toro tiene aprobación conceptual, pero el archivo fuente autorizado continúa pendiente y no se debe inventar una ruta ni un asset.

## Testing y CI

### Cobertura prevista

| Nivel | Propósito |
|---|---|
| Unidad y dominio con Vitest | Estados, invariantes, elegibilidad, montos, unidades mínimas, redondeo e idempotencia. |
| Funcional de API con Vitest | Autorización, comandos Fastify, persistencia y secuencia de construcción, verificación, envío y confirmación con dobles. |
| Contratos de adaptadores | KYC/KYB, ventas, corredor, LLM, Freighter y Horizon con éxito, pendientes, duplicados, expiración, errores y reordenamiento. |
| Componentes con Testing Library | Formularios, disclosures, revisión humana, estados pendientes/terminales y errores observables. |
| Smoke/E2E con Playwright | Journey crítico de la demo y fallbacks esenciales, sin pretender una matriz exhaustiva de navegadores. |
| Comprobación externa | Testnet, Horizon y proveedor LLM en una suite separada, acotada y con datos/cuentas de prueba. |

### Gates de CI

- En cada pull request: instalación con lockfile congelado, lint, typecheck, pruebas unitarias/funcionales, contratos con dobles y build de las aplicaciones afectadas.
- En `main` o en un candidato de demo: repetir los gates, preparar un entorno aislado y ejecutar el smoke/E2E del journey crítico.
- Las pruebas normales no dependen de Testnet, Horizon ni del proveedor LLM. Un fallo externo no debe confundirse con una regresión determinística.
- La promoción de web, API o worker se realiza de forma independiente y solo después de sus gates. El worker no se promueve si no forma parte del candidato habilitado.

## Reglas de crecimiento

1. Mantener dependencias dirigidas y revisar cualquier nueva relación entre aplicaciones o paquetes.
2. Mantener `packages/domain` independiente de frameworks, infraestructura y proveedores.
3. Crear un paquete solo para una capacidad cohesionada con contrato, pruebas y una razón clara de reutilización o aislamiento; no para cada tabla, pantalla o archivo.
4. Mantener adaptadores externos detrás de contratos normalizados y evitar que sus modelos contaminen el dominio.
5. No crear una nueva aplicación por rol o proveedor sin una necesidad verificable de despliegue, seguridad, datos, ownership o escalado.
6. Agregar `apps/worker` cuando existan jobs durables, polling, outbox o reintentos que no puedan ejecutarse de manera segura en la API.
7. Preferir un módulo nuevo dentro de la API antes que un microservicio; separar un proceso solo con evidencia operativa y un contrato estable.
8. Conservar fixtures y contratos versionados para que un cambio de dominio pueda probar todos sus consumidores.
9. Mantener despliegues y rollbacks separados aunque el código se versiona en conjunto.

## Decisiones fuera de alcance

Para el bootstrap de la demo quedan explícitamente fuera de alcance:

- convertir el sistema en microservicios o administrar Kubernetes;
- crear aplicaciones móviles nativas;
- crear un paquete por tabla o por pantalla;
- emitir un token propio, crear mercado secundario o prometer liquidez/retorno;
- operar con dinero real, Stellar Public Network o un corredor ARS/activo no validado;
- usar Soroban como camino base antes de que los pagos clásicos funcionen y exista una justificación independiente;
- crear una aplicación administrativa separada solo por el nombre del rol;
- permitir que la IA apruebe, calcule obligaciones, firme o transfiera fondos;
- tratar Stitch o su HTML generado como implementación autoritativa;
- afirmar que existe producción, infraestructura desplegada o una integración de proveedor que aún está TBD.

Estas exclusiones no impiden reevaluaciones futuras. Cualquier ampliación debe preservar el dominio independiente de frameworks, los contratos, la trazabilidad, la no custodia y la validación específica para Argentina.

## Demo de dos semanas y futura producción

La demo y la producción comparten principios, pero no tienen el mismo nivel de garantía.

| Aspecto | Demo de dos semanas | Arquitectura futura de producción |
|---|---|---|
| Aplicaciones | `web` y `api`; `worker` opcional si hace falta para confirmaciones o jobs. | Puede conservar las mismas aplicaciones y agregar procesos separados solo por necesidad comprobada, por ejemplo conciliación o backoffice. |
| Datos | Fixtures sintéticos, persistencia mínima y Stellar Testnet. | Datos autorizados, controles de privacidad, ledger interno, conciliación y retención conforme a obligaciones aplicables. |
| Integraciones | Simuladores para KYC/KYB, ventas y corredor; LLM detrás de adaptador; Freighter/Horizon en Testnet. | Proveedores y corredor validados para Argentina, contratos, SLA, seguridad, recuperación y monitoreo. |
| Operación | CI determinística, smoke/E2E del journey y comprobaciones externas separadas. | Observabilidad, alertas, runbooks, recuperación, auditoría, seguridad y controles operativos ampliados. |
| Separación | Paquetes con límites útiles, sin prometer escalabilidad productiva. | Separación de procesos o repositorios solo si los datos, equipos, seguridad u operación la justifican. |
| Evidencia | Demuestra un slice vertical técnico y sus límites. | Debe demostrar preparación legal, operativa, contable, de seguridad y de proveedores; la demo no la acredita. |

La arquitectura de la demo sirve como punto de partida porque conserva contratos y límites útiles, no porque sea una prueba de disponibilidad productiva. Los simuladores, Testnet y datos sintéticos no se convierten automáticamente en integraciones ni controles de producción.

## Siguiente paso

Con autorización explícita, el siguiente paso es bootstrapear el workspace mínimo con `apps/web`, `apps/api`, los paquetes necesarios y los gates de calidad. `apps/worker` se agrega solo si el primer slice vertical demuestra esa necesidad. Este documento no afirma que exista implementación ejecutable.

## Referencias del repositorio

- [README](../../README.md) — estado y resumen ejecutivo.
- [Plan de la demo](../planning/DEMO.md) — alcance de dos semanas, journey, tecnologías, pruebas y límites.
- [Plan del producto real](../planning/product.md) — arquitectura de producción, Argentina, riesgos y decisiones abiertas.
- [Diseño UI/UX y runbook de Google Stitch](../design/demo-ui.md) — inventario visual real y pendientes de diseño.
