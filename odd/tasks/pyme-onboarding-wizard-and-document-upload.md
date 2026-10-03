# Bitácora: wizard de alta de la PyME y carga de documentos

## Objetivo

Entregar el wizard único de alta de la PyME (KYC simulado → Registro PyME → Evaluación AI → Revisión humana) y la carga real de documentos y fotos a un bucket privado de Supabase Storage (RLS por propietario), dentro de `/company` y sin ruta propia. Task [#399](https://github.com/reyduar/Vaqcrow/issues/399) de la Feature [#398](https://github.com/reyduar/Vaqcrow/issues/398) (Epic [#374](https://github.com/reyduar/Vaqcrow/issues/374)).

## Ramas y entrega

- Rama de integración: `Vaqcrow#398_Feat_Guide_PyMEs_through_simulated_KYC_registration_and_document_upload`, creada desde la rama de la Feature #378 (`eaad04f`).
- Rama de trabajo: `Vaqcrow#399_Task_Implement_the_PyME_onboarding_wizard_and_document_upload`, creada desde la rama de #398; su PR apunta a la rama de #398.
- **Entrega apilada:** `main` todavía no tiene #369/#378; #398/#399 se apilan sobre eso. Antes del merge a `main` de #369 + #378 hay que resolver **R1-002** (propiedad por fila) con esta Feature y entregar **#438**.

## Fuente de diseño

Template exportado por el owner en `docs/design/template/` (directorio ignorado por git):

- `Vaqcrow Onboarding PyME.dc.html` (owner, export 2026-10-03 13:28) — fuente visual y de comportamiento del wizard. **Cuatro** pasos: `KYC`, `Registro PyME`, `Evaluación AI`, `Revisión humana`.
- `docs/design/design_handoff_vaqcrow/` (README, brief, screens) — handoff de diseño.
- `docs/design/demo-ui.md` §4 (líneas 170/176): el wizard vive **dentro de `/company`**, sin ruta propia.

> [!warning] Conflicto de alcance a resolver con el owner
> El texto de #398/#399 dice «wizard de **tres** pasos (KYC → Registro → Revisión)», pero el template y la decisión **D12** (owner, 2026-10-03) tienen **cuatro** pasos con `Evaluación AI` como paso 3 y `Revisión humana` como paso 4. Por `CLAUDE.md` («the template prevails wherever they conflict») y por D12 se sigue el template de **4 pasos**. La `Evaluación AI` del template (banda de riesgo + checks) puede solaparse con la Feature [#402](https://github.com/reyduar/Vaqcrow/issues/402); se registra como decisión pendiente.

## Decisiones del owner ya fijadas (no relitigar)

| # | Decisión |
|---|---|
| D12 | (2026-10-03) Paso 4 «Revisión humana»: la propia PyME envía con «Enviar a revisión»; la wallet Freighter es **obligatoria** (sin ella «Conectar Freighter» pasa a rojo «Obligatorio» y se bloquea el envío); al enviar, «Revisión humana» pasa a amarillo («En proceso») y luego al aviso verde con «Ir a Mi campaña». El despliegue es **firmado por la plataforma**; la PyME sólo entrega su clave pública. |
| — | El wizard vive dentro de `/company`, sin ruta propia; «Registrar mi PyME» se muestra sólo mientras la PyME no registró su empresa. No hay popup de wallet al entrar a `/company`. |
| — | La carga de documentos/fotos es **real** a un bucket privado (RLS por propietario, 10 MB, PDF/JPG/PNG); el contenido subido es no confiable. |
| — | El KYC es simulado, detrás de un puerto; el resultado se guarda con proveedor, referencia y la marca `SIMULADO`. |
| — | El CUIT se valida sólo como 11 dígitos (sin AFIP/ARCA real). |

## Decisiones del owner sobre la carga de documentos (2026-10-03)

El owner aprobó tal cual («dale a todo») los cinco puntos propuestos:

| # | Decisión |
|---|---|
| U1 | **Tres ranuras de documentos fijas y obligatorias** — Declaraciones de ventas, Constancia de CUIT, Estatuto —, un archivo cada una, PDF/JPG/PNG ≤ 10 MB; las tres hacen falta para enviar. |
| U2 | **Fotos: hasta 4, opcionales.** |
| U3 | **Subida al elegir el archivo** (con barra de progreso); la referencia se guarda al enviar y el objeto se borra al quitarlo. |
| U4 | **Orden de fotos con botones «mover ←/→»** (no arrastrar). |
| U5 | **Copy nuevo:** lo redacta el agente en español neutro (voseo) y el owner lo aprueba en la revisión. |

Asumido y confirmado: las ranuras **reemplazan el mock** «Adjuntar declaraciones (PDF)» del template y la carga vive **dentro del paso 2**, donde el template ubica «Declaraciones de ventas». «Estatuto» = estatuto social (*articles of incorporation*); «Declaraciones de ventas» = los comprobantes que respaldan la grilla de ventas mensuales.

## Decisiones pendientes del owner (de #398, «Not designed in the template»)

Estas **no se implementan** hasta que el owner decida; se registran como supuestos si hay que avanzar y se marcan para aprobación:

1. ~~UI de carga de fotos y ranuras de documentos~~ — resuelta arriba (U1–U5).
2. Guardar borrador y retomar el wizard (el template es sólo en memoria), y editar tras el envío vía «Revisar lo cargado» / reenviar tras «Requiere cambios».
3. El banner «Demo: usá datos sintéticos…» y el botón «Completar con datos de ejemplo» frente a la carga real de documentos: si se quedan o se van (hoy están, tal cual el template).

## TDD

- Modo: **activado** (RED observado antes del GREEN).
- Runners: Vitest + Testing Library en `apps/web` (`pnpm --filter @vaqcrow/web exec vitest run <archivo>`), pgTAP (`pnpm run test:db`) para migraciones/RLS, y Playwright offline para el recorrido con dobles. Los tests de PR nunca tocan Supabase Storage, Resend, Testnet ni el LLM en vivo.
- Skills a cargar antes de escribir: `supabase`, `supabase-postgres-best-practices` (migraciones/RLS/Storage), `frontend-design` y `heroui-react` (UI), `zustand` (estado de cliente si hace falta).

## Tareas

- [x] **T1 — Andamiaje del wizard en `/company` + paso 1 (KYC simulado).** Sin persistencia. El wizard se abre desde «Registrar mi PyME» (hoy inerte). Incluye stepper de 4 pasos (`aria-current="step"`), «Volver», el paso 1 completo del template (documento sintético Persona A/B, `Iniciar verificación simulada` / `Usar archivo de prueba`, busy ~1,3 s «Verificando con el adaptador simulado…», resultado aprobado/requiere cambios con referencia, proveedor y `SIMULADO`, aside «¿POR QUÉ KYC?»). El adaptador KYC va detrás de un puerto; su doble de pruebas es en memoria.
  - Ruta: delegada (writer acotado; más de dos archivos no triviales).
  - Diseño: `KycPort` (`application/ports/kyc-port.ts`, sin React ni SDK) con `verify({ document }) → { outcome, reference, provider }`; `SimulatedKycAdapter` (`infrastructure/kyc/`) determinista, referencia `kyc:PH-2026-0001`, proveedor «Adaptador KYC simulado v1», retardo inyectable por defecto 1300 ms. `CompanyWorkspace` (cliente) alterna el esqueleto del panel y el wizard **en la misma URL** (sin ruta propia); `company/page.tsx` (servidor) lo monta. Máquina de estados y copy puros en `application/pyme-onboarding/kyc-step.ts`. Doble `test/fake-kyc.ts`.
  - **Supuesto para el owner (registrado en el adaptador):** `person_a` (responsable) → `approved`; `person_b` (socia) → `requires_changes`. El template sólo exponía el resultado por una prop (`kycOutcome`); este mapeo determinista hace visible la rama «Requiere cambios» en la demo.
  - **Desvío registrado:** CTAs nativos de 52 px y `<select>` nativo de 48 px (los primitivos compartidos fijan 44 px y el `Select` abre un listbox popover), con los tokens Tailwind del repo; mismo patrón que `AuthField` (desvío de T3 de la bitácora de #379).
  - RED (`pnpm --filter @vaqcrow/web exec vitest run src/application/pyme-onboarding src/infrastructure/kyc src/presentation/components/pyme-onboarding`): `Test Files 4 failed (4)` por import sin resolver. GREEN: `Test Files 4 passed (4)`, `Tests 35 passed (35)`.
  - Verificación (orquestador, árbol de trabajo): `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → `Test Files 135 passed (135)`, `Tests 1264 passed (1264)` (tras actualizar el caso de `/company` en `app-pages.test.tsx`, que aún afirmaba el botón inerte); `lint` 0 errores (1 warning previo `fetch-http-client.ts`); `typecheck` sin errores; `pnpm run boundaries` → `no dependency violations found (644 modules, 2081 dependencies cruised)`.
  - Pendiente de T1: «Siguiente paso» es un no-op (el paso 2 llega en T2); el botón «Registrar mi PyME» se muestra siempre hasta que T3 sepa si la PyME ya registró su empresa.
  - Commit: `feat(web): add the PyME onboarding wizard shell and simulated KYC step`.
  - Revisión RDD de T1 (2026-10-03): base `eaad04f`, sólo commits, riesgo `medium` (13 archivos, 1198 líneas); el owner eligió «Revisar este cambio»; una lente (`review-reliability`) sin bloqueantes → `approved`, linaje `review-4d5cf8ad979f842c`, autoridad `burned`. Consultivos (2 `SUGGESTION`, no bloqueantes, trabajo posterior):
    - **R3-001** (`pyme-onboarding-wizard.test.tsx:104-106`): el test del estado busy libera la promesa dentro de un `void act(...)` no esperado (los hermanos usan `await act(async …)`), así que la transición busy→done puede flushear fuera de `act` y filtrar un update hacia el test siguiente. Arreglar la higiene del test en T2 (mismo archivo).
    - **R3-002** (`pyme-onboarding-wizard.tsx:88-93`): ante un rechazo del adaptador el wizard vuelve a `idle` en silencio (sin señal de error); hoy sólo es alcanzable por el doble porque el `SimulatedKycAdapter` no rechaza. Cuando se cablee un proveedor real, un fallo de verificación se vería igual que «nunca empezó». Revisar cuando entre el proveedor real.
- [x] **T2 — Paso 2 «Registrá tu PyME».** Formulario completo del template (razón social, CUIT 11 dígitos, rubro, ciudad, descripción ≥ 20, grilla de ventas de 8 meses con faltante/anomalía, meta ≥ ARS 1.000.000, revenue share 1–10 %), validación con errores inline y resumen «Revisá N campos.», y el aviso «La IA recomienda; una persona decide.». Sin persistencia todavía.
  - Ruta: delegada (writer acotado).
  - Diseño: el wizard pasa a manejar `stepIndex` y el stepper usa `wizardStepStates(stepIndex)`; «Siguiente paso» tras un KYC aprobado avanza a `stepIndex=1` (un KYC rechazado conserva el reintento). Modelo puro en `application/pyme-onboarding/registration-step.ts` (`REGISTRATION_COPY`, `SECTOR_OPTIONS`, `SALES_MONTHS`, `DEMO_VALUES`, `parseAmount`, `validateRegistration`, `registrationValid`, `salesAnomaly`, `salesMissing`); formulario en `presentation/components/pyme-onboarding/registration-step.tsx`. `parseAmount` espeja el `num` del template (saca puntos de miles, coma → punto); un campo vacío parsea a `0`, así que el mes vacío se detecta por `=== ""`, nunca por su valor. `salesAnomaly` promedia sólo los meses positivos y marca `> 1,5 ×` promedio (el junio del demo es la única anomalía; abril vacío queda como faltante).
  - Seam de submit: `onSubmit?: (values) => void | Promise<void>` (default no-op); el estado «Enviando…» aparece sólo si `onSubmit` devuelve una promesa. T5 lo cablea a la persistencia/evaluación.
  - **Fuera de T2 (a propósito):** el control «Declaraciones de ventas» (attach) del template no se renderiza: la carga real es T4 y su UI es la decisión pendiente 1 del owner. Anotado en los dos archivos nuevos.
  - **Desvíos registrados:** (1) campos nativos de 48 px y submit de 54 px con los tokens del repo (los primitivos compartidos fijan 44 px y el `Select` abre un popover), misma familia que T1; (2) los indicadores de faltante/anomalía llevan texto accesible «Faltante»/«Anomalía» (el template sólo dibuja un ícono; la regla de producto prohíbe el significado sólo por color); (3) «Volver» sigue visible en el paso 2 (el template sólo lo dibuja en KYC; sin ruta propia, ocultarlo dejaría a la persona sin salida).
  - Fix R3-001 de la revisión de T1: el test del estado busy ahora usa `await act(async () => { release(); })`.
  - RED (`pnpm --filter @vaqcrow/web exec vitest run src/application/pyme-onboarding/registration-step.test.ts` y el `.test.tsx`): módulo inexistente (`no tests`). GREEN: modelo `27 passed`, componente `14 passed`; foco `Test Files 5 passed (5)`, `Tests 71 passed (71)`.
  - Verificación (orquestador, spot-check): foco `Test Files 5 passed (5)`, `Tests 71 passed (71)`. Del writer: suite web `Test Files 137 passed (137)`, `Tests 1305 passed (1305)`; `lint` 0 errores (1 warning previo); `typecheck` sin errores; `pnpm run boundaries` → `no dependency violations found (649 modules, 2092 dependencies cruised)`.
  - Commit: `feat(web): add the PyME registration step with the sales grid`.
  - Revisión RDD de T2 (2026-10-03): base `a1e72b4`, sólo commits, riesgo `medium` (7 archivos, 1190 líneas); el owner eligió «Revisar este cambio»; una lente (`review-reliability`) sin bloqueantes → `approved`, linaje `review-6fcbdd62cf3abc01`, autoridad `burned`. Consultivos (no bloqueantes, trabajo posterior):
    - **R3-001** (`registration-step.tsx:139-147`, `WARNING`): `handleSubmit` espera `onSubmit` dentro de `try/finally` sin `catch`; un rechazo se convierte en promesa rechazada sin manejar y no muestra señal de error (indistinguible de un éxito lento). Hoy sólo alcanzable cuando T5 cablee la persistencia; cubrir el camino de rechazo y mostrar un error al cablearlo.
    - **R3-002** (`registration-step.ts:158-160`, `SUGGESTION`): la regla de ventas cuenta todo lo que no sea string vacío, así que un mes con sólo espacios cuenta para los 6/8 aunque `parseAmount` dé 0. Ajustar a `trim() !== ""` (o documentar) cuando se toque.
- [ ] **T3 — Persistencia y propiedad (R1-002).** Modelo de empresa de la PyME y propiedad por fila: tabla `businesses` + `owner_user_id`, puerto/adaptador, y el scoping por dueño en las rutas PyME de la API (`POST/GET /sme-requests`, `/businesses/*/sales-periods`, `/revenue-share-distributions*`). Migración local-docker → remoto en la misma unidad. Resuelve la brecha R1-002 de la evidencia de #369/#378.
  - Ruta: delegada (writer acotado; varios archivos de API + migración + pgTAP).
- [ ] **T4 — Carga real de documentos y fotos.** Bucket privado de Supabase Storage con RLS por propietario, puerto/adaptador de Storage en la API con validación de MIME/magic bytes/tamaño independiente del cliente, nombres saneados, y la UI de carga. Se divide en tres unidades:
  - **Arquitectura de transporte (decidida por el agente, sujeta a objeción del owner):** la subida es **mediada por la API** (`POST` multipart → la API valida y escribe en el bucket con `service_role`), no directa desde el navegador. Motivos: `CLAUDE.md` (la API es dueña de autorización/permisos y la `service_role` es sólo del servidor), y «validación server-side independiente del cliente» se cumple mejor recibiendo los bytes. **Desvío registrado:** el texto de #398 dice «owner reads/writes own objects»; con este transporte el dueño **lee** lo suyo (RLS) y la API escribe en su nombre con `service_role`. El criterio de aceptación («otro usuario no puede leer los archivos de una PyME; los admin sí») se cumple.
  - [x] **T4a — Migración + RLS.** Bucket privado `pyme-documents` (`file_size_limit` 10 MB, `allowed_mime_types` PDF/JPEG/PNG) y políticas de `storage.objects`: el dueño lee/escribe su propia ruta (primer segmento = `auth.uid()`), `ADMIN` lee todo (subconsulta a `public.profile`). Ruta: `<user_id>/<kind>/<uuid>-<nombre-saneado>`, `kind ∈ {sales-declarations, cuit, articles-of-incorporation, photo}`. pgTAP local + aplicar al remoto. Ruta: delegada.
    - Migración `supabase/migrations/20261003120000_create_pyme_documents_bucket.sql` (SHA-256 `304c4ddc…83a9c`), idempotente; 5 políticas (`owner_read/insert/update/delete`, `admin_read`). Test pgTAP `supabase/tests/pyme_documents_bucket.sql` (19 asserts).
    - **Entorno:** Storage estaba deshabilitado en el perfil docker (`[storage] enabled = false` y `storage-api` excluido en `scripts/local-env.sh`). El owner autorizó habilitarlo; se puso `[storage] enabled = true`, se sacó `storage-api` de `SUPABASE_EXCLUDE` (queda `imgproxy`), se reinició el stack local (Storage S3 en `:54321/storage/v1/s3`) y se alineó `docs/architecture/environments.md` §3.
    - RED: el pgTAP corría 0/20 antes de aplicar la migración. GREEN: `pnpm run test:db` → `Files=10, Tests=192`, `Result: PASS`. El owner SELECT/INSERT/UPDATE y el `ADMIN` read-all quedaron probados; el DELETE se afirma por existencia porque Storage prohíbe el borrado por SQL (`protect_objects_delete`): **T4b debe borrar por la Storage API, nunca por SQL**.
    - Remoto (MCP de Supabase, 2026-10-03): `apply_migration` OK; verificado: bucket `public=false`, `file_size_limit=10485760`, MIME PDF/JPEG/PNG, y las 5 políticas presentes.
    - Commit: `feat(db): add the private pyme-documents bucket and its storage RLS`.
  - **T4b — API.** Puerto `storage-port` + adaptador Supabase (`service_role`), validación de MIME/magic bytes/tamaño/nombre, rutas `POST /storage/uploads` (multipart, `@fastify/multipart`) y `DELETE /storage/uploads/:id`, con política de ruta `PYME`. Tests de validación + ruta con adaptador falso.
  - **T4c — UI web.** Puerto de subida + adaptador (multipart por `AxiosHttpClient`), UI de las 3 ranuras + hasta 4 fotos con progreso, tipo inválido, tamaño excedido, fallo con reintento, quitar y orden ←/→; copy nuevo aprobado en la revisión (U5).
- [ ] **T5 — Cierre de #399.** Paso `Evaluación AI` (banda/checks, sujeto a la decisión de alcance con #402) y paso `Revisión humana` (envío contra el motor existente, wallet obligatoria detrás del puerto de wallet; la conexión real de Freighter es [#406](https://github.com/reyduar/Vaqcrow/issues/406)); estados enviado/no enviado de D12.
- [ ] **T6 — Verificación.** `pnpm run verify`, `pnpm run test:db`, Playwright offline, `pnpm run boundaries`; y actualizar los documentos que repiten el comportamiento (CLAUDE.md/AGENTS.md gemelos, `docs/planning/DEMO.md`, `docs/design/demo-ui.md`, `docs/architecture/*`).

## Progreso

- (2026-10-03) Ramas #398 y #399 creadas desde la rama de #378 (`eaad04f`). Exploración del motor: no existe tabla `businesses` ni columna de dueño; la autorización de la API es sólo por rol (`route-policy.ts`); no existe bucket de Storage ni puerto/adaptador de upload; no existe ningún componente de wizard. Se determinó que el wizard vive dentro de `/company`.

## Próximo paso

T1 cerrada y revisada. Sigue **T2 — Paso 2 «Registrá tu PyME»** (formulario + validaciones + grilla de ventas, sin persistencia). Antes de T3/T4 el owner tiene que decidir las tres «decisiones pendientes» de arriba (sobre todo la UI de carga de documentos/fotos, que bloquea T4).
