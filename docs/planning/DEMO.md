# Vaqcrow — Plan de la demo para el Trabajo Fin de Máster (TFM)

> **Objetivo inmediato:** demostrar en dos semanas una experiencia completa de financiamiento con revenue share sobre Stellar Testnet. Es la demo del TFM del Máster en Desarrollo con IA, para evaluación y aprendizaje; no es un producto financiero habilitado para operar con dinero real.

## 1. Tesis del producto y de la demostración

Vaqcrow permite que una PyME argentina presente evidencia de ventas, reciba una evaluación de riesgo explicable asistida por IA y, después de una aprobación humana, obtenga financiamiento no custodial que se firma con Freighter y se liquida en Stellar Testnet. La demostración prueba una experiencia coherente de punta a punta: la IA transforma evidencia en una recomendación auditable, las personas conservan el control de sus claves y Stellar aporta liquidación verificable. KYC, ventas y el corredor ARS/activo Stellar se simulan detrás de interfaces reemplazables porque la prueba no pretende representar una operación regulada real.

## 2. Definición de éxito y posicionamiento

La propuesta se presenta como el proyecto final del **Trabajo Fin de Máster (TFM)** del **Máster en Desarrollo con IA**, construido en un sprint acotado de dos semanas. Su encaje temático está en **DeFi & Real-World Assets** y herramientas financieras locales, con la evaluación asistida por IA como capacidad diferencial del trabajo.

### Qué debe quedar probado ante el tribunal evaluador

- Una historia de usuario completa funciona en vivo en menos de siete minutos.
- La IA es una capacidad central y real, no una etiqueta: produce evaluación estructurada, evidencia, incertidumbre y alertas accionables.
- Freighter actúa como interfaz de wallet y firma; el usuario conserva sus claves y Vaqcrow nunca recibe su seed.
- Al menos un fondeo y una distribución de revenue share quedan confirmados en Stellar Testnet y vinculados a evidencia en el explorador.
- Cada simulación está identificada y tiene una interfaz que corresponde a una integración de producción creíble.
- Quien presenta el trabajo puede explicar con precisión qué se validó y qué sigue abierto para Argentina.

### Bloques Stellar utilizados

La demo puede identificar como bloques de construcción a Stellar Testnet, `@stellar/stellar-sdk`, Horizon, Freighter mediante `@stellar/freighter-api` y, solo como extensión acotada, Soroban mediante Stellar RPC. También pueden describirse anchors, activos locales, SDKs, wallets del ecosistema y protocolos DeFi como alternativas evaluadas, sin afirmar que todos estén integrados.

### Posición de la IA

En Vaqcrow, la IA se presenta como **diferenciador estratégico propio** del trabajo, coherente con el eje del máster cursado.

## 3. Historia vertical única

La demostración debe seguir una sola PyME sintética y evitar journeys paralelos:

1. **Solicitud:** “Panadería Horizonte SRL”, PyME argentina sintética, inicia una solicitud con identidad, ventas históricas y comprobantes simulados.
2. **KYC y ventas simulados:** los adaptadores devuelven un caso KYC aprobado y una serie de ventas con faltantes y una anomalía intencional.
3. **Evaluación real de IA:** el modelo analiza únicamente los datos entregados, detecta faltantes/anomalías y devuelve riesgo, razones, evidencia citada, incertidumbre y preguntas pendientes bajo un esquema validado.
4. **Aprobación humana:** un operador revisa evidencia y alertas, ajusta límites si corresponde y registra una decisión explícita. La salida de IA no aprueba por sí sola.
5. **Fondeo no custodial:** el inversor conecta Freighter, revisa una transacción construida por Vaqcrow con passphrase de Testnet explícita y firma el XDR sin entregar su clave.
6. **Verificación y envío:** el backend verifica red, cuenta fuente, destino, activo, monto, memo, secuencia, timeout, operaciones permitidas y firmas antes de enviar la transacción clásica.
7. **Confirmación asíncrona:** la interfaz muestra `submitted`; un worker acotado o un job durable consulta Horizon hasta `confirmed` o `failed`. La respuesta inicial nunca se presenta como liquidación final.
8. **Ventas mensuales simuladas:** el feed registra el siguiente período de ventas y aporta evidencia sintética claramente rotulada.
9. **Cálculo determinístico:** código de dominio calcula la obligación de revenue share con enteros/unidades mínimas y reglas versionadas; el LLM no calcula ni mueve fondos.
10. **Distribución real en Testnet:** la PyME revisa y firma con Freighter una transacción clásica de distribución. El sistema la verifica, envía y confirma de forma asíncrona.
11. **Evidencia:** el dashboard muestra decisiones, estados, montos, hashes y enlaces del explorador para el fondeo y la distribución.

