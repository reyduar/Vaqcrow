# Evidencia de cierre de la Feature #398 — Issue #401

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#399](https://github.com/reyduar/Vaqcrow/issues/399) (implementación), [#400](https://github.com/reyduar/Vaqcrow/issues/400) (pruebas) y [#401](https://github.com/reyduar/Vaqcrow/issues/401) (este documento) de la Feature [#398](https://github.com/reyduar/Vaqcrow/issues/398) ("Feature: Guide PyMEs through simulated KYC, registration and document upload", Epic [#374](https://github.com/reyduar/Vaqcrow/issues/374)), re-ejecuta las verificaciones locales en este árbol de trabajo y mapea cada criterio de aceptación de la Feature, citado textualmente, a su resultado y a la fuente de ese resultado. La bitácora de iteración que lo alimenta es [[odd/tasks/pyme-onboarding-wizard-and-document-upload|Bitácora: wizard de alta de la PyME y carga de documentos]].

> [!warning] Estado de entrega: nada de #398, #399, #400 ni #401 está en `main`
> El trabajo vive en la pila de ramas `Vaqcrow#399_Task_Implement_the_PyME_onboarding_wizard_and_document_upload` (tip `4528564`) → `Vaqcrow#400_Task_Test_the_PyME_onboarding_wizard_and_document_upload` (tip `3c9149b`) → `Vaqcrow#401_Task_Document_evidence_for_the_PyME_onboarding_wizard_and_document_upload` (este documento), creada desde la rama de la Feature #398 (`eaad04f`), que a su vez es la punta de la rama de #378. Verificado el 2026-10-04 con `git merge-base --is-ancestor`: el commit de #400 (`1301a53`) **no** es ancestro de `origin/main` (`aaee084`). Por decisión del owner, #369 y #378 llegan juntas a `main` junto con el retiro del recorrido de seis pasos ([#438](https://github.com/reyduar/Vaqcrow/issues/438)); #398, #399, #400 y #401 son la pila siguiente. La demo desplegada desde `main` todavía no tiene el wizard.

## 1. Contexto y objetivo

La Feature #398 entrega el wizard de alta de la PyME —KYC simulado, registro de la PyME, evaluación AI simulada y revisión humana— con carga real de documentos y fotos a un bucket privado de Supabase Storage, siguiendo el template `Vaqcrow Onboarding PyME.dc.html` y las decisiones del owner del 2026-10-01. Depende de [#369](https://github.com/reyduar/Vaqcrow/issues/369) (Supabase Auth, roles, RLS y autorización de la API) y [#378](https://github.com/reyduar/Vaqcrow/issues/378) (creación de cuenta, ingreso y shell por rol; evidencia en [[docs/planning/account-creation-sign-in-and-role-aware-shell-evidence|Evidencia de #378]]).

| Task | Rama | Estado del issue (2026-10-04) |
|---|---|---|
| #399 — implementar | `Vaqcrow#399_Task_Implement_the_PyME_onboarding_wizard_and_document_upload` | abierto; commits T1–T6 + T3 en `4528564` |
| #400 — probar | `Vaqcrow#400_Task_Test_the_PyME_onboarding_wizard_and_document_upload` | abierto; commit `1301a53` |
| #401 — documentar | `Vaqcrow#401_Task_Document_evidence_for_the_PyME_onboarding_wizard_and_document_upload` | este documento |

La Feature #398 sigue abierta (`subIssuesSummary` 0/3 al 2026-10-04); su cierre lo decide el owner.

## 2. Cómo leer esta evidencia

