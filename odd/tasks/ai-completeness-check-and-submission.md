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
  - [ ] **T1a — Chequeo de completitud (API).** `CompletenessCheckPort` + adaptador determinista + tests con dobles.
  - [ ] **T1b — Envío a revisión (API).** Precondición de wallet server-side, idempotencia, y publicación del evento `admin.new_application` (cableado en `index.ts`/`build-app`).
  - [ ] **T1c — Web.** Cablear el resultado de completitud al paso 3 (faltantes/anomalías; incompleto advierte).
- [ ] **T2 (#404) — Probar.** Golden fixtures (completa, documento faltante, meses faltantes, anomalía), prompt-injection, validación de schema, idempotencia del envío, rechazo sin clave, evento publicado una sola vez.
- [ ] **T3 (#405) — Evidencia.** `docs/planning/ai-completeness-check-and-submission-evidence.md` (español) + alineación de docs.

## Próximo paso

**T1a**: puerto + adaptador determinista del chequeo de completitud, con tests.