## 4. Matriz real versus simulado

| Capacidad | En la demo | Evidencia visible | Reemplazo de producción |
|---|---|---|---|
| Perfiles y PyME | Datos sintéticos | Banner y fixtures versionados | Supabase Auth + modelo de identidad autorizado |
| KYC/KYB | **Simulado** por `KycProvider` | Resultado, timestamp y etiqueta `SIMULATED` | Proveedor KYC/KYB aprobado para Argentina; eventualmente SEP-12 con el anchor |
| Historial y feed mensual de ventas | **Simulado** por `SalesDataProvider` | Dataset reproducible, fuentes y anomalía conocida | APIs fiscales, bancarias, adquirentes o ERP con permiso y cobertura validados |
| Evaluación de riesgo | **Real** | JSON validado, evidencia citada, alertas, versión de prompt/modelo y aprobación humana | Servicio de underwriting gobernado, monitoreado y validado con datos autorizados |
| Decisión de financiamiento | **Real y humana** sobre caso sintético | Actor, timestamp, razones y límites | Workflow de operaciones/compliance con segregación de funciones |
| Cotización/entrada ARS a activo Stellar | **Simulada** por `FundingRailProvider` | Cotización, expiración y estado rotulados | Banco/anchor real para el corredor argentino; SEP-1, SEP-10, SEP-12, SEP-6/24 y SEP-38 según capacidades |
| Wallet y firma | **Real** con Freighter | Cuenta pública, consentimiento y XDR firmado | El mismo adaptador inicial, con evaluación de UX y soporte; siempre no custodial |
| Fondeo | **Real en Testnet** | Hash, operaciones y estado de Horizon | Activo y corredor aprobados en Public Network después de gates legales/operativos |
| Confirmación | **Real y asíncrona** | Estados `submitted`, `confirmed` o `failed`, latencia y reintentos | Worker durable, cursor persistente, alertas y reconciliación |
| Cálculo de revenue share | **Real y determinístico** | Entradas, regla versionada, redondeo y salida | Motor contractual revisado por legal/contabilidad |
| Distribución | **Real en Testnet**, firmada con Freighter | Hash, receptores, montos y confirmación | Flujo no custodial y activo aprobados, con controles y conciliación |
| Soroban | **No requerido**; stretch goal | Contrato pequeño desplegado solo si el camino clásico ya funciona | Capacidad justificada por amenaza, costo y requisito contractual |

**Regla de presentación:** una simulación demuestra UX, contratos de integración y control del flujo; no demuestra disponibilidad, legalidad, SLA, costos ni calidad de un proveedor real.

## 5. IA central, explicable y limitada

### Entrada mínima

- Perfil sintético de la PyME y sector.
- Serie mensual de ventas con procedencia por dato.
- Evidencia disponible, faltantes y contradicciones.
- Reglas determinísticas de elegibilidad y límites.

### Salida estructurada