- **Dos fuentes, siempre nombradas.** (a) **Re-ejecutado** — un comando corrido el 2026-10-04 en este árbol de trabajo (rama de #401 sobre `3c9149b`), con su salida real (§4.1). (b) **Bitácora** — una entrada fechada de [[odd/tasks/pyme-onboarding-wizard-and-document-upload]]; se cita, **no** se re-ejecutó aquí.
- **Dobles, no proveedores.** Ninguna prueba de esta Feature habla con el proyecto Supabase remoto, con Resend, con Testnet/Horizon ni con un LLM en vivo. Las pruebas de componentes y de aplicación usan dobles (`FakeKyc`, `FakeAiEvaluation`, `FakeUpload`, `FakeWallet`, `FakeBusiness`); el smoke de Playwright usa los dobles locales `stub-api-server.mjs` y `stub-supabase-server.mjs` bajo un fixture que **falla** si el navegador toca cualquier host no local. Sólo `pnpm run test:db` toca una base, y es el stack local del perfil docker.
- **Sin secretos.** Ningún email, contraseña, clave, token ni identificador de proyecto aparece en este documento; las variables se nombran, nunca sus valores.

## 3. Qué quedó implementado (Task #399)

Fuente: bitácora (T1–T7, 2026-10-03/04) y lectura del código en `3c9149b`.

- **Shell del wizard y paso 1 (T1)** — `PymeOnboardingWizard` montado dentro de `/company` (sin ruta propia), con el stepper del template (`aria-current="step"`) y el paso 1 «Verificación de identidad» detrás de `KycPort` (adaptador simulado): estados idle/busy/approved/needs-changes, referencia, proveedor y el marcador `SIMULADO`. Commit `a1e72b4`.
- **Paso 2 «Registrá tu PyME» (T2)** — formulario con las validaciones del template (razón social, CUIT de 11 dígitos, rubro, ciudad, descripción ≥ 20, ≥ 6 de 8 meses, meta ≥ ARS 1.000.000, revenue share 1–10 %), resumen «Revisá N campos…», grilla de ventas de 8 meses con faltante (mes vacío nunca es cero) y anomalía (mes > 1,5× el promedio). Commit `3042939`.
- **Bucket privado y RLS de Storage (T4a)** — migración `20261003120000_create_pyme_documents_bucket.sql`: bucket `pyme-documents` (`public=false`, 10 MB, PDF/JPEG/PNG) y políticas `owner_read` + `admin_read` (el dueño lee su prefijo `<user_id>/…`, `ADMIN` lee todo). Commit `520709c`; aplicada al remoto.
- **Subida mediada por la API (T4b)** — puerto `storage-port` + `document-upload.ts` (allow-list, tope 10 MB, detección por **magic bytes** independiente del tipo declarado, saneo de nombre) + `SupabaseStorageAdapter` (`service_role`); rutas `POST`/`DELETE /storage/uploads` con `@fastify/multipart`; migración `20261003130000_restrict_pyme_documents_to_api_writes.sql` que **quita** las escrituras del dueño (sólo `service_role` escribe). Commit `bfd2d04`.
- **UI de carga (T4c)** — 3 ranuras obligatorias (Declaraciones de ventas, Constancia de CUIT, Estatuto) + hasta 4 fotos opcionales, con progreso, tipo/tamaño inválidos, reintento, quitar y orden ←/→; el envío del paso 2 se bloquea hasta que las 3 ranuras tengan documento. Commit `1426d60`.
- **Pasos 3 y 4 (T5)** — `AiEvaluationPort` + adaptador simulado determinista (banda `medium` y los cuatro checks del template); `WalletPort` (Freighter) obligatorio en la revisión humana y `SmeRequestGateway` para el envío que la PyME misma dispara (D12). Commit `ffda915`.
- **Persistencia y propiedad por fila (T3a/T3b/T3c)** — tabla `public.businesses` (`service_role`-only, RLS on, 0 políticas) con `owner_user_id`; rutas `POST /businesses` + `GET /businesses/mine`; scoping por dueño (R1-002) en `POST/GET /sme-requests`, `/businesses/:id/sales-periods` y `/revenue-share-distributions*`; el wizard persiste la empresa antes de enviar. Commits `c8136c5`, `4e38280`, `08fdd35`.
- **Documentación (T6)** — `CLAUDE.md`/`AGENTS.md` (gemelos byte a byte), `docs/planning/DEMO.md`, `docs/design/demo-ui.md` y `docs/architecture/identity-and-rls-boundaries.md` §9.10 alineados con el wizard, la carga real, la IA simulada (#402) y la wallet detrás del puerto (#406). Commit `64e5c76`.
- **Smoke de Playwright (T7, Task #400)** — nuevo `apps/web/e2e/pyme-onboarding.spec.ts`; el doble `stub-api-server.mjs` gana `GET /businesses/mine`, `POST /businesses` y `POST /storage/uploads` (con lector multipart mínimo) y `Authorization` en `Access-Control-Allow-Headers`. Commit `1301a53`.

**Desvíos registrados** (vs. el texto del issue):
1. **Transporte de la subida.** El issue dice «owner reads/writes own objects»; acá la subida es **mediada por la API** (`service_role` escribe) y el dueño **sólo lee** lo suyo por RLS. Motivo: `CLAUDE.md` (la API es dueña de autorización y la validación server-side independiente del cliente). El criterio de aceptación («otro usuario no puede leer los archivos de una PyME; los admin sí») se cumple igual.
2. **Cuatro pasos, no tres.** El objetivo del issue habla de tres pasos; el template `Vaqcrow Onboarding PyME.dc.html` y la decisión D12 del owner fijan **cuatro**: KYC → Registro → Evaluación AI → Revisión humana. El wizard sigue el template.
3. **`businesses` como modelo de empresa.** El contrato `SmeRequest` sólo lleva referencia, total y ventana de período; razón social/rubro/ciudad/descripción/meta/revenue share se persisten como `businesses` (T3), no como solicitud.

## 4. Qué quedó probado

### 4.1 Re-ejecutado en este árbol de trabajo (2026-10-04)

Rama de #401 sobre `3c9149b`, base de datos del stack local del perfil docker en marcha.

```sh
$ pnpm run verify
 Tasks:    8 successful, 8 total
exit 0

$ pnpm run test:db
/…/supabase/tests/businesses_ownership.sql ................. ok
/…/supabase/tests/pyme_documents_bucket.sql ................ ok
/…/supabase/tests/sme_request.sql .......................... ok
(+ 8 archivos previos, todos ok)
All tests successful.
Files=11, Tests=236
Result: PASS

$ pnpm --filter @vaqcrow/web run test:e2e
  41 passed (1.3m)

$ pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4
 Test Files  149 passed (149)
      Tests  1415 passed (1415)
```

**Nota de flakiness:** una corrida intermedia de `pnpm run verify` falló con 6 timeouts de 5000 ms en `@vaqcrow/web:test` bajo la carga paralela de turbo (tests preexistentes ajenos a esta Feature). La suite web sola y la corrida definitiva de `verify` pasaron; no es una regresión. Queda registrado como fragilidad conocida de jsdom bajo carga, no como fallo de la Feature.

### 4.2 Qué cubre cada suite

| Comportamiento | Prueba | Fuente del resultado |
|---|---|---|
| Paso 1 KYC: idle/busy/approved/needs-changes, referencia, proveedor, reintento y «elegir otro documento» | `apps/web/src/application/pyme-onboarding/kyc-step.test.ts`, `presentation/components/pyme-onboarding/pyme-onboarding-wizard.test.tsx` | Re-ejecutado (suite web); RED en bitácora T1 |
| Paso 2: cada regla de validación y su orden, resumen de errores, CUIT de 11 dígitos, revenue share inclusivo 1–10, ≥ 6 de 8 meses | `application/pyme-onboarding/registration-step.test.ts` | Re-ejecutado; RED en bitácora T2 |
| Grilla de ventas: faltante (mes vacío ≠ 0) y anomalía (> 1,5× el promedio) computadas | `registration-step.test.ts` (`salesMissing`/`salesAnomaly`), `presentation/components/pyme-onboarding/registration-step.test.tsx` | Re-ejecutado; RED en bitácora T2 |
| Subida: tipos admitidos/rechazados, tope de 10 MB exacto y +1, 1–4 fotos, reintento, quitar, orden ←/→, reemplazo en vuelo | `application/pyme-onboarding/document-upload.test.ts`, `presentation/components/pyme-onboarding/document-upload.test.tsx` | Re-ejecutado; RED en bitácora T4c |
| Validación server-side de MIME/magic bytes/tamaño/nombre independiente del cliente | `apps/api/src/application/storage/document-upload.test.ts`, `apps/api/src/infrastructure/http/routes/storage.route.test.ts` | Re-ejecutado (`verify`, apps/api); RED en bitácora T4b |
| RLS de Storage: dueño lee sólo lo suyo, **sin lectura cruzada**, `ADMIN` lee todo, sin escritura del dueño | `supabase/tests/pyme_documents_bucket.sql` | Re-ejecutado (`test:db`) |
| Propiedad por fila (R1-002): `businesses` service_role-only, dueño permitido, otro dueño 404, fila sin dueño 404, `ADMIN` sin chequeo | `supabase/tests/businesses_ownership.sql`, `apps/api/.../business.route.test.ts`, `.../sme-request.route.test.ts`, `.../sales-feed.route.test.ts`, `.../revenue-share-distribution.route.test.ts` | Re-ejecutado (`test:db` + `verify`); RED en bitácora T3b |
| Paso 3 AI: banda y checks del template, busy, error con reintento | `application/pyme-onboarding/ai-step.test.ts`, `presentation/components/pyme-onboarding/ai-step.test.tsx` | Re-ejecutado; RED en bitácora T5 |
| Paso 4: portón de wallet (rojo «Obligatorio» + aviso), envío al motor, banner de éxito y «Revisión humana · En proceso», persistencia de la empresa antes de enviar | `application/pyme-onboarding/review-step.test.ts`, `presentation/components/pyme-onboarding/review-step.test.tsx`, `.../pyme-onboarding-wizard.test.tsx` | Re-ejecutado; RED en bitácora T5/T3c |
| Smoke en el navegador: ingreso PYME → wizard completo (KYC → registro + 3 PDFs → AI → Freighter → envío) con dobles locales | `apps/web/e2e/pyme-onboarding.spec.ts` | Re-ejecutado (Playwright); RED conceptual en bitácora T7 |

### 4.3 Verificaciones fuera del gate de PR (tomadas de la bitácora, no re-ejecutadas)

- **Remoto (MCP de Supabase, 2026-10-03):** migraciones aplicadas y verificadas — bucket `pyme-documents` (`public=false`, 10 MB, PDF/JPEG/PNG, 5 políticas en T4a y luego restringidas a lectura en T4b), `businesses` (11 columnas, 0 políticas), trigger `businesses_set_updated_at` y `submit_sme_request` de 7 argumentos; historial de migraciones reconciliado a los nombres del repo.
- **Storage local habilitado:** `supabase/config.toml` `[storage] enabled = true`, `scripts/local-env.sh` sin excluir `storage-api`, `docs/architecture/environments.md` §3 alineado (bitácora T4a).

## 5. Límites y brechas vigentes

1. **Revisiones RDD nativas incompletas de T5 y T3b.** Ambos candidatos cerraron con `stop`/`unachievable_lens_slot`: el transporte del reviewer de OpenCode falló de forma consistente (`opencode_task_output_empty` / `opencode_reviewer_result_refused`). No es una aprobación inventada ni una regresión de código; es un defecto del transporte del reviewer. T5 se intentó en un worktree aislado (no cabe in-place por presupuesto de contexto) y T3b in-place; ambos reintentos fallaron. Ver §7.
2. **Wizard sólo en memoria (decisión 2, aceptada).** No hay borrador persistente ni edición/reenvío tras el envío; «Revisar lo cargado» vuelve al paso 2 sólo antes de enviar. Guardar/retomar y reenviar tras «Requiere cambios» llegan con el flujo de revisión del admin.
3. **Hallazgos no bloqueantes** sin resolver en una unidad posterior: de T6 (R3-001/002/003, documentación) y de T3c (R3-1 `headersFor` con token que rechaza, R3-2 create sólo acepta 201, R3-3 wiring del Bearer sin test).
4. **Seam del contrato `SmeRequest`.** Sólo viajan referencia, total y ventana de período; el resto del formulario se persiste como `businesses` (§3.3).
5. **Seam del feed de ventas.** El feed simulado está keyed por slug (`panaderia-horizonte`) y `businesses.id` es UUID; la ruta scopea por el UUID, así que el feed simulado sólo es alcanzable por `ADMIN` con el dataset actual.
6. **Sesión lazy duplicada.** `createBrowserUploadPort`/`createBrowserBusinessPort` leen el token de una sesión lazy propia; una unidad posterior debe compartir el único puerto de sesión.
7. **Sin comprobación contra el remoto de la subida real.** La carga de bytes a Supabase Storage se probó contra dobles (API con adaptador falso, UI con `FakeUpload`) y contra el stack local (`test:db` para RLS), no contra el proyecto remoto con un navegador real.

## 6. Preguntas abiertas y decisiones del owner

| Pregunta (issue #398, «Not designed in the template (open question)») | Resolución | Fuente |
|---|---|---|
| "Photo upload UI (1 to 4 photos: picker, preview, remove, ordering) and required-document slots (sales declarations, CUIT certificate, articles of incorporation); upload progress, wrong-type, oversize and failed-upload states." | **DECIDIDA (U1–U5).** Tres ranuras fijas y obligatorias + hasta 4 fotos opcionales; subida al elegir con progreso; orden ←/→; copy nuevo en español neutro aprobado por el owner. Implementada en T4a/T4b/T4c. | Bitácora U1–U5 (owner, «dale a todo», 2026-10-03) |
| "Saving a draft and resuming the wizard (template state is in-memory only), and editing after submission via "Revisar lo enviado" or resubmitting after "Requiere cambios"." | **DECIDIDA (decisión 2, 2026-10-04): sólo en memoria.** No se persiste borrador; «Revisar lo cargado» vuelve al paso 2 dentro de la sesión. Guardar/retomar y editar o reenviar tras el envío llegan con el flujo de revisión del admin. Limitación aceptada y documentada. | Bitácora, decisión 2 (owner, 2026-10-04) |
| "The template banner "Demo: usá datos sintéticos. No cargues información real de tu empresa." and the "Completar con datos de ejemplo" helper versus real document upload: whether they stay is undecided." | **DECIDIDA (decisión 3, 2026-10-04): se mantienen ambos.** El banner es una divulgación de seguridad ahora que la carga de documentos es real; el helper acelera la demo. Sin cambio de código (`registration-step.ts:68,70`, ya probados). | Bitácora, decisión 3 (owner, 2026-10-04) |

Decisiones del owner registradas durante la Feature (bitácora, 2026-10-03):

| # | Decisión | Estado |
|---|---|---|
| U1 | Tres ranuras de documentos fijas y obligatorias (Declaraciones de ventas, Constancia de CUIT, Estatuto), PDF/JPG/PNG ≤ 10 MB. | vigente |
| U2 | Fotos: hasta 4, opcionales. | vigente |
| U3 | Subida al elegir el archivo; la referencia se guarda al enviar y el objeto se borra al quitarlo. | vigente |
| U4 | Orden de fotos con botones ←/→ (no arrastrar). | vigente |
| U5 | Copy nuevo en español neutro, aprobado por el owner en la revisión. | vigente |
| D12 | La PyME misma presiona «Enviar a revisión»; wallet Freighter obligatoria (destino inmutable de la bóveda); el deploy del vault es de plataforma. | vigente |

## 7. Correcciones aplicadas durante el ciclo y revisiones RDD

1. **Hallazgos de la revisión de T4a** (políticas de escritura del dueño que salteaban la validación de la API; migración no idempotente; reversión que no purgaba objetos) → resueltos en T4b (`20261003130000_restrict_pyme_documents_to_api_writes.sql`).
2. **Hallazgos de la revisión de T4b** (DELETE autorizado sólo por prefijo con `..`; adaptador sin test; tope 10 MB aplicado dos veces) → resueltos en T4c.
3. **Hallazgos de la revisión de T4c** (fallo al quitar sin probar; foto huérfana por `void`; «Reintentar» muerto ante validación local; fábrica sin test; reemplazo en vuelo) → resueltos en T5.
4. **Hallazgos de la revisión de T3a** (`updated_at` congelado; extremos inclusivos sin probar; camino como `service_role`) → resueltos en T3b.

Revisiones RDD:

| Candidato | Linaje | Resultado | Fuente |
|---|---|---|---|
| T1 (base `eaad04f`, `medium`) | `review-4d5cf8ad979f842c` | `approved`, `burned` | Bitácora |
| T2 (base `a1e72b4`, `medium`) | `review-6fcbdd62cf3abc01` | `approved`, `burned` | Bitácora |
| T4a (base `3042939`, `high`) | `review-8f8a47eea77a5f47` | `approved`, `burned`; 8 no bloqueantes → T4b | Bitácora |
| T4b (base `520709c`, `medium`) | `review-110a75782eae2144` | `approved`, `burned`; 3 no bloqueantes → T4c | Bitácora |
| T4c (base `bfd2d04`, `medium`) | `review-dc01feec132aa294` | `approved`, `burned`; 5 no bloqueantes → T5 | Bitácora |
| T5 (base `1426d60`, `medium`) | `review-6473f4485abd3b2c` | **incompleta** — `stop`/`unachievable_lens_slot` | Bitácora |
| T6 (base `ffda915`, `medium`) | `review-86d3e88316d7718d` | `approved`, `burned`; 3 no bloqueantes | Bitácora |
| T3a (base `64e5c76`, `medium`) | `review-e633d73d9f2216bd` | `approved`, `burned`; 3 no bloqueantes → T3b | Bitácora |
| T3b (base `c8136c5`, `medium`) | `review-4be7b23ecefdeecf` | **incompleta** — `stop`/`unachievable_lens_slot` | Bitácora |
| T3c (base `4e38280`, `medium`) | `review-dff69dbe76d1db3e` | `approved`, `burned`; 3 no bloqueantes | Bitácora |
| T5 (reintento 2026-10-04, worktree `ffda915`) | `review-15905231b0ad8f8d` | **incompleta** — transporte del reviewer falló 3× | Bitácora |
| T3b (reintento 2026-10-04, base `c8136c5`) | `review-de97ce5db69da601` | **incompleta** — transporte del reviewer falló | Bitácora |

## 8. Mapeo de criterios de aceptación

| # | Criterio (verbatim, issue #398) | Resultado | Fuente |
|---|---|---|---|
| 1 | "The three steps, validations, error copy, anomaly/faltante behavior and step-3 view match the template, persisted through the existing engine." | ✅ **CUMPLIDO contra el template (cuatro pasos).** El template `Vaqcrow Onboarding PyME.dc.html` y D12 fijan **cuatro** pasos (KYC → Registro → Evaluación AI → Revisión), no tres: el wizard los implementa con `aria-current="step"`, las validaciones y el copy del template, faltante/anomalía computados, y la vista de revisión; el envío persiste la empresa y la solicitud por el motor existente. Desvío registrado en §3.2. | Suite web y Playwright re-ejecutados; bitácora T1/T2/T5 |
| 2 | "Required documents and 1 to 4 photos upload to the private bucket with per-owner RLS; PDF/JPG/PNG up to 10 MB are accepted and anything else is rejected server-side." | ✅ **CUMPLIDO con dobles.** La subida es mediada por la API (§3.1): 3 documentos obligatorios + hasta 4 fotos; PDF/JPG/PNG ≤ 10 MB aceptados y cualquier otro tipo/tamaño rechazado server-side por MIME/magic bytes/tamaño; el dueño lee lo suyo por RLS. La comprobación con navegador real contra el bucket remoto no se hizo (§5.7). | Suite web, `verify` (apps/api) y `test:db` re-ejecutados |
| 3 | "KYC result is stored via the simulated adapter and shown with `SIMULADO`." | ✅ **CUMPLIDO.** `KycPort` con adaptador simulado; el resultado se muestra con referencia, proveedor «Adaptador KYC simulado v1» y el marcador `SIMULADO`, y la línea «Resultado simulado para esta demo…». | Suite web re-ejecutada; bitácora T1 |
| 4 | "Another user cannot read a PyME's files; admins can (for review)." | ✅ **CUMPLIDO.** `supabase/tests/pyme_documents_bucket.sql` afirma dueño-lectura-de-lo-suyo, **sin lectura cruzada**, y `ADMIN` lee todo; sin políticas de escritura del dueño. | `test:db` re-ejecutado |
| 5 | "The migration and storage policies are applied and verified on the remote project." | ✅ **CUMPLIDO (bitácora, no re-ejecutado aquí).** Bucket, políticas, `businesses`, trigger y `submit_sme_request` aplicados y verificados en el remoto el 2026-10-03 (MCP de Supabase); historial reconciliado. | Bitácora T4a/T4b/T3a/T3b |
| 6 | "Required evidence and failure behavior are covered." | ✅ **CUMPLIDO.** Fallos cubiertos: KYC needs-changes y rechazo del adaptador, subida por tipo/tamaño/fallo con reintento, fallo al quitar documento/foto, token sin sesión, gateway/empresa no disponible, propiedad ajena (404), proveedor/lectura no disponible (503); este documento es la evidencia. | Suite web, Playwright y `test:db` re-ejecutados; §4.2 |
| 7 | "Every item under "Not designed in the template (open question)" is decided by the owner before it is implemented; none is invented." | ✅ **CUMPLIDO.** Las tres preguntas se decidieron antes de implementarse: la UI de fotos/ranuras (U1–U5, implementada), el borrador/edición tras el envío (decisión 2, 2026-10-04: sólo en memoria) y el banner + «Completar con datos de ejemplo» (decisión 3, 2026-10-04: se mantienen). Ninguna se inventó. | Bitácora §6; decisión del owner 2026-10-04 |
| 8 | "No unsupported production claims or secrets are introduced." | ✅ **CUMPLIDO.** La IA es explícitamente simulada (`SIMULADO`), la wallet real es #406 y la IA real es #402; sin valores de variables en el repo, la bitácora ni este documento; el email nunca se muestra; Vaqcrow sigue no-custodial. | Revisión de este documento; suite re-ejecutada |

## 9. Riesgos, contradicciones y limitaciones aceptadas

- **Cierre manual de las Tasks.** GitHub no cierra un issue cuando la PR se mergea en una rama que no es la principal; el cierre de #399/#400/#401 lo decide el owner. Ninguno está en `main`.
- **Revisiones nativas de T5/T3b sin completar.** No hay aprobación nativa de esos dos candidatos por un defecto del transporte del reviewer (§5.1); su verificación es la de la bitácora y la re-ejecución de §4.1.
- **El issue habla de tres pasos; el template y D12, de cuatro.** El criterio 1 se mide contra el template (§3.2, §8.1).
- **El remoto no se re-verificó aquí.** Todo lo del proyecto remoto proviene de la bitácora (2026-10-03).
- **Flakiness de jsdom bajo carga.** Una corrida de `verify` flaqueó con timeouts; no es regresión (§4.1).

## 10. Estado de entrega y próximos pasos

- Este cambio es sólo documentación: este archivo, la bitácora y las entradas de #398–#401 en `demo-tasks-list.md`. Commit en la rama de #401; la PR contra la rama de #400/#399/#398 es un paso posterior.
- La Feature #398 **no está en `main`** y no se cierra sola: el cierre lo decide el owner.

> [!todo] Condiciones antes del merge a `main` de la pila #398/#399/#400/#401
> 1. **(Resuelto 2026-10-04)** Decisiones 2 y 3 del owner: el wizard queda sólo en memoria (sin borrador persistente ni edición/reenvío tras el envío) y el banner «usá datos sintéticos» + «Completar con datos de ejemplo» se mantienen. El criterio 7 pasa a cumplido.
> 2. Reintentar las revisiones nativas de T5 y T3b cuando el transporte del reviewer de OpenCode vuelva a funcionar.
> 3. Resolver o aceptar los hallazgos no bloqueantes de T6 y T3c.
> 4. Comprobar la subida real contra el bucket remoto con un navegador real (§5.7).
