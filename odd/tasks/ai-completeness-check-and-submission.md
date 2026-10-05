# Bitácora — Feature #402: chequeo de completitud con IA y envío a revisión humana

## Objetivo

Entregar el **paso 1 (chequeo de completitud)** y el **envío a revisión humana** de la solicitud de la PyME, con el **paso 2 (evaluación de riesgo)** apoyado en el motor existente, y publicar el evento **"Nueva solicitud"** al admin por el puerto de #382. Feature [#402](https://github.com/reyduar/Vaqcrow/issues/402) (Epic [#374](https://github.com/reyduar/Vaqcrow/issues/374)).

## Ramas y entrega

- **Rama de integración:** `Vaqcrow#402_Feat_Run_the_AI_completeness_check_and_submit_to_human_review`, creada desde la punta de #382 (`997ab08`, que ya incluye #406/#409).
- **Opción A del owner (vigente):** nada llega a `main`; toda la pila se mergea junta con **#438**. No hay PR ni merge en esta Feature.
- **Dependencias:** #398 (wizard + carga de documentos) y #382 (notificaciones), ambas entregadas.

## Fuente de diseño

- `docs/design/design_handoff_vaqcrow/screens/Vaqcrow Onboarding PyME.dc.html` (paso 3, "Evaluación de IA").
- `docs/design/design_handoff_vaqcrow/screens/Vaqcrow Admin.dc.html` (sección de revisión "2 · Recomendación de IA"; notificación "Nueva solicitud … La IA marcó un faltante (abril) y una anomalía (junio).").

## Decisiones del owner (2026-10-05)