```json
{
  "assessmentId": "asm_demo_001",
  "riskBand": "medium",
  "confidence": 0.72,
  "reasons": [
    { "claim": "Las ventas son estacionales", "evidenceRefs": ["sales:2026-01..08"] }
  ],
  "anomalies": [
    { "type": "outlier", "evidenceRef": "sales:2026-06", "severity": "review" }
  ],
  "missingData": ["Declaración del período 2026-04"],
  "recommendedAction": "human_review",
  "questions": ["¿Qué explica el incremento de junio?"]
}
```

La respuesta se valida contra un esquema estricto. Si contiene campos desconocidos, referencias inexistentes, tipos inválidos o no cita evidencia para una afirmación, se rechaza y pasa a revisión manual.

### Guardrails obligatorios

- La IA **no inventa datos**, no completa faltantes y no presenta inferencias como hechos.
- La IA **no aprueba**, no firma, no construye decisiones finales y no transfiere fondos.
- Los cálculos de monto, porcentaje, redondeo y distribución son determinísticos y se prueban fuera del LLM.
- Toda recomendación muestra evidencia, incertidumbre, modelo/prompt y aprobación o rechazo humano.
- Prompt injection en documentos se trata como contenido no confiable; las herramientas y salidas permitidas son cerradas.
- Ante timeout, salida inválida o proveedor caído, el caso continúa como `manual_review`, nunca como aprobación automática.

## 6. Arquitectura mínima para dos semanas

No se replica la arquitectura completa de producción. Se construyen dos aplicaciones desplegables —web y API—, un worker opcional y paquetes que preservan límites útiles. El proveedor de hosting permanece **TBD y reemplazable**: Next.js y el servicio Node.js con Fastify pueden tener destinos de despliegue distintos.

### Stack tecnológico recomendado

| Tecnología | Responsabilidad | Por qué es apropiada para esta demo de dos semanas |
|---|---|---|
| Next.js | Aplicación web, experiencia de demo y BFF solo para necesidades propias de la UI | Permite construir y desplegar rápidamente el journey sin trasladar comandos de dominio al navegador |
| Node.js + Fastify | Servidor HTTP/API de larga ejecución, desplegable por separado; orquesta dominio, verifica XDR y coordina solicitudes de IA | Mantiene un límite backend explícito con bajo costo de implementación y buen soporte TypeScript |
| GitHub Actions | CI/CD para pull requests, previews y ramas `main`/demo | Automatiza gates reproducibles sin fijar un proveedor de hosting |
| Vitest | Pruebas unitarias, de dominio y funcionales de la API | Ofrece feedback rápido y una configuración coherente con TypeScript |
| Testing Library | Pruebas de comportamiento de componentes de UI | Valida lo que observa y hace la persona usuaria, sin acoplarse a detalles internos |
| Playwright | Smoke tests y E2E del journey crítico en navegador | Protege la secuencia de demo que integra UI, API y Freighter |
| Supabase | Servicios gestionados: PostgreSQL, Auth opcional y Storage acotado | Reduce trabajo operativo durante el sprint sin convertirlo en dueño del dominio |
| PostgreSQL | Persistencia de solicitudes, decisiones, intenciones, estados e idempotencia | Aporta consistencia transaccional y trazabilidad con un modelo conocido |
| Stellar: Freighter, Horizon y Testnet | Firma no custodial, consulta/envío de transacciones y liquidación de prueba | Demuestra el núcleo técnico del challenge sin usar fondos reales |
| Proveedor LLM real, TBD | Evaluación estructurada de riesgo detrás de `packages/ai` | Hace real la capacidad diferencial y conserva un adaptador reemplazable |

```text
apps/
  web/                 # Next.js: UI, revisión, dashboard y BFF solo donde corresponda
  api/                 # Node.js + Fastify: comandos, dominio, XDR y coordinación de IA
  worker/              # Opcional: confirmaciones asíncronas y jobs acotados
packages/
  domain/              # Estados y cálculos determinísticos de revenue share
  stellar/             # Freighter, XDR, Horizon, envío y confirmación
  ai/                  # Prompt, esquema, evidencia y adaptador de modelo
  simulators/          # KYC, cotización/depósito y feed de ventas
  db/                  # Acceso a PostgreSQL, migraciones e idempotencia mínima
  ui/                  # Componentes compartidos que realmente tengan más de un uso
  testing/             # Fixtures, builders y contratos compartidos para pruebas
```

