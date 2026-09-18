# Vaqcrow

**Financiamiento flexible para PyMEs argentinas mediante revenue share, con evaluación asistida por IA, control humano y liquidación verificable en Stellar.**

Vaqcrow busca que comercios de barrio y PyMEs puedan financiarse sin depender de cuotas fijas e intereses asfixiantes: quienes aportan capital reciben una participación contractual en las ventas, de modo que la obligación acompaña el desempeño del negocio.

**Misión de largo plazo:** democratizar la inversión en Latinoamérica conectando pequeños inversores con PyMEs tradicionales mediante financiamiento colectivo por revenue share, con Stellar para aportar transparencia, eficiencia y autocustodia. El producto y la demo actuales se acotan exclusivamente a Argentina.

**Lema:** _«Juntos podemos hacernos grandes»._

## Estado actual

- **Repositorio:** monorepo funcional con Fastify API, Next.js 16 web, contratos compartidos y dominio aplicado. La demo del TFM del Máster en Desarrollo con IA está en implementación activa. Persistencia con Supabase (PostgreSQL) ya configurada para el ciclo de vida de `application_review`.
- **Pruebas:** 44 archivos de test (Vitest + Testing Library) cubriendo contratos, dominio, infraestructura API, componentes web, integración y boundaries entre workspaces.
- **Stitch:** el proyecto `VaqcrowWebApp` tiene 18 flujos de pantalla de escritorio, cada uno con variantes Light y Dark ya generadas. El inventario documentado —36 variantes de escritorio— está en [Diseño UI/UX y runbook de Google Stitch](./docs/design/demo-ui.md). Stitch es referencia visual y de prototipado, no una implementación autoritativa.
- **Pendiente en diseño:** generar las variantes móviles, resolver algunas correcciones de pantallas y ampliar las fichas detalladas de los flujos que todavía no tienen especificación equivalente.

## Aviso de confianza

> **Vaqcrow no es hoy una oferta, recomendación ni producto de inversión.** El KYC/KYB, las ventas y el corredor ARS/activo Stellar están **SIMULADOS**. La IA es consultiva y requiere aprobación humana. Freighter se usa de forma no custodial: cada persona conserva sus claves y Vaqcrow nunca recibe su seed. Los activos y transacciones de Stellar Testnet no tienen valor económico. La demo no acredita autorización regulatoria, legalidad, rentabilidad, solvencia ni disponibilidad en producción.

## Qué demuestra la demo

La historia vertical prevista sigue un único caso sintético —**Panadería Horizonte SRL**, una PyME argentina— de punta a punta:

1. La PyME presenta identidad, KYC/KYB, historial de ventas y comprobantes simulados.
2. Una IA real analiza la evidencia suministrada, detecta anomalías y datos faltantes, expresa incertidumbre y entrega una recomendación estructurada y trazable.
3. Un operador revisa la evidencia y registra la decisión humana; la IA no autoriza el financiamiento.
4. Un inversor conecta Freighter, revisa la intención y firma el fondeo de forma no custodial en Stellar Testnet.
5. La API verifica el XDR y la interfaz distingue `submitted` de la confirmación asíncrona de Horizon.
6. El sistema calcula la obligación de revenue share con reglas determinísticas y muestra la distribución firmada, los estados y los hashes de Testnet.

El objetivo es completar este recorrido en 5–7 minutos sin ocultar qué es real, qué está simulado y qué decisiones continúan abiertas para una operación argentina.

## Real versus simulado

| Capacidad | Demo prevista |
|---|---|
| Empresa, identidad y perfiles | Datos sintéticos, rotulados `SIMULADO` |
| KYC/KYB | Simulado detrás de un adaptador reemplazable |
| Historial y feed mensual de ventas | Simulados, reproducibles y con una anomalía/faltante intencionales |
| Evaluación de riesgo por IA | Real, estructurada, validada y respaldada por evidencia |
| Decisión de financiamiento | Real y humana sobre el caso sintético |
| Entrada/cotización ARS | Simulada; el corredor de producción continúa sin resolver |
| Wallet y firma | Reales con Freighter, de forma no custodial |
| Fondeo y distribución | Transacciones reales en Stellar Testnet, sin valor económico |
| Confirmación | Real y asíncrona mediante Horizon |
| Cálculo de revenue share | Real, determinístico y ajeno al LLM |

## IA: función y límites

La IA normaliza y organiza evidencia, cita sus fuentes, identifica anomalías y datos faltantes, expresa incertidumbre y propone preguntas para revisión. Su salida debe cumplir un esquema estricto y quedar asociada a versión de modelo/prompt, timestamp y aprobación o rechazo humano.

Guardrails obligatorios:

- no inventar datos ni completar faltantes;
- no presentar inferencias como hechos;
- no aprobar casos ni sustituir la decisión humana;
- no calcular montos, porcentajes, redondeos u obligaciones financieras;
- no construir decisiones finales, firmar ni transferir fondos;
- ante timeout o salida inválida, derivar el caso a revisión manual.

## Decisión de arquitectura

Vaqcrow debe continuar como **monorepo**. Un monorepo es una estrategia de organización del código, no un monolito de despliegue: `web`, `api` y `worker` pueden compilarse, desplegarse y revertirse por separado. La decisión responde al dominio compartido, los contratos y fixtures comunes, los paquetes reutilizables, el journey vertical, la CI coordinada y el tamaño actual del equipo y del proyecto.

Los límites para evitar un monorepo caótico son explícitos: dependencias dirigidas, dominio independiente de frameworks, ninguna importación de internals entre aplicaciones, un paquete por capacidad cohesionada y despliegues separados. La estructura completa y sus reglas están en [Arquitectura del monorepo](./docs/architecture/monorepo.md).

