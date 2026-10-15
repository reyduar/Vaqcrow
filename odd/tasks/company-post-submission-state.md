# Company state after submission (#530)

Feature del Epic #528. Objetivo: que `/company` deje de ofrecer «Registrar mi PyME» en cuanto existe una solicitud y ofrezca ver lo enviado en solo lectura.
Rama: `Vaqcrow#530_Feat_Drive_the_company_state_after_submission_hide_Registrar_mi_PyME_show_the_submitted_data`.
Entrega: un commit por work-unit; PR al cerrar la feature. Runner: `pnpm run verify` (vitest, turbo).

## Specs

S1. Con la solicitud enviada (estados `awaiting_assessment`, `human_review`), `/company` **no** muestra «Registrar mi PyME» y ofrece una acción «Ver lo enviado» que abre lo enviado en **solo lectura**.
S2. Una vez aprobada la campaña (`approved`), `/company` tampoco muestra «Registrar mi PyME».
S3. También se oculta en `changes_requested` y `rejected`; sólo con «Sin enviar» (sin solicitud, o `draft`) se ve el botón. (Asunción confirmada por el owner 2026-10-15.)
S4. «Ver lo enviado» es **todo read-only** y muestra lo persistido: empresa (nombre, sector, ciudad, objetivo), la solicitud (referencia, total, plazo), los documentos cargados y las ventas declaradas. **No** re-muestra la banda de IA: es simulada y mostrarla como «enviada» sería mentir.
S5. La identidad es siempre el principal verificado: la solicitud se resuelve por el owner del token, nunca por un id del cliente. Una solicitud ajena es ausencia, nunca datos (R1-002).
S6. El estado que decide el botón es el real del servidor y está disponible también en una **sesión nueva**. Hoy el id de la solicitud sólo se conoce si el PyME envió en esa misma sesión (`company-workspace.tsx:135`), así que un PyME que vuelve no ve ni banner ni botón correctos.

## Tasks

| ID | Tarea | Specs | Ruta | Estado | Commit |
|---|---|---|---|---|---|
| T1 | API: `GET /sme-requests/mine` — owner-scoped, devuelve `{ application: { applicationId, state } \| null }`. Reusa `SmeRequestRepositoryPort.findByOwner` + `findReviewStateByApplicationId`. | S5, S6 | delegado (worker) | hecho | f25697a |
| T2 | API: `GET /pyme-documents/mine` — owner-scoped, metadata de los documentos (sin `objectPath`). Reusa `PymeDocumentRepositoryPort.listByOwner`. | S4, S5 | delegado (worker) | hecho | f25697a |
| T3 | Web: gateway + `useMyApplication`; resolver el `applicationId` desde el principal (no sólo del submit en sesión). | S6 | inline | pendiente | |
| T4 | Web: ocultar «Registrar mi PyME» según el estado real. | S1, S2, S3 | inline | pendiente | |
| T5 | Web: «Ver lo enviado» read-only (empresa + solicitud + ventas + documentos). | S1, S4 | inline | pendiente | |
| T6 | Evidencia: `docs/planning/company-post-submission-state-evidence.md`. | S1–S6 | inline | pendiente | |

## Log

L1 — Pedido original del owner (2026-10-15, verbatim):

- «en pagina de Mi campaña hay una seccion llamada Fondear tu wallet con XLM de prueba…» *(fuera de esta feature, ver #531)*
- «cuando la campaña esta en revision ya no deberiamos de mostrar el boton Registrar mi Pyme sino Tener un boton para ver todo los datos cargados que estan revision.»
- «Una vez que se aprovo la campaña ya no deberia mostrar el Registrar mi PyME.»

L2 — Decisión del owner (2026-10-15): «exacto, todo read-only». Confirma el resumen read-only de lo persistido (empresa + solicitud + documentos + ventas) y **sin** banda de IA. Y la asunción de estados S3 se acepta.

L3 — Mapeo previo a la primera escritura (2026-10-15, `path:line`):

- La lectura de la solicitud **ya es owner-scoped**: `getSmeRequest` recibe `ownerUserId` del principal y reporta la ajena como `not_found` (`apps/api/src/application/use-cases/get-sme-request.ts:43-45`); `GET /sme-requests/:applicationId` ya devuelve `{ request, salesPeriods, state }` (`apps/api/src/infrastructure/http/routes/sme-request.route.ts:108-133`).
- El mapeo de estados ya existe: `applicationStateView` (`apps/web/src/application/company/application-state.ts:69-102`): `draft`→«Sin enviar», `awaiting_assessment`/`human_review`→«En revisión», `approved`/`changes_requested`/`rejected`.
- Ya existen los reads que «Ver lo enviado» necesita, **salvo el id**: `SmeRequestRepositoryPort.findByOwner` (`apps/api/src/application/ports/sme-request-repository-port.ts:142`), `BusinessRepositoryPort.findByOwner` y `GET /businesses/mine` (`apps/api/src/infrastructure/http/routes/business.route.ts:46`), `PymeDocumentRepositoryPort.listByOwner` (`apps/api/src/application/ports/pyme-document-repository-port.ts:50`).
- Hueco real (más chico que lo que decía el issue): **no hay forma de resolver el `applicationId` desde el principal**. Eso son T1/T3; el resto ya existe.
- Sin read owner-facing de documentos: `document-verdict.route.ts` es ADMIN-only → T2 agrega el read del owner (metadata, sin `objectPath`).
- Ojo Fastify: `/sme-requests/mine` (estática) gana sobre `/sme-requests/:applicationId` (paramétrica) — registrar la estática igual deja la paramétrica intacta.

L4 — WU1 entregada (2026-10-15), commit `f25697a` (`feat(api): owner-scoped reads for the company post-submission state (#530)`):

- T1/T2 implementadas por un worker delegado. El worker paró al toparse con `apps/api/openapi.json` (artefacto generado **commiteado**) fuera de su superficie; el orquestador lo regeneró: `pnpm --filter @vaqcrow/api openapi:generate` → 194 inserciones, 0 borrados (sólo los 2 paths nuevos). Es parte del mismo cambio, no una decisión del owner.
- Verificación independiente (`gentle-ai-verify`, disparada por el risk-assess en `high`): S4/S5/S6 (slice API) **met**, sin blockers. Sondas propias: `?userId=`, `?owner=`, headers falsos y body no cambian la identidad; `objectPath` y campos colados no cruzan el wire; `/sme-requests/mine` no ensombrece `/sme-requests/:applicationId`; 401/403/503 correctos. Sus 11 sondas quedaron como regresión: `apps/api/src/infrastructure/http/routes/wu1-post-submission-probes.test.ts` (11/11 en el workspace).
- Seguridad (OWASP Top 10:2025 + LLM 2026): **no findings**. A01: la identidad sale sólo de `request.principal.userId`; A10: falla cerrado (503 sanitizado, nunca un estado inventado).
- Gate: `pnpm run verify` exit 0. El primer intento falló por 2 imports sin usar en los tests nuevos; corregidos antes de commitear.

L5 — Aprendizajes: `apps/api/openapi.json` es un artefacto **commiteado** generado por `openapi:generate`; `openapi.test.ts` falla si el registry diverge → toda ruta nueva lo regenera en el mismo cambio. `ApplicationId` es un tipo branded: los fixtures se arman con `parseApplicationId`.