`apps/web` no sustituye al backend: contiene Next.js, la UI y un BFF únicamente cuando simplifica una necesidad propia de presentación. `apps/api` es un servicio Node.js con Fastify de larga ejecución y despliegue independiente; allí viven la autorización, los comandos de dominio, la verificación del XDR y la coordinación con IA y adaptadores externos. `apps/worker` se agrega únicamente si las confirmaciones o jobs acotados no caben de forma segura en el proceso de la API. No se crean `apps/admin`, microservicios, Kubernetes, un ledger de producción ni una jerarquía de paquetes por tabla durante el sprint.

Supabase aporta **PostgreSQL gestionado**. Supabase Auth se usa solo si la demo necesita identidades reales, y Supabase Storage se limita a fixtures sintéticos o evidencia de la demostración. Fastify valida la identidad y es dueño de la autorización y de los comandos de dominio: el navegador no escribe directamente estados críticos ni recibe credenciales de servicio de Supabase.

```mermaid
flowchart LR
    DEV[Desarrollador] --> REPO[Repositorio GitHub]
    REPO --> CI[GitHub Actions CI/CD]

    CI -->|despliega| WEB[Destino web TBD<br/>apps/web · Next.js]
    CI -->|despliega| API[Destino API TBD<br/>apps/api · Node.js + Fastify]
    CI -.->|despliega si se habilita| WORKER[Destino de jobs TBD<br/>apps/worker opcional]

    BROWSER[Navegador<br/>inversor, PyME u operador] -->|HTTPS| WEB
    BROWSER <-->|firma no custodial| FREIGHTER[Freighter]
    WEB -->|solicitudes y XDR firmado| API
    API -->|estado y XDR para revisión| WEB

    API --> DOMAIN[packages/domain]
    API --> AIPKG[packages/ai]
    API --> STELLARPKG[packages/stellar]
    API --> SIM[packages/simulators]
    API -.->|coordina jobs acotados| WORKER

    AIPKG --> LLM[Proveedor LLM real]
    SIM --> KYC[KYC simulado]
    SIM --> SALES[Ventas simuladas]
    SIM --> FUNDING[Fondeo/ARS simulado]

    API --> AUTH[Supabase Auth<br/>si la demo lo requiere]
    API --> DB[(Supabase PostgreSQL)]
    API --> STORAGE[Supabase Storage<br/>fixtures/evidencia sintética]
    WORKER --> DB

    STELLARPKG --> HORIZON[Horizon]
    WORKER --> HORIZON
    HORIZON --> TESTNET[Stellar Testnet]
```

Las flechas continuas representan relaciones de ejecución; las flechas punteadas, componentes opcionales. Fastify es el framework/servidor HTTP de Node.js, **no** la plataforma de despliegue. Los destinos web, API y worker quedan desacoplados para elegir, sustituir o revertir cada hosting por separado.

### CI/CD con GitHub Actions

**En cada pull request:**

1. Instalar dependencias con lockfile congelado.
2. Ejecutar lint y typecheck.
3. Ejecutar Vitest para pruebas unitarias, funcionales y de componentes con Testing Library.
4. Construir las aplicaciones y ejecutar las pruebas determinísticas, incluidos los contratos de adaptadores con dobles locales.

**En la rama `main` o demo:**

1. Repetir todos los gates requeridos del pull request.
2. Preparar un candidato aislado en preview o demo y ejecutar un smoke/E2E acotado con Playwright sobre el journey crítico.
3. Desplegar o promover Next.js y la API Fastify solo después de que los gates y Playwright pasen; desplegar el worker únicamente si forma parte del candidato habilitado.

