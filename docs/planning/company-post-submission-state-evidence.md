---
title: Company state after submission
tags:
  - planning
  - evidence
  - pyme
  - company
  - security
date: 2026-10-15
status: delivered
---

# Feature #530 — Estado de «Mi campaña» después de enviar

> [!info] Objetivo
> Que `/company` deje de ofrecer «Registrar mi PyME» en cuanto existe una solicitud y, en su lugar, ofrezca **ver lo enviado en solo lectura**. Antes el botón se mostraba siempre y el estado sólo se conocía si el PyME había enviado en esa misma sesión, así que un PyME que volvía veía el botón equivocado (issue del Epic #528, a partir del primer test manual de punta a punta).

## Decisiones del owner (2026-10-15)

| # | Pregunta | Resolución |
|---|---|---|
| D1 | Qué muestra «Ver lo enviado» | **Resumen read-only de lo persistido**: empresa, solicitud + ventas declaradas, y documentos |
| D2 | ¿Re-mostrar la banda de IA? | **No**: es simulada; presentarla como «enviada» sería mentir |
| D3 | ¿Editar o re-enviar? | **Fuera de alcance**: sigue diferido a la Feature de revisión (decisión asentada 2026-10-04) |
| D4 | Estados que ocultan el botón | Todos menos «Sin enviar» (sin solicitud, o `draft`) |
| D5 | Forma del panel | **Inline**, mismo patrón que «Declarar ventas» / «Firmar distribución»; no se inventa un modal |
| D6 | Contrato de `loadMine` | **Result union** (`{ ok: true, application } \| { ok: false, code }`), no un `\| null` que lanza |

## Cambios

**API** (`f25697a`)

- `apps/api/src/application/use-cases/get-my-application.ts` (nuevo): resuelve la solicitud del owner con `SmeRequestRepositoryPort.findByOwner` (más nueva primero) + `findReviewStateByApplicationId`; sin solicitud → `{ application: null }`.
- `apps/api/src/application/use-cases/get-my-documents.ts` (nuevo): proyecta los documentos a metadata (`documentId`, `kind`, `name`, `sizeBytes`, `contentType`, `createdAt`) — **nunca** el `objectPath`.
- `apps/api/src/infrastructure/http/routes/my-application.route.ts` y `my-documents.route.ts` (nuevos): `GET /sme-requests/mine` y `GET /pyme-documents/mine`, ambas `only("PYME")`.
- Sin métodos de repositorio nuevos ni migraciones: los reads ya existían (`findByOwner`, `listByOwner`). `apps/api/openapi.json` regenerado en el mismo cambio (es un artefacto commiteado y `openapi.test.ts` falla si diverge).

**Web** (`7cf50ae`, `48da2a0`)

- `apps/web/src/application/ports/sme-request-gateway.ts`: `loadMine()` con result union.
- `apps/web/src/infrastructure/sme/http-sme-request-gateway.ts`: adapter contra `GET /sme-requests/mine`, parse estricto; 401/403 → `unauthenticated`, otro non-200 → `unavailable`, transporte → `network`.
- `apps/web/src/state/use-my-application.ts` (nuevo): SWR; `undefined` mientras es desconocido, nunca inventa una solicitud.
- `apps/web/src/application/company/can-register-company.ts` (nuevo): la regla pura de visibilidad (React-free, testeada sola).
- `apps/web/src/application/ports/my-documents-port.ts` + `apps/web/src/infrastructure/company/http-my-documents-gateway.ts` + `create-my-documents-port.ts` (nuevos).
- `apps/web/src/state/use-my-documents.ts` (nuevo).
- `apps/web/src/application/company/submitted-data.ts` (nuevo): view-model puro + copy.
- `apps/web/src/presentation/components/company/company-submitted-data.tsx` (nuevo): panel read-only inline, con degradación por bloque.
- `apps/web/src/presentation/components/pyme-onboarding/company-workspace.tsx`: resuelve el id (`capturado en sesión ?? mine.applicationId ?? prop`) y alterna «Registrar mi PyME» / «Ver lo enviado».

**Contratos**

- `packages/contracts/src/my-application.ts` (nuevo): `myApplicationReadSchema`, `myDocumentsReadSchema`, `myDocumentSchema` — todos `strictObject`, así que un body con `objectPath` o con claves desconocidas se **rechaza** en vez de reenviarse.

**Docs alineados**

- `AGENTS.md` / `CLAUDE.md` (gemelos byte-idénticos): la regla del botón pasa a «mientras no tenga ninguna solicitud» y se nombra «Ver lo enviado» con sus datos.
- `docs/wiki/mi-campana.md` (corpus del asistente): agrega «Ver lo enviado» a lo que la PyME puede hacer.

## Criterios de aceptación (verbatim del issue #530) → verificación

- **«The button's visibility follows the PyME's real application state in a fresh session.»** → `apps/web/src/verifier-wu2a/company-workspace.probes.test.tsx`: matriz de los 7 casos (los 5 estados posteriores al envío muestran «Ver lo enviado» y esconden «Registrar mi PyME»; `null` y `draft` al revés, y nunca las dos a la vez), más el caso de sesión nueva donde el estado se resuelve por el principal. Y `company-workspace.test.tsx`.
- **««Ver lo enviado» renders the submitted data read-only.»** → `apps/web/src/verifier-wu2b/company-post-submission.probes.test.tsx`: el panel no tiene inputs; renderiza empresa, solicitud + ventas declaradas y documentos; ningún término de la banda de IA aparece; ningún storage path aparece ni siquiera con un port que lo filtra en runtime; cada lectura cae por bloque sin vaciar la vista. Y `company-submitted-data.test.tsx`.
- **«The owner-scoped read rejects a caller-supplied identity.»** → `apps/api/src/infrastructure/http/routes/wu1-post-submission-probes.test.ts` falsifica `?owner=`, `?userId=`, headers `x-owner-id`/`x-user-id` y un body con `ownerUserId`: la lectura sigue al principal. `verifier-wu2a` además prueba que el wire manda sólo `{ method: "GET", path }`, sin identidad de cliente.

## Verificación

- API: `pnpm --filter @vaqcrow/api test` → **162 archivos / 3179 tests**, 0 fallos.
- Web: `pnpm --filter @vaqcrow/web test` → **247 archivos / 2392 tests**, 0 fallos.
- Contratos: `pnpm --filter @vaqcrow/contracts test` → 29 archivos / 759 tests.
- `pnpm run verify` → **exit 0** (lint + typecheck + test + build + boundaries + test:boundaries; raíz 10 archivos / 185 tests).
- **Verificación independiente por work-unit** (`gentle-ai-verify`), disparada porque el risk-assess del diff dio `high` en los tres (fail-closed por archivos nuevos sin declarar): S1-hide/S2/S3/S6 (WU2a) y S4/S1-contrato (WU2b) **met**, sin blockers. Las 60 sondas de los verificadores quedaron como regresión (`apps/web/src/verifier-wu2a/`, `apps/web/src/verifier-wu2b/`, `apps/api/src/infrastructure/http/routes/wu1-post-submission-probes.test.ts`).
- RED reproducido: cada unidad observó su test en rojo antes de implementar (la API contra el fixture con la forma real de la vista; el web con el botón renderizado incondicionalmente).
- Seguridad (OWASP Top 10:2025 + LLM 2026): **no findings**. La identidad sale sólo de `request.principal.userId`; el parse estricto rechaza un body con claves de más; el fallo es un `503 { code: "unavailable" }` saneado, nunca un estado inventado.

## Límites y notas

- El PR **#538 está abierto y sin mergear** al escribir esta evidencia: todo lo de arriba son comandos corridos en el árbol de trabajo, no un estado de `main`.
- Advisories de los verificadores; ninguna exige corrección: (1) el botón puede verse un instante en el primer paint, antes de que resuelva la lectura del estado — es deliberado (#480: «desconocido ≠ rechazo»); (2) abrir el panel re-lee la solicitud porque su clave SWR difiere de la del banner (una lectura de más, inofensiva); (3) con el panel abierto se reemplaza el cuerpo de `/company`, igual que el wizard; (4) la copia («Ver lo enviado», y la etiqueta «Objetivo» frente al «Meta de financiamiento (ARS)» del wizard) es **owner-pending**.
- No hay chequeo contra Testnet: la Feature no toca Stellar, ni aportes, ni dinero. El reset de Testnet del **2026-12-16** no la afecta.
- El Epic #528 sigue abierto: esta Feature es uno de sus hijos. El resto de los hallazgos del primer test manual (503 del dashboard, fondos de Testnet, ayuda flotante, deep-link del alta, grid de la landing, correo al admin, indicador del paso 3) vive en sus propios issues.