| # | Pregunta (issue #402, «Not designed in the template») | Resolución |
|---|---|---|
| 1 | Cómo ve la PyME el resultado de completitud | **Lista concisa de faltantes/anomalías en el paso 3**, con marcador `SIMULADO` (el template no diseña pantalla de faltantes; el dato ya existe). |
| 2 | ¿Incompleto bloquea o solo advierte? ¿La PyME ve la banda? | **Incompleto advierte pero no bloquea el envío** (la persona decide; el admin ve el detalle). La PyME **sí** ve la banda en el paso 3. |
| 3 | Carga/fallo/reintento y cómo se leen los documentos | Reutiliza el patrón del paso 3 de #399. |
| 4 | **Alcance del chequeo (2026-10-05)** | **Acotado por ahora:** completitud sobre **datos declarados + presencia de documentos** (metadatos): los 3 documentos obligatorios, 1–4 fotos, ≥6 de 8 meses, coherencia. |
| 5 | **Relevancia por contenido (visión)** | **Diferida** a una unidad posterior. El owner quiere, por sobre todo, que el chequeo detecte documentos **irrelevantes** (p. ej. una foto de Pikachu donde va la Constancia de CUIT). Requiere: (a) extender el motor de IA a **multimodal** + un **modelo con visión**; (b) que la API **lea los bytes** de los documentos (`StoragePort.downloadObject`); (c) **persistir las rutas** de los documentos del lado servidor. Las tres cosas están fuera de esta Feature. |
| 6 | **Fotos: ¿opcionales o 1–4 obligatorias?** (conflicto entre el issue #402 «1–4 fotos» y la decisión U2 de #399 «hasta 4, opcionales») | **Exigir 1–4 fotos** (owner, 2026-10-05): el texto del issue gana sobre U2 para este chequeo. 0 fotos es un **faltante**; el demo mostrará el aviso de incompleto hasta que se suba al menos una foto. Sin cambio de código (la implementación ya lo hacía). |

## Hallazgos de la exploración (2026-10-05)

- **El motor de IA real vive en `packages/ai`** (`AssessmentProviderPort`, `opencode-go-provider.ts`, `assessment-prompt.ts`, `run-assessment.ts`), no en el `assistant-port` stub. Es **solo texto** (input `AssessmentEvidenceBundle` = ventas + findings; mensajes `{ role, content: string }`); **sin visión**.
- **El motor de riesgo** (`/application-reviews/:id/assessments`, `routeApplicationAssessment`) existe, es **ADMIN-only** y necesita un `applicationId`; deriva la evidencia del servidor (`smeRequests` + `salesData`).
- **No hay motor ni ruta de completitud.**
- El paso 3 del wizard (#399) usa `AiEvaluationPort` **simulado** sin documentos; es el punto de reemplazo.
- **La API no puede leer** los documentos (`StoragePort` solo `uploadObject`/`removeObject`) y las rutas **no se persisten** server-side.
- **La precondición de wallet es solo UI**: `POST /sme-requests` no verifica la clave guardada (seam registrado de #406 que esta Feature cierra).
- El **publisher de #382 está construido sin call-site** (`index.ts`); #402 es el primero. `smeName` no tiene link aplicación↔empresa; hay que resolverlo (p. ej. `businessRepository.findByOwner`).

## Alcance (acotado)

1. **Chequeo de completitud (API):** puerto `CompletenessCheckPort` + adaptador determinista (no LLM) que valida: 3 documentos obligatorios presentes, 1–4 fotos, ≥6/8 meses de ventas, coherencia de datos declarados → faltantes y anomalías estructurados. Detrás de un doble en tests.
2. **Envío a revisión (API):** `POST /sme-requests` **rechaza sin clave pública guardada** (cierra el seam de #406); idempotente; y al aplicar publica el evento `admin.new_application` por el publisher de #382 (best-effort, nunca falla el envío).
3. **Web:** mostrar el resultado de completitud (faltantes/anomalías) en el paso 3 según la decisión 1; el incompleto **advierte** (decisión 2).
4. **Pruebas + evidencia.**

## TDD

- Modo: **activado** (RED observado antes del GREEN).
- Runners: Vitest (API y web), pgTAP si se toca una migración, y Playwright offline si hace falta. Los tests del PR **nunca** llaman a un LLM vivo, Resend, Supabase ni Testnet: usan dobles.
- Skills a cargar antes de escribir: `supabase`/`supabase-postgres-best-practices` (si se toca DB), `heroui-react`/`frontend-design` (UI).

## Tareas

- [ ] **T1 (#403) — Implementar.**
  - [x] **T1a — Chequeo de completitud (API).** `CompletenessCheckPort` + adaptador determinista + tests con dobles.
  - [x] **T1b — Envío a revisión (API).** Precondición de wallet server-side, idempotencia, y publicación del evento `admin.new_application` (cableado en `index.ts`/`build-app`).
  - [x] **T1c — Web.** Cablear el resultado de completitud al paso 3 (faltantes/anomalías; incompleto advierte).
- [x] **T2 (#404) — Probar.** Golden fixtures (completa, documento faltante, meses faltantes, anomalía), validación de schema, idempotencia del envío, rechazo sin clave, evento publicado una sola vez. **No se agregaron fixtures de prompt-injection** porque la Feature no agrega una entrada de modelo nueva: el chequeo es determinista y solo recibe metadatos declarados; la cobertura de inyección del motor de riesgo es la pre-existente (`ai-assessment.golden.test.ts`). Commit `a35ef61`.
- [x] **T3 (#405) — Evidencia.** `docs/planning/ai-completeness-check-and-submission-evidence.md` (español), con cada criterio de aceptación de #402 citado textualmente y su fuente de verificación. Alineados `CLAUDE.md`/`AGENTS.md` (gemelos, `diff` vacío) y `docs/planning/DEMO.md` (pasos 1/3/5 y matriz); `docs/architecture/environments.md` **no** cambia (el chequeo no agrega variable de entorno ni check de preflight). Commands observados en este árbol: `pnpm --filter @vaqcrow/api test` → `78 passed / 1810 passed`; `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → `161 passed / 1520 passed`; `pnpm run lint` → `5 successful, 5 total` (0 errores, 1 warning preexistente); `pnpm run typecheck` → `8 successful, 8 total`; `pnpm run boundaries` → `no dependency violations found (790 modules, 2505 dependencies cruised)`; `pnpm run test:boundaries` → `10 passed / 162 passed`. Revisión RDD de #402 pendiente (sin linaje).

## Próximo paso

**Cierre.** T1a/T1b/T1c, T2 y T3 están completos; la evidencia vive en `docs/planning/ai-completeness-check-and-submission-evidence.md` y los documentos que repetían el comportamiento quedaron alineados. La Feature **no está en `main`** (Opción A) y no se cierra sola: el cierre lo decide el owner. Antes del merge de la pila: aprobar el copy de UI, correr y reconocer la revisión RDD de #402, decidir/planificar el chequeo de relevancia por contenido (visión) y confirmar el primer envío real por Resend.

## Bitácora de implementación

### T1a — Chequeo de completitud (API)

**Unidad de trabajo:** `feat(api): add the application completeness check`.

- **Reglas puras** (`apps/api/src/application/completeness/completeness-check.ts`):
  `checkCompleteness(input)` + tipos. Sin vendor, sin Fastify/Supabase, sin I/O.
  Los `kind` de documento reutilizan `DocumentKind` de
  `../storage/document-upload.ts` con `Exclude<DocumentKind, "photo">`, para que
  el vocabulario del wizard y el del chequeo no diverjan.
- **Decisiones de las reglas:**
  - Documento obligatorio omitido o con `present: false` → `gap`
    (`missing_document`), con copia en español que lo nombra ("Declaraciones de
    ventas", "Constancia de CUIT", "Estatuto").
  - 0 fotos → `gap`; 5+ fotos → `warning` (`insufficient_photos`). El exceso no
    bloquea; la falta sí.
  - Mes sin valor (`null`/no finito) con menos de 6 declarados → **un finding
    por mes** (`missing_sales_month`, `gap`), para poder nombrarlo como lo hace
    la notificación del template ("La IA marcó un faltante (abril)"). `0` cuenta
    como valor. Si el total declarado es menor a 6 y el faltante no es
    atribuible a meses nombrados, un `gap` agregado cubre el resto. Justificación:
    el detalle nombrado es más accionable para la PyME y coincide con el diseño.
  - Mes por encima de 1.5× el promedio de los meses positivos →
    `sales_anomaly` `warning`, espejo exacto de `salesAnomaly` en
    `apps/web/src/application/pyme-onboarding/registration-step.ts`.
  - `complete = no hay findings con severity "gap"`: **incompleto advierte, no
    bloquea** (decisión 2 del owner).
- **Puerto** (`apps/api/src/application/ports/completeness-check-port.ts`):
  `check(input): Promise<result>`, sin vendor.
- **Adaptador** (`apps/api/src/infrastructure/adapters/deterministic-completeness-check-adapter.ts`):
  implementa el puerto delegando en las reglas puras. Sin LLM: el alcance es
  datos declarados (decisión 4).
- **Ruta** (`apps/api/src/infrastructure/http/routes/completeness-check.route.ts`):
  `POST /completeness-check`, `only("PYME")`, validación estricta del body
  (claves exactas, sin duplicados, rangos) en
  `apps/api/src/application/completeness/completeness-request.ts`; responde
  `200 { result }` para un body válido (aunque `complete` sea `false`) y
  `400 { errors: [{ field, code }] }` / `503 { code: "unavailable" }` sanitizados.
  Sin propietario tomado del body.
- **Cableado:** `route-policy.ts`, `build-app.ts` (dependencia opcional) e
  `index.ts` (adaptador determinista).
- **Tests pinneados actualizados:** `route-policy.test.ts`,
  `authorization.test.ts` (fila MATRIX + `completenessCheck: stub`),
  `build-app.test.ts` (registro de la ruta).
- **TDD:** RED observado (módulos inexistentes + policy/coverage fallando);
  GREEN: `pnpm --filter @vaqcrow/api test` 1793/1793, `typecheck`, `lint` y
  `boundaries` limpios.

### T1b — Envío a revisión (API)

**Unidad de trabajo:** `feat(api): require the wallet key and publish the submission notification`.

- **Precondición de wallet (`SubmitSmeRequestDependencies.wallet`).**
  `submitSmeRequest` lee `readPublicKey(ownerUserId)` —el principal verificado,
  nunca el body— antes de persistir. Sin clave almacenada →
  `{ code: "wallet_required" }`; la ruta responde `409 { code: "wallet_required" }`.
  Un fallo de lectura → `503` sanitizado. Cierra el seam registrado de #406.
- **Idempotencia.** Hallazgo: el RPC `submit_sme_request` **ya** es idempotente
  sobre `correlation_id` (lock de asesoría + `unique (correlation_id)` + rama
  `replayed`, cubierto por `supabase/tests/sme_request.sql`), pero la ruta deriva
  ese id del `request.id` del transporte, que es nuevo en cada request HTTP: un
  reintento del cliente creaba una segunda aplicación. Se agrega una guarda de
  aplicación: `SmeRequestRepositoryPort.findByOwner` (usa el índice existente
  `sme_request_owner_user_id_idx`) y, antes de `submit`, se compara el pedido
  entrante con los ya enviados del mismo dueño (referencia, total y período).
  Coincidencia → se devuelve la aplicación existente con `applied: false`, sin
  `submit`. Un fallo de la lectura → `503` (no se arriesga un duplicado). **Sin
  migración.**
  - Límite conocido: la guarda es secuencial; dos reintentos concurrentes podrían
    pasar ambos la lectura. Un índice único acotado por dueño+contenido sería la
    defensa definitiva si la concurrencia importa (evaluado y diferido: el demo
    reintenta en serie y una restricción demasiado amplia bloquearía casos
    legítimos).
- **Publicación del evento.** Solo cuando `submit` devuelve `applied: true` (un
  replay por correlación no publica) se llama
  `notifications.publish({ eventKey: "application:<id>:submitted", type:
  "admin.new_application", smeName })`. `smeName` sale de
  `businesses.findByOwner(ownerUserId)`; si no se puede resolver (o lanza) se
  publica con la etiqueta neutra `"PyME"` —notificar al admin es el objetivo, y la
  etiqueta no filtra datos—. Todo el bloque está envuelto para que un publisher que
  lance no haga fallar el envío (best-effort).
- **Cableado:** `SmeRequestRepositoryPort.findByOwner` + adaptador Supabase
  (`select…eq(owner_user_id).order(created_at desc)`); `SmeRequestRouteDependencies`
  gana `wallet`, `businesses`, `notifications`; `index.ts` reutiliza una única
  instancia de `SupabaseWalletRepository` y quita el `void notificationPublisher`
  (primer call-site de producción).
- **Tests (TDD, RED observado antes del GREEN):**
  - `sme-request.test.ts` (30): sin clave → `wallet_required`; fallo de wallet →
    `unavailable`; replay por dueño+contenido no llama `submit` ni publica; lectura
    de idempotencia caída → `unavailable`; publica en aplicado con nombre resuelto;
    no publica en replay; fallback `"PyME"`; publisher que lanza no falla el envío.
  - `sme-request.route.test.ts` (17): `409 wallet_required`; `201` publica; `200` en
    replay no publica.
  - `supabase-sme-request-repository.test.ts` (12): `findByOwner` lee/ordena/mapea,
    lista vacía y errores sanitizados.
- **Verificación:** `pnpm --filter @vaqcrow/api test` 1810/1810; `typecheck`, `lint`
  y `boundaries` limpios. Sin migración, por lo que no se tocó el remoto.

### T1c — Web (resultado de completitud en el paso 3)

**Unidad de trabajo:** `feat(web): surface the completeness check in the onboarding wizard`.

- **Puerto** (`apps/web/src/application/ports/completeness-check-port.ts`):
  `check(input): Promise<Result>`, vendor-free y React-free. Códigos sanitizados
  `invalid_request | unavailable | network`. `input` es exactamente el body de la
  API (`documents {kind, present}[]`, `photoCount`, `salesMonths {month,
  valueArs|null}[]`) y el resultado refleja `{ complete, findings }`.
- **Adaptador HTTP** (`apps/web/src/infrastructure/completeness/http-completeness-gateway.ts`):
  `POST /completeness-check` con `Authorization: Bearer` de la sesión inyectada;
  nunca manda owner. Desenvuelve `200 { result }` y **valida el vocabulario** de
  findings (código y severidad): un código/severidad/`detail` desconocido o vacío
  colapsa a `unavailable`, nunca llega a pantalla. `400`→`invalid_request`;
  resto→`unavailable`; transporte→`network`.
- **Factory + null-object**
  (`create-completeness-port.ts`, `unavailable-completeness-port.ts`): espejo de
  `business/`; `createBrowserCompletenessPort()` usa `NEXT_PUBLIC_API_BASE_URL` y
  la sesión lazy, y `UNAVAILABLE_COMPLETENESS_PORT` cuando no hay backend.
- **Modelo puro** (`apps/web/src/application/pyme-onboarding/completeness.ts`):
  `buildCompletenessInput(sales, documents, photos)` mapea la evidencia que ya
  tenía el paso 2 (los 3 slots con `present`, fotos **cargadas**, 8 meses con
  `null` para vacío — nunca `0`), `findingLabel` y `completenessNotice`. Las
  reglas viven **una sola vez**, en la API: el cliente no las re-deriva.
- **Paso 3**: `CompletenessFindings` corre el puerto en paralelo con la
  evaluación IA (montado junto al bloque busy, no dentro del done) y renderiza la
  lista concisa de faltantes/anomalías con el marcador `SIMULADO`, etiqueta
  visible por finding (`Faltante`/`Aviso`/`Anomalía`) + icono, y un aviso **no
  bloqueante** cuando `complete === false`. La banda de riesgo simulada se
  conserva. Sin región viva propia: no compite con el `role="status"` de análisis.
- **Retiro de duplicado:** el paso 3 ya no muestra los cuatro checks mock de la
  plantilla (`AI_SIMULATED_CHECKS`): eran el placeholder del chequeo y mostraban
  un faltante inventado. Se quitaron de `ai-evaluation-port.ts`,
  `simulated-ai-evaluation-adapter.ts` y `ai-step.ts`; el adaptador solo propone
  la banda. `salesAnomaly` de `registration-step.ts` **se conserva** porque sigue
  usado por el indicador inline del paso 2 (validación de formulario), no por el
  display del paso 3.
- **Evidencia de completitud:** `RegistrationStep.onSubmit` recibe un segundo
  argumento con el `CompletenessCheckInput` construido en el momento del envío
  (los documentos/fotos viven en su estado); el wizard lo guarda y lo pasa a
  `AiStep`.
- **Tolerancia al `409 wallet_required`:** `toSmeSubmitError` mapea
  `status === 409 && errorCode === "wallet_required"` a un mensaje honesto de
  wallet (copy nueva, pendiente de aprobación del owner), sin caer en el genérico
  ni crashear. Es defensa del rechazo server-side de T1b (la UI ya bloquea sin
  clave almacenada).
- **Copy nueva (owner-pending):** título «Completitud de la solicitud», aviso
  incompleto «Faltan datos o hay anomalías. Podés enviar la solicitud igual: la
  persona revisora decide.», completo «No encontramos faltantes ni anomalías.»,
  error «No pudimos revisar la completitud. Podés continuar igual.» y el mensaje
  de wallet «El servidor no tiene tu wallet Freighter registrada. Volvé a
  conectar Freighter y enviá la solicitud de nuevo.».
- **TDD:** RED observado (módulos inexistentes + 6 asserts fallando en 5
  archivos) antes del GREEN. Tests: gateway HTTP (8), factory/null-object (5),
  modelo puro (4 describe), `ai-step` UI (8), wizard (13, con el input construido
  desde el paso 2) y el mapeo 409 (2 en `sme-request-errors`, 1 en
  `review-step`). Doble `FakeCompleteness` en `src/test/`.
- **Verificación:** enfocado `vitest run src/presentation/components/pyme-onboarding
  src/infrastructure/completeness` 85/85; suite web completa 1519/1519 (161
  archivos); `typecheck`, `lint` (0 errores; 1 warning preexistente en
  `fetch-http-client.ts`) y `boundaries` (790 módulos, 0 violaciones) limpios.
  `apps/web` only; sin tocar la API ni migraciones.