Estructura actual:

```text
apps/web · apps/api                          ← implementados y funcionales
packages/domain · contracts                  ← implementados con tests
supabase/                                    ← config.toml + 1 migración (application_review)
```

Paquetes previstos para etapas futuras:

```text
apps/worker (opcional)
packages/ai · stellar · simulators · db · config · testing · ui
```

## Stack previsto para la demo

| Capa | Tecnología y responsabilidad |
|---|---|
| Web | Next.js + React para la interfaz y un BFF limitado a necesidades de presentación |
| API | Node.js + TypeScript + Fastify para comandos, dominio, verificación XDR y coordinación |
| Persistencia | PostgreSQL gestionado mediante Supabase; Auth y Storage solo si el alcance de la demo lo requiere |
| Stellar | Stellar SDK, Freighter, Horizon y Testnet para XDR, firma no custodial, envío y confirmación |
| IA | Proveedor LLM por definir, detrás de un adaptador reemplazable y con salida estructurada |
| Pruebas | Vitest y Testing Library; Playwright previsto para journey crítico |
| Workspace y CI | pnpm, Turborepo; GitHub Actions previsto (todavía no implementado) |

## Despliegue propuesto

- `apps/web` y `apps/api` tendrán artefactos y despliegues independientes. Vercel es el destino recomendado para el frontend, todavía no desplegado; el hosting de la API Fastify continúa **TBD y reemplazable**.
- `apps/worker` solo se desplegará como proceso independiente si las confirmaciones asíncronas o los jobs acotados no caben de forma segura en la API.
- Supabase aportará servicios gestionados, sin convertir al cliente web en dueño de la autorización ni de los estados críticos.

No existen despliegues productivos actualmente.

## Desarrollo y calidad

- **Estado actual:** `pnpm verify` ejecuta lint, typecheck, pruebas, build y verificación de boundaries entre workspaces. Las pruebas usan fixtures y dobles locales, sin depender de Testnet, Horizon ni del proveedor LLM.
- **CI:** GitHub Actions está previsto pero aún no implementado. El objetivo es determinismo: instalación con lockfile congelado, lint, typecheck, pruebas, contratos y builds en cada pull request.
- **Playwright** está previsto para proteger el journey crítico y sus fallbacks esenciales, pero aún no está instalado.
- **Comprobaciones externas:** Testnet y LLM se ejecutan por separado y de forma acotada en preview/demo o antes del ensayo.
- **Secretos:** se inyectan desde el entorno. No se deben confirmar seeds, claves privadas, tokens, PII ni credenciales en Git o logs.

## Planificación y gestión del desarrollo

La fuente de alcance para implementar la demo es el [plan de la demo](./docs/planning/DEMO.md). La planificación y la implementación se mantienen deliberadamente separadas: el plan define el resultado esperado y el backlog de GitHub organiza el trabajo ejecutable.

El backlog previsto se gestionará en un GitHub Project Kanban llamado **Vaqcrow-TFM**. El flujo de trabajo debe permitir distinguir el estado de cada unidad sin confundir planificación con entrega:

```text
docs/planning/DEMO.md
          │
          ▼
       OpenCode
          │
          ▼
   GitHub Project: Vaqcrow-TFM
          │
          ├── Epic
          │    ├── Feature
          │    │    ├── Task
          │    │    └── Task
          │    └── Feature
          │
          ├── Epic
          │    └── ...
          │
          └── Technical/Foundation work
               ├── Frontend setup
               ├── Backend setup
               ├── Database
               ├── Testing
               ├── CI/CD
               └── Deployment
```

El tablero debe contemplar, como mínimo, estados equivalentes a **Backlog**, **Ready**, **In Progress**, **Testing**, **Review**, **Blocked** y **Done**. La taxonomía final de estados, labels y campos se decidirá al analizar el plan completo, evitando crear categorías que no respondan a una necesidad real del proyecto.

Cada Feature o Task de implementación debe incluir contexto, objetivo, requisitos funcionales y técnicos, criterios de aceptación verificables, dependencias, estrategia de pruebas TDD y Definition of Done. El backlog debe cubrir tanto funcionalidades visibles como trabajo fundacional: monorepo, frontend, API, Supabase/PostgreSQL, contratos, IA, Stellar, datos sintéticos, testing, seguridad, CI/CD, despliegue, observabilidad y preparación de la demo.

La creación y organización del Project, sus issues, labels, campos y dependencias será una actividad de planificación independiente. No se deben marcar issues como completados sin evidencia en el repositorio, y la implementación solo comenzará después de seleccionar una unidad de trabajo con sus dependencias satisfechas.

## Documentación

- [Arquitectura del monorepo](./docs/architecture/monorepo.md) — decisión, árbol propuesto, dependencias, despliegue, testing y límites de crecimiento.
- [Plan de la demo](./docs/planning/DEMO.md) — historia de dos semanas, arquitectura, pruebas, demo y límites.
- [Plan del producto real](./docs/planning/product.md) — validación para Argentina, riesgos regulatorios y ruta hacia producción.
- [Diseño UI/UX y runbook de Google Stitch](./docs/design/demo-ui.md) — inventario visual, flujos, estados, accesibilidad y pendientes de diseño.

## Próximo paso

El monorepo, el shell de demo y los gates de calidad básicos ya están implementados. Las tareas abiertas (44 issues) cubren la implementación completa del journey vertical: esquema y guardrails de IA, integración con Stellar/Freighter, verificación XDR, confirmación asíncrona, cálculo de revenue share, distribución, dashboard de evidencia y preparación de la demo. El backlog se gestiona en el repositorio de GitHub.

## Licencia

Este repositorio se distribuye bajo la [licencia MIT](./LICENSE).