Los secretos se inyectan mediante GitHub Environments y GitHub Secrets. Ninguna seed de Testnet ni token de Supabase, del proveedor LLM o del hosting se escribe en YAML o se imprime en logs. Los workflows permanecen independientes del proveedor; web y API tienen artefactos, despliegues y rollback separados.

### Patrón de adaptadores reemplazables

```ts
interface KycProvider {
  startCase(input: KycInput): Promise<KycCase>;
  getCase(caseId: string): Promise<KycCase>;
}

interface FundingRailProvider {
  createQuote(input: QuoteInput): Promise<ExpiringQuote>;
  getDeposit(depositId: string): Promise<DepositState>;
}

interface SalesDataProvider {
  getPeriods(businessId: string): Promise<SalesPeriod[]>;
  getEvidence(periodId: string): Promise<EvidenceRef[]>;
}
```

Los simuladores y proveedores reales implementan los mismos contratos normalizados. En producción, `KycProvider` apunta al proveedor KYC/KYB autorizado; `FundingRailProvider`, al banco/anchor y sus SEPs acordados; `SalesDataProvider`, a fuentes fiscales, bancarias, adquirentes o ERP autorizadas. La UI y el dominio no importan fixtures ni SDKs externos directamente.

## 7. Stellar Testnet y firma no custodial

### Camino obligatorio

- Usar `@stellar/stellar-sdk` para construir, decodificar, verificar y consultar transacciones.
- Integrar Freighter mediante `@stellar/freighter-api` detrás de un adaptador propio.
- Enviar a Freighter el XDR y la passphrase explícita de **Testnet** para cada solicitud de firma.
- Usar Horizon para cuentas, operaciones y confirmación de pagos clásicos.
- Persistir intención, hash, XDR pertinente, cuenta, sequence number, expiración y estado, sin secretos.
- Responder `202 Accepted` o equivalente al envío y mostrar `submitted`; confirmar después por polling.
- Antes de enviar un XDR firmado, verificar en backend red, fuente, destino, activo, monto, memo, secuencia, timeout, operaciones permitidas y firmas esperadas.

Freighter es una **wallet e interfaz de firma**, no un custodio. Cada participante controla su clave y acepta la transacción. Vaqcrow prepara y verifica transacciones, pero nunca solicita, recibe ni almacena seeds de usuarios.

### Entornos y secretos

| Entorno | Red/datos | Restricción |
|---|---|---|
| Local/CI | Dobles determinísticos; opcional red local | Ninguna dependencia de Testnet para pruebas rápidas |
| Preview | Testnet y datos sintéticos | Cuentas aisladas por despliegue; no reutilizar credenciales sensibles |
| Demo | Testnet y dataset congelado | Cuentas precargadas solo con activos de prueba; hashes preparados como respaldo |
| Producción futura | Public Network y proveedores aprobados | Fuera del alcance; requiere gates legales, operativos y de seguridad |

Variables mínimas: URL de Horizon Testnet, passphrase de red, identificadores de cuentas públicas, URL del explorador, proveedor/modelo LLM y credenciales del servidor. Ninguna seed, clave privada, token real, documento personal ni fondo real se incorpora a Git. Las cuentas de Testnet se provisionan mediante Friendbot o tooling oficial y se rotulan como descartables.

### Decisión Soroban

El camino base usa pagos clásicos y **debe funcionar sin Soroban**. Un contrato pequeño de escrow/reembolso en Rust puede desarrollarse como stretch goal solo después de congelar una demo estable y únicamente si no altera el flujo de fondeo/distribución. Requiere pruebas, deployment reproducible y confirmación terminal mediante Stellar RPC. Si consume tiempo del camino crítico, se elimina.

## 8. Plan de catorce días

| Día | Objetivo | Salida verificable | Dependencia |
|---|---|---|---|
| 1 | Congelar historia, claims y dataset | Guion, wireflow, matriz real/simulado y datos sintéticos | Ninguna |
| 2 | Shell de demo y estados | Navegación completa con fixtures y banners | Día 1 |
| 3 | Dominio y persistencia mínima | Estados, cálculo monetario, IDs correlacionados | Día 1 |
| 4 | Contrato de IA | Esquema, prompt, evidencia y casos golden | Dataset |
| 5 | IA integrada | Evaluación real, anomalías, faltantes y fallback manual | Día 4 |
| 6 | Freighter y construcción XDR | Conexión, cuenta, red, vista previa y firma | Shell |
| 7 | Pago clásico Testnet | XDR verificado y transacción enviada | Día 6 |
| 8 | Confirmación asíncrona | Polling, estados terminales, reanudación y enlace explorer | Día 7 |
| 9 | Ventas y obligación | Feed simulado + cálculo determinístico auditable | Dominio |
| 10 | Distribución Testnet | Transacción firmada, enviada y confirmada | Días 8–9 |
| 11 | Integración vertical | Journey completo con correlation ID único | Días 2–10 |
| 12 | Resiliencia y evidencias | Fallbacks, telemetría y dataset congelado | Día 11 |
| 13 | Ensayo con público interno | Demo ≤7 min, tres repeticiones y defectos críticos cerrados | Día 12 |
| 14 | Freeze y presentación final | Build etiquetado, video y hashes de respaldo | Día 13 |

### Frentes de trabajo

| Frente | Responsabilidad | Puede avanzar en paralelo desde |
|---|---|---|
| Producto/demo | Historia, UX, claims, guion y material visual | Día 1 |
| IA/datos | Dataset, esquema, prompt, evaluaciones y guardrails | Día 1 |
| Stellar | Freighter, XDR, Testnet, confirmación y explorador | Día 2 |
| Dominio/integración | Estados, cálculo, persistencia, adaptadores y E2E | Día 2 |

Dependencia crítica: `demo-shell -> AI assessment -> Stellar payment -> confirmation -> revenue-share distribution -> integration/demo hardening`. La UI puede usar estados predefinidos mientras IA y Stellar se implementan, pero la integración final no puede falsificar esos dos caminos reales.

### Línea de corte

Se elimina trabajo en este orden:

1. Contrato Soroban de escrow/reembolso.
2. `apps/worker` separado si el polling durable cabe de forma segura en el servicio API.
3. Animaciones, visualizaciones avanzadas y pantallas secundarias.
4. Segundo caso de PyME, segundo activo o variantes del journey.
5. Persistencia avanzada, autenticación completa y backoffice separado.

Nunca se recortan la evaluación real de IA, la aprobación humana, la firma real con Freighter, el pago Testnet, la confirmación asíncrona, la distribución Testnet ni el rotulado de simulaciones.

## 9. Guion de demo de 5–7 minutos

| Tiempo | Acción | Mensaje clave |
|---|---|---|
| 0:00–0:40 | Presentar problema, tesis y límites | Capital flexible para PyMEs argentinas; demo en Testnet, no oferta real |
| 0:40–1:30 | Abrir la solicitud sintética | KYC y ventas están simulados y claramente identificados |
| 1:30–2:30 | Ejecutar evaluación de IA | La IA cita evidencia, detecta anomalía/faltante y expresa incertidumbre |
| 2:30–3:00 | Aprobar como operador | Una persona decide; el modelo no autoriza fondos |
| 3:00–4:15 | Conectar Freighter y fondear | Firma no custodial, XDR verificable y estado inicialmente pendiente |
| 4:15–4:45 | Mostrar confirmación y explorer | Stellar aporta evidencia de liquidación Testnet |
| 4:45–5:45 | Cargar ventas y distribuir | Ventas simuladas, cálculo determinístico, firma y distribución real Testnet |
| 5:45–6:30 | Dashboard, límites y siguiente paso | Dos hashes, trazabilidad completa y reemplazos de producción claros |

## 10. Criterios de aceptación

- [ ] El journey único se completa desde un navegador limpio en siete minutos o menos.
- [ ] Toda pantalla que usa datos simulados muestra `SIMULADO` sin depender de explicación oral.
- [ ] La salida de IA cumple el esquema, cita referencias existentes y detecta el faltante/anomalía del fixture.
- [ ] No existe camino en el que la IA apruebe o calcule una transferencia.
- [ ] La aprobación humana registra actor, decisión, razones y timestamp.
- [ ] Freighter solicita cuenta y firma con passphrase de Testnet explícita; ninguna seed entra a Vaqcrow.
- [ ] El backend rechaza un XDR con red, destino, activo, monto u operaciones distintas de la intención.
- [ ] Fondeo y distribución pasan por `submitted` antes de un estado terminal confirmado por Horizon.
- [ ] Ambos movimientos muestran hash, operaciones y enlace de explorador Testnet.
- [ ] El cálculo de revenue share usa unidades mínimas, regla versionada y política explícita de redondeo.
- [ ] LLM y red pueden fallar sin dejar la interfaz bloqueada ni afirmar éxito.
- [ ] No hay secretos, seeds, PII ni fondos reales en repositorio, logs o fixtures.

## 11. Pruebas y evidencia operativa

| Herramienta/nivel | Cobertura mínima del sprint |
|---|---|
| Vitest — unidad y dominio | Cálculo y redondeo de revenue share, transiciones de estado, esquema de IA y verificación XDR |
| Vitest — funcional de API | Rutas Fastify y secuencia construcción -> verificación -> envío -> confirmación, con éxito, rechazo, autorización e idempotencia |
| Vitest — golden/IA | Caso esperado, faltante, anomalía, alucinación/referencia inválida y respuesta mal formada |
| Testing Library + Vitest — componentes | Comportamiento visible de formularios, revisión humana, estados pendientes/terminales, errores y rótulos `SIMULADO` |
| Contrato de adaptadores | KYC, ventas, funding rail, LLM, Freighter y Horizon contra fixtures versionados y dobles determinísticos |
| Playwright — smoke/E2E | Journey crítico completo en navegador: solicitud, evaluación, aprobación, Freighter, fondeo, confirmación y distribución; fallbacks esenciales de LLM/red |
| Testnet — comprobación operativa | Fondeo y distribución con cuentas aisladas y passphrase explícita, ejecutados fuera de la suite CI determinística |

Las pruebas de pull request no dependen de Testnet, Horizon ni del proveedor LLM: usan dobles y fixtures reproducibles. Las comprobaciones reales de Testnet se ejecutan de manera separada y acotada en preview/demo o manualmente antes del ensayo; un fallo externo no se confunde con una regresión determinística. Playwright protege el journey de demostración, no una matriz exhaustiva de navegadores.

Cada ejecución usa un `correlationId` visible. Se registran latencia del LLM, validación/reintento, decisión humana, hash, estado de transacción, latencia de confirmación y error sanitizado. El panel de demo expone una línea temporal; los logs no contienen XDR innecesario, tokens, secretos ni PII.

### Plan de contingencia

- **LLM caído o lento:** mostrar una evaluación previamente generada y firmada como `RESPUESTA DE RESPALDO`, conservar entradas y versión, y continuar mediante revisión humana. No presentarla como llamada en vivo.
- **Testnet/Horizon caído:** mostrar el intento pendiente, explicar el diseño asíncrono y abrir hashes confirmados durante el ensayo. No cambiar un estado a confirmado manualmente.
- **Freighter no disponible:** usar un video corto del flujo real y los XDR/hashes del ensayo; no usar una seed incrustada como atajo.
- **Aplicación caída:** mantener video completo, capturas, JSON de IA, XDR decodificados y enlaces del explorador en un paquete de evidencia offline.

## 12. Claims y disclaimers exactos

Estos textos deben aparecer en la aplicación y en la presentación, sin eufemismos:

> **Demostración con datos simulados.** La identidad, el KYC/KYB, las ventas y la conversión ARS/activo Stellar de este caso son sintéticos. No representan verificaciones ni movimientos de dinero real.

> **Stellar Testnet.** Las transacciones mostradas usan activos sin valor económico en Stellar Testnet. Un hash de Testnet demuestra ejecución técnica, no una inversión real ni disponibilidad en producción.

> **Firma no custodial.** Freighter es la wallet e interfaz de firma. La persona usuaria conserva sus claves; Vaqcrow construye y verifica la transacción y nunca recibe su seed.

> **IA con supervisión humana.** La IA organiza evidencia, identifica anomalías y propone una evaluación explicable. No inventa datos, no toma la decisión final, no calcula obligaciones financieras y no transfiere fondos.

> **No apto para producción.** Esta demo no constituye una oferta de inversión, recomendación financiera, aprobación regulatoria ni prueba de legalidad, rentabilidad, solvencia, custodia, calidad de proveedores u operación en Argentina.

## 13. SDD-lite por capacidad

Cada slice conserva una ficha breve con: objetivo, escenarios observables, límites, tareas, pruebas y evidencia. No se crea una especificación global de la startup ni se bloquea el sprint con ceremonia documental.

| Orden | Cambio acotado | Escenarios imprescindibles | Evidencia de cierre |
|---|---|---|---|
| 1 | `demo-shell` | Caso sintético, estados y rotulado de simulaciones | Journey navegable y fixture congelado |
| 2 | `ai-assessment` | Éxito, faltante, anomalía, salida inválida y timeout | JSON validado, golden tests y revisión humana |
| 3 | `stellar-payment` | Conectar, firmar, verificar, enviar y rechazar XDR alterado | Hash Testnet y pruebas de verificación |
| 4 | `stellar-confirmation` | Pendiente, éxito, fallo y reanudación | Timeline y estado terminal consultado |
| 5 | `revenue-share-distribution` | Cálculo, redondeo, firma y reparto | Asignaciones balanceadas y hash Testnet |
| 6 | `integration-demo-hardening` | Journey completo, caída de LLM/red y respaldo | Ensayo ≤7 minutos y paquete de evidencia |

Flujo reducido: `proposal breve -> scenarios/design notes -> tasks -> implementation/tests -> evidence`. Cada ficha debe caber en una revisión corta y puede detenerse si amenaza el camino crítico.

## 14. Decisiones abiertas reales

| Prioridad | Decisión | Fecha límite | No bloquea |
|---|---|---|---|
| P0 | Elegir el activo de prueba y cuentas Testnet para el guion | Día 2 | Validación futura del corredor real |
| P0 | Elegir proveedor/modelo LLM y presupuesto/timeout de demo | Día 2 | Modelo de underwriting de producción |
| P1 | Resolver si el hosting exige `apps/worker` separado | Día 6 | Diseño del worker de producción |
| P2 | Autorizar o descartar el stretch goal Soroban | Día 10 | Camino clásico obligatorio |

Argentina y el modelo no custodial con Freighter están resueltos y **no se reabren** durante el sprint. El corredor ARS/activo Stellar, el anchor y la clasificación legal continúan como decisiones de producción, no como bloqueantes de Testnet.

## 15. Fuentes

### Stellar

- Guía frontend y firma con Freighter: <https://developers.stellar.org/docs/build/guides/dapps/frontend-guide>
- SDKs cliente: <https://developers.stellar.org/docs/tools/sdks/client-sdks>
- Horizon: <https://developers.stellar.org/docs/data/apis/horizon>
- Stellar RPC: <https://developers.stellar.org/docs/data/apis/rpc>
- Stellar CLI: <https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli>
- Wallets y anchors: <https://developers.stellar.org/docs/build/apps/wallet/intro>
